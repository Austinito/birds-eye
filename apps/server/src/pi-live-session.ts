import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  type AgentSession,
} from '@mariozechner/pi-coding-agent'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { archiveSessionFile, getWorkspaceSessionDetail, getWorkspaceSessionDetailByFilePath } from './session-discovery.js'
import { maybeGenerateSessionTitle } from './session-title.js'
import type {
  CreateLiveSessionResponse,
  LiveSessionResponse,
  LiveSessionStartRequest,
  LiveSessionState,
  LiveSessionSummary,
  ModelOption,
  LiveSessionStreamEvent,
  QueueLiveSessionMessageRequest,
  QueueLiveSessionMessageResponse,
  SendLiveSessionMessageRequest,
  SendLiveSessionMessageResponse,
  SessionDetail,
  ThinkingLevel,
} from './types.js'

interface LiveSessionRuntime {
  viewerId: string
  workspacePath: string
  filePath: string
  session: AgentSession
}

const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'medium'
const DEFAULT_THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

const authStorage = AuthStorage.create()
const modelRegistry = ModelRegistry.create(authStorage)
const liveSessions = new Map<string, LiveSessionRuntime>()

function decodeViewerId(viewerId: string): string {
  return Buffer.from(viewerId, 'base64url').toString('utf8')
}

function encodeViewerId(filePath: string): string {
  return Buffer.from(filePath).toString('base64url')
}

function getRuntimeModelKey(session: AgentSession): string {
  return session.model ? `${session.model.provider}/${session.model.id}` : ''
}

function toInactiveLiveSessionState(): LiveSessionState {
  return {
    active: false,
    isStreaming: false,
    modelKey: '',
    thinkingLevel: DEFAULT_THINKING_LEVEL,
    availableThinkingLevels: DEFAULT_THINKING_LEVELS,
    steeringMessages: [],
    followUpMessages: [],
  }
}

function toLiveSessionState(session: AgentSession): LiveSessionState {
  return {
    active: true,
    isStreaming: session.isStreaming,
    modelKey: getRuntimeModelKey(session),
    thinkingLevel: session.thinkingLevel as ThinkingLevel,
    availableThinkingLevels: session.getAvailableThinkingLevels() as ThinkingLevel[],
    steeringMessages: [...session.getSteeringMessages()],
    followUpMessages: [...session.getFollowUpMessages()],
  }
}

export function listLiveSessionSummaries(workspacePath: string): LiveSessionSummary[] {
  return [...liveSessions.values()]
    .filter((runtime) => runtime.workspacePath === workspacePath)
    .map((runtime) => ({
      viewerId: runtime.viewerId,
      active: true,
      isStreaming: runtime.session.isStreaming,
      sessionName: runtime.session.sessionName || undefined,
    }))
}

async function applyRuntimeConfig(
  session: AgentSession,
  request: { modelKey?: string; thinkingLevel?: ThinkingLevel },
) {
  modelRegistry.refresh()

  if (request.modelKey) {
    const [provider, ...modelIdParts] = request.modelKey.split('/')
    const modelId = modelIdParts.join('/')
    const model = provider && modelId ? modelRegistry.find(provider, modelId) : undefined

    if (!model) {
      throw new Error(`Model not found: ${request.modelKey}`)
    }

    await session.setModel(model)
  }

  if (request.thinkingLevel) {
    session.setThinkingLevel(request.thinkingLevel)
  }
}

function getRuntime(viewerId: string, workspacePath: string): LiveSessionRuntime | null {
  const runtime = liveSessions.get(viewerId)
  if (!runtime || runtime.workspacePath !== workspacePath) {
    return null
  }

  return runtime
}

function disposeRuntime(viewerId: string) {
  const runtime = liveSessions.get(viewerId)
  if (!runtime) return
  runtime.session.dispose()
  liveSessions.delete(viewerId)
}

export function getLiveSessionFallbackDetail(
  workspacePath: string,
  viewerId: string,
): SessionDetail | null {
  const runtime = getRuntime(viewerId, workspacePath)
  if (!runtime) return null

  const now = new Date().toISOString()
  return {
    viewerId,
    sessionId: runtime.session.sessionId,
    title: runtime.session.sessionName || 'New session',
    preview: 'No readable messages yet.',
    previewRole: undefined,
    lastUserPreview: undefined,
    cwd: workspacePath,
    filePath: runtime.filePath,
    fileName: basename(runtime.filePath),
    source: runtime.filePath.includes(`${join(homedir(), '.birdseye', 'sessions')}/`) ? 'birdseye' : 'pi',
    startedAt: now,
    updatedAt: now,
    messageCount: 0,
    userMessageCount: 0,
    assistantMessageCount: 0,
    hasBranches: false,
    provider: runtime.session.model?.provider,
    model: runtime.session.model?.id,
    entries: [],
  }
}

export async function generateSessionTitle(
  workspacePath: string,
  viewerId: string,
): Promise<SessionDetail> {
  const detail = await getWorkspaceSessionDetail(workspacePath, viewerId)
  if (!detail) {
    throw new Error('Session not found')
  }

  modelRegistry.refresh()

  const runtime = getRuntime(viewerId, workspacePath)
  if (runtime) {
    await maybeGenerateSessionTitle(runtime.session, detail, authStorage, modelRegistry).catch(() => null)
    const refreshed = await getWorkspaceSessionDetail(workspacePath, viewerId)
    return refreshed ?? detail
  }

  const filePath = decodeViewerId(viewerId)

  // Prefer the persisted model if available, otherwise fall back to the first available model.
  const persistedProvider = detail.provider ?? ''
  const persistedModel = detail.model ?? ''
  const persisted = persistedProvider && persistedModel
    ? modelRegistry.find(persistedProvider, persistedModel)
    : undefined

  const model = persisted ?? (await modelRegistry.getAvailable())[0]
  if (!model) {
    throw new Error('No model available to generate a title')
  }

  const { session } = await createAgentSession({
    cwd: workspacePath,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel: 'off',
    tools: [],
    sessionManager: SessionManager.open(filePath),
  })

  try {
    await maybeGenerateSessionTitle(session, detail, authStorage, modelRegistry).catch(() => null)
  } finally {
    session.dispose()
  }

  const refreshed = await getWorkspaceSessionDetail(workspacePath, viewerId)
  return refreshed ?? detail
}

export async function renameSession(
  workspacePath: string,
  viewerId: string,
  title: string,
): Promise<SessionDetail> {
  const nextTitle = title.trim()
  if (!nextTitle) {
    throw new Error('Title is required')
  }

  const runtime = getRuntime(viewerId, workspacePath)
  if (runtime) {
    runtime.session.sessionManager.appendSessionInfo(nextTitle)
  } else {
    const filePath = decodeViewerId(viewerId)
    const sessionManager = SessionManager.open(filePath)
    sessionManager.appendSessionInfo(nextTitle)
  }

  const detail = await getWorkspaceSessionDetail(workspacePath, viewerId)
  if (!detail) {
    throw new Error('Session detail could not be reloaded')
  }

  return detail
}

export async function archiveSession(
  workspacePath: string,
  viewerId: string,
): Promise<void> {
  const detail = await getWorkspaceSessionDetail(workspacePath, viewerId)
  if (!detail) {
    throw new Error('Session not found')
  }

  const runtime = getRuntime(viewerId, workspacePath)
  if (runtime) {
    if (runtime.session.isStreaming) {
      throw new Error('Session is currently working')
    }
    runtime.session.dispose()
    liveSessions.delete(viewerId)
  }

  await archiveSessionFile(detail.filePath)
}

export async function listAvailableModels(): Promise<ModelOption[]> {
  modelRegistry.refresh()

  return modelRegistry
    .getAvailable()
    .map((model) => ({
      key: `${model.provider}/${model.id}`,
      provider: model.provider,
      modelId: model.id,
      name: model.name,
      reasoning: Boolean((model as { reasoning?: boolean }).reasoning),
    }))
    .sort((left, right) => {
      const providerCompare = left.provider.localeCompare(right.provider)
      if (providerCompare !== 0) return providerCompare
      return left.name.localeCompare(right.name)
    })
}

export async function getLiveSession(workspacePath: string, viewerId: string): Promise<LiveSessionResponse> {
  const runtime = getRuntime(viewerId, workspacePath)
  return {
    runtime: runtime ? toLiveSessionState(runtime.session) : toInactiveLiveSessionState(),
  }
}

export async function startLiveSession(
  workspacePath: string,
  viewerId: string,
  request: LiveSessionStartRequest,
): Promise<LiveSessionResponse> {
  const existingRuntime = getRuntime(viewerId, workspacePath)
  if (existingRuntime) {
    if (!existingRuntime.session.isStreaming) {
      await applyRuntimeConfig(existingRuntime.session, request)
    }

    return {
      runtime: toLiveSessionState(existingRuntime.session),
    }
  }

  disposeRuntime(viewerId)

  const filePath = decodeViewerId(viewerId)
  const { session } = await createAgentSession({
    cwd: workspacePath,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.open(filePath),
    ...(request.modelKey ? { model: modelRegistry.find(request.modelKey.split('/')[0] ?? '', request.modelKey.split('/').slice(1).join('/')) } : {}),
    ...(request.thinkingLevel ? { thinkingLevel: request.thinkingLevel } : {}),
  })

  await applyRuntimeConfig(session, request)

  liveSessions.set(viewerId, {
    viewerId,
    workspacePath,
    filePath,
    session,
  })

  return {
    runtime: toLiveSessionState(session),
  }
}

export async function createLiveSession(
  workspacePath: string,
  request: LiveSessionStartRequest,
): Promise<CreateLiveSessionResponse> {
  modelRegistry.refresh()

  const [provider, ...modelIdParts] = (request.modelKey ?? '').split('/')
  const modelId = modelIdParts.join('/')
  const model = provider && modelId ? modelRegistry.find(provider, modelId) : undefined

  if (request.modelKey && !model) {
    throw new Error(`Model not found: ${request.modelKey}`)
  }

  const { session } = await createAgentSession({
    cwd: workspacePath,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.create(workspacePath),
    ...(model ? { model } : {}),
    ...(request.thinkingLevel ? { thinkingLevel: request.thinkingLevel } : {}),
  })

  await applyRuntimeConfig(session, request)

  const filePath = session.sessionFile
  if (!filePath) {
    session.dispose()
    throw new Error('Session file was not created')
  }

  const viewerId = encodeViewerId(filePath)
  liveSessions.set(viewerId, {
    viewerId,
    workspacePath,
    filePath,
    session,
  })

  const detail = await getWorkspaceSessionDetailByFilePath(workspacePath, filePath)
  const fallbackDetail = detail ?? {
    viewerId,
    sessionId: session.sessionId,
    title: session.sessionName || 'New session',
    preview: 'No readable messages yet.',
    cwd: workspacePath,
    filePath,
    fileName: basename(filePath),
    source: filePath.includes(`${join(homedir(), '.birdseye', 'sessions')}/`) ? 'birdseye' as const : 'pi' as const,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
    userMessageCount: 0,
    assistantMessageCount: 0,
    hasBranches: false,
    provider: session.model?.provider,
    model: session.model?.id,
    entries: [],
  }

  return {
    detail: fallbackDetail,
    runtime: toLiveSessionState(session),
  }
}

export async function queueLiveSessionMessage(
  workspacePath: string,
  viewerId: string,
  request: QueueLiveSessionMessageRequest,
): Promise<QueueLiveSessionMessageResponse> {
  const runtime = getRuntime(viewerId, workspacePath)
  if (!runtime) {
    throw new Error('Live session not started')
  }

  if (!request.message.trim()) {
    throw new Error('Message is required')
  }

  if (!runtime.session.isStreaming) {
    throw new Error('Session is not currently working')
  }

  if (request.mode === 'followUp') {
    await runtime.session.followUp(request.message)
  } else {
    await runtime.session.steer(request.message)
  }

  return {
    runtime: toLiveSessionState(runtime.session),
  }
}

export async function sendLiveSessionMessage(
  workspacePath: string,
  viewerId: string,
  request: SendLiveSessionMessageRequest,
): Promise<SendLiveSessionMessageResponse> {
  const runtime = getRuntime(viewerId, workspacePath)
  if (!runtime) {
    throw new Error('Live session not started')
  }

  if (!request.message.trim()) {
    throw new Error('Message is required')
  }

  if (runtime.session.isStreaming) {
    throw new Error('Session is still processing a previous message')
  }

  await applyRuntimeConfig(runtime.session, request)
  await runtime.session.prompt(request.message)

  let detail = await getWorkspaceSessionDetail(workspacePath, viewerId)
  if (!detail) {
    throw new Error('Session detail could not be reloaded')
  }

  await maybeGenerateSessionTitle(runtime.session, detail, authStorage, modelRegistry).catch(() => null)
  detail = (await getWorkspaceSessionDetail(workspacePath, viewerId)) ?? detail

  return {
    detail,
    runtime: toLiveSessionState(runtime.session),
  }
}

export async function sendLiveSessionMessageStream(
  workspacePath: string,
  viewerId: string,
  request: SendLiveSessionMessageRequest,
  onEvent: (event: LiveSessionStreamEvent) => void,
): Promise<void> {
  const runtime = getRuntime(viewerId, workspacePath)
  if (!runtime) {
    throw new Error('Live session not started')
  }

  if (!request.message.trim()) {
    throw new Error('Message is required')
  }

  if (runtime.session.isStreaming) {
    throw new Error('Session is still processing a previous message')
  }

  await applyRuntimeConfig(runtime.session, request)

  const toolOutputSnapshots = new Map<string, string>()

  const summarizeContentBlocks = (content: unknown): string => {
    if (typeof content === 'string') {
      return content
    }

    if (!Array.isArray(content)) {
      return ''
    }

    const chunks: string[] = []
    for (const block of content) {
      if (!block || typeof block !== 'object') continue
      const record = block as Record<string, unknown>

      if (record.type === 'text' && typeof record.text === 'string') {
        chunks.push(record.text)
        continue
      }

      if (record.type === 'image') {
        chunks.push('[image]')
        continue
      }

      if (record.type === 'toolCall') {
        const name = typeof record.name === 'string' ? record.name : 'tool'
        chunks.push(`[tool:${name}]`)
      }
    }

    return chunks.join('\n').trim()
  }

  const unsubscribe = runtime.session.subscribe((event) => {
    if (event.type === 'message_update') {
      if (event.assistantMessageEvent.type === 'text_delta') {
        onEvent({ type: 'text-delta', delta: event.assistantMessageEvent.delta })
      }

      if (event.assistantMessageEvent.type === 'thinking_start') {
        onEvent({ type: 'thinking-start' })
      }

      if (event.assistantMessageEvent.type === 'thinking_delta') {
        onEvent({ type: 'thinking-delta', delta: event.assistantMessageEvent.delta })
      }

      if (event.assistantMessageEvent.type === 'thinking_end') {
        onEvent({ type: 'thinking-end' })
      }
    }

    if (event.type === 'tool_execution_start') {
      onEvent({
        type: 'tool-start',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        toolInput: event.args && typeof event.args === 'object' ? (event.args as Record<string, unknown>) : undefined,
        runtime: toLiveSessionState(runtime.session),
      })
      toolOutputSnapshots.set(event.toolCallId, '')
    }

    if (event.type === 'tool_execution_update') {
      const toolCallId = event.toolCallId
      const partialResult = event.partialResult as { content?: unknown } | undefined
      const nextSnapshot = summarizeContentBlocks(partialResult?.content)
      const previousSnapshot = toolOutputSnapshots.get(toolCallId) ?? ''
      const delta = nextSnapshot.startsWith(previousSnapshot)
        ? nextSnapshot.slice(previousSnapshot.length)
        : nextSnapshot
      toolOutputSnapshots.set(toolCallId, nextSnapshot)

      if (delta) {
        onEvent({
          type: 'tool-delta',
          toolCallId,
          delta,
        })
      }
    }

    if (event.type === 'tool_execution_end') {
      const resultText = summarizeContentBlocks((event.result as { content?: unknown } | undefined)?.content)
      onEvent({
        type: 'tool-end',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        isError: event.isError,
        result: resultText,
        runtime: toLiveSessionState(runtime.session),
      })
      toolOutputSnapshots.delete(event.toolCallId)
    }

    if (event.type === 'queue_update') {
      onEvent({
        type: 'queue-update',
        runtime: toLiveSessionState(runtime.session),
      })
    }

    if (event.type === 'agent_start') {
      onEvent({
        type: 'status',
        message: 'Working…',
        runtime: toLiveSessionState(runtime.session),
      })
    }
  })

  try {
    await runtime.session.prompt(request.message)

    let detail = await getWorkspaceSessionDetail(workspacePath, viewerId)
    if (!detail) {
      throw new Error('Session detail could not be reloaded')
    }

    await maybeGenerateSessionTitle(runtime.session, detail, authStorage, modelRegistry).catch(() => null)
    detail = (await getWorkspaceSessionDetail(workspacePath, viewerId)) ?? detail

    onEvent({
      type: 'done',
      detail,
      runtime: toLiveSessionState(runtime.session),
    })
  } catch (error) {
    onEvent({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      runtime: toLiveSessionState(runtime.session),
    })
    throw error
  } finally {
    unsubscribe()
  }
}
