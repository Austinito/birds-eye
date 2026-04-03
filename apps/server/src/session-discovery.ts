import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, rename } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import type { SessionDetail, SessionEntryView, SessionSummary } from './types.js'

const SOURCE_ROOTS = [
  {
    source: 'birdseye' as const,
    dir: join(homedir(), '.birdseye', 'sessions'),
    archiveDir: join(homedir(), '.birdseye', 'archived-sessions'),
  },
  {
    source: 'pi' as const,
    dir: join(homedir(), '.pi', 'agent', 'sessions'),
    archiveDir: join(homedir(), '.pi', 'agent', 'archived-sessions'),
  },
]

interface ParsedSession {
  summary: SessionSummary
  entries: SessionEntryView[]
}

interface GenericRecord {
  [key: string]: unknown
}

function safeJsonParse(line: string): GenericRecord | null {
  try {
    const parsed = JSON.parse(line)
    return parsed && typeof parsed === 'object' ? (parsed as GenericRecord) : null
  } catch {
    return null
  }
}

function truncate(text: string, length = 180): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= length) return collapsed
  return `${collapsed.slice(0, length - 1)}…`
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function summarizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  const chunks: string[] = []

  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const record = block as GenericRecord
    const type = record.type

    if (type === 'text' && typeof record.text === 'string') {
      chunks.push(record.text)
      continue
    }

    if (type === 'thinking') {
      continue
    }

    if (type === 'toolCall') {
      const toolName = stringValue(record.name) || 'tool'
      const args = record.arguments ? truncate(JSON.stringify(record.arguments), 100) : ''
      chunks.push(args ? `[tool:${toolName}] ${args}` : `[tool:${toolName}]`)
      continue
    }

    if (type === 'image') {
      chunks.push('[image]')
    }
  }

  return chunks.join('\n').trim()
}

function summarizeContentForPreview(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  const chunks: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const record = block as GenericRecord
    if (record.type === 'text' && typeof record.text === 'string') {
      chunks.push(record.text)
    }
  }

  return chunks.join('\n').trim()
}

function normalizeSessionEntry(entry: GenericRecord): SessionEntryView | null {
  const entryType = stringValue(entry.type) || 'unknown'
  const timestamp = stringValue(entry.timestamp) || undefined
  const id = stringValue(entry.id) || undefined
  const parentId = typeof entry.parentId === 'string' || entry.parentId === null
    ? (entry.parentId as string | null)
    : undefined

  if (entryType === 'message') {
    const message = entry.message && typeof entry.message === 'object' ? (entry.message as GenericRecord) : {}
    const role = stringValue(message.role) || 'message'
    const text = summarizeContent(message.content) || stringValue(message.errorMessage)
    const metadata: Record<string, string | number | boolean | null | undefined> = {}
    const usage = message.usage && typeof message.usage === 'object' ? (message.usage as GenericRecord) : null
    const cost = usage?.cost && typeof usage.cost === 'object' ? (usage.cost as GenericRecord) : null

    if (typeof message.provider === 'string') metadata.provider = message.provider
    if (typeof message.model === 'string') metadata.model = message.model
    if (typeof message.toolName === 'string') metadata.toolName = message.toolName
    if (typeof message.stopReason === 'string') metadata.stopReason = message.stopReason
    if (typeof message.toolCallId === 'string') metadata.toolCallId = message.toolCallId
    if (typeof message.isError === 'boolean') metadata.isError = message.isError
    if (typeof message.errorMessage === 'string') metadata.errorMessage = message.errorMessage
    if (typeof usage?.input === 'number') metadata.usageInput = usage.input
    if (typeof usage?.output === 'number') metadata.usageOutput = usage.output
    if (typeof usage?.cacheRead === 'number') metadata.usageCacheRead = usage.cacheRead
    if (typeof usage?.cacheWrite === 'number') metadata.usageCacheWrite = usage.cacheWrite
    if (typeof usage?.totalTokens === 'number') metadata.usageTotalTokens = usage.totalTokens
    if (typeof cost?.input === 'number') metadata.usageCostInput = cost.input
    if (typeof cost?.output === 'number') metadata.usageCostOutput = cost.output
    if (typeof cost?.cacheRead === 'number') metadata.usageCostCacheRead = cost.cacheRead
    if (typeof cost?.cacheWrite === 'number') metadata.usageCostCacheWrite = cost.cacheWrite
    if (typeof cost?.total === 'number') metadata.usageCostTotal = cost.total

    return {
      id,
      parentId,
      timestamp,
      entryType,
      role,
      text: text || `[${role}]`,
      metadata,
    }
  }

  if (entryType === 'custom_message') {
    return {
      id,
      parentId,
      timestamp,
      entryType,
      role: 'custom',
      text: summarizeContent(entry.content) || '[custom message]',
      metadata: {
        customType: stringValue(entry.customType) || undefined,
        display: typeof entry.display === 'boolean' ? entry.display : undefined,
      },
    }
  }

  if (entryType === 'session_info') {
    return {
      id,
      parentId,
      timestamp,
      entryType,
      role: 'session',
      text: stringValue(entry.name) ? `Session renamed to “${stringValue(entry.name)}”` : '[session info]',
    }
  }

  if (entryType === 'model_change') {
    return {
      id,
      parentId,
      timestamp,
      entryType,
      role: 'system',
      text: `Model changed to ${stringValue(entry.provider)}/${stringValue(entry.modelId)}`,
    }
  }

  if (entryType === 'thinking_level_change') {
    return {
      id,
      parentId,
      timestamp,
      entryType,
      role: 'system',
      text: `Thinking level set to ${stringValue(entry.thinkingLevel)}`,
    }
  }

  if (entryType === 'compaction') {
    return {
      id,
      parentId,
      timestamp,
      entryType,
      role: 'system',
      text: stringValue(entry.summary) || '[compaction summary]',
      metadata: {
        tokensBefore: typeof entry.tokensBefore === 'number' ? entry.tokensBefore : undefined,
      },
    }
  }

  if (entryType === 'branch_summary') {
    return {
      id,
      parentId,
      timestamp,
      entryType,
      role: 'system',
      text: stringValue(entry.summary) || '[branch summary]',
      metadata: {
        fromId: stringValue(entry.fromId) || undefined,
      },
    }
  }

  if (entryType === 'label') {
    return {
      id,
      parentId,
      timestamp,
      entryType,
      role: 'system',
      text: stringValue(entry.label)
        ? `Label “${stringValue(entry.label)}” applied`
        : 'Label cleared',
      metadata: {
        targetId: stringValue(entry.targetId) || undefined,
      },
    }
  }

  if (entryType === 'custom') {
    return {
      id,
      parentId,
      timestamp,
      entryType,
      role: 'system',
      text: `[custom:${stringValue(entry.customType) || 'unknown'}]`,
    }
  }

  return {
    id,
    parentId,
    timestamp,
    entryType,
    role: 'system',
    text: truncate(JSON.stringify(entry), 240),
  }
}

export function encodeViewerId(filePath: string): string {
  return Buffer.from(filePath).toString('base64url')
}

export function decodeViewerId(viewerId: string): string {
  return Buffer.from(viewerId, 'base64url').toString('utf8')
}

async function walkJsonlFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return []
  }

  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'archived-sessions') return []
      return walkJsonlFiles(fullPath)
    }
    return extname(entry.name) === '.jsonl' ? [fullPath] : []
  }))

  return files.flat()
}

function parseSessionFile(filePath: string, source: 'pi' | 'birdseye'): ParsedSession | null {
  try {
    const raw = readFileSync(filePath, 'utf8')
    const lines = raw.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return null

    const header = safeJsonParse(lines[0])
    if (!header || stringValue(header.type) !== 'session') {
      return null
    }

    const cwd = resolve(stringValue(header.cwd) || '')
    if (!cwd) {
      return null
    }

    const normalizedEntries: SessionEntryView[] = []
    const childCounts = new Map<string, number>()
    let messageCount = 0
    let userMessageCount = 0
    let assistantMessageCount = 0
    let sessionName = ''
    let latestTurnText = ''
    let latestTurnRole: 'user' | 'assistant' | '' = ''
    let latestUserText = ''
    let latestProvider = ''
    let latestModel = ''
    let firstUserText = ''
    let updatedAt = stringValue(header.timestamp) || new Date().toISOString()

    for (const line of lines.slice(1)) {
      const entry = safeJsonParse(line)
      if (!entry) continue

      if (typeof entry.parentId === 'string') {
        childCounts.set(entry.parentId, (childCounts.get(entry.parentId) ?? 0) + 1)
      }

      const normalized = normalizeSessionEntry(entry)
      if (!normalized) continue

      if (normalized.entryType === 'message' && normalized.role === 'assistant') {
        const message = entry.message && typeof entry.message === 'object' ? (entry.message as GenericRecord) : {}
        const content = message.content

        if (Array.isArray(content)) {
          content.forEach((block, index) => {
            if (!block || typeof block !== 'object') return
            const record = block as GenericRecord
            if (record.type !== 'thinking') return
            if (typeof record.thinking !== 'string' || !record.thinking.trim()) return

            normalizedEntries.push({
              id: normalized.id ? `${normalized.id}:thinking:${index}` : undefined,
              parentId: normalized.parentId,
              timestamp: normalized.timestamp,
              entryType: 'thinking',
              role: 'thinking',
              text: record.thinking,
              metadata: {
                thinkingSignature: typeof record.thinkingSignature === 'string' ? record.thinkingSignature : undefined,
              },
            })
          })
        }
      }

      normalizedEntries.push(normalized)

      if (normalized.timestamp) {
        updatedAt = normalized.timestamp
      }

      if (normalized.entryType === 'session_info' && normalized.text.startsWith('Session renamed to')) {
        sessionName = stringValue(entry.name)
      }

      if (normalized.entryType === 'message') {
        messageCount += 1

        if (normalized.role === 'user') {
          userMessageCount += 1
          if (!firstUserText && normalized.text) {
            firstUserText = normalized.text
          }

          const message = entry.message as GenericRecord
          const previewText = summarizeContentForPreview(message.content) || normalized.text
          if (previewText.trim()) {
            latestUserText = previewText
          }
        }

        if (normalized.role === 'assistant') {
          assistantMessageCount += 1
          const message = entry.message as GenericRecord
          if (typeof message.provider === 'string') latestProvider = message.provider
          if (typeof message.model === 'string') latestModel = message.model
        }

        if (normalized.role === 'user' || normalized.role === 'assistant') {
          const message = entry.message as GenericRecord
          const previewText = summarizeContentForPreview(message.content) || normalized.text
          if (previewText.trim()) {
            latestTurnText = previewText
            latestTurnRole = normalized.role
          }
        }
      }
    }

    const title = truncate(sessionName || firstUserText || basename(filePath, '.jsonl'), 80)
    const preview = truncate(latestTurnText || firstUserText || 'No readable messages yet.', 120)
    const startedAt = stringValue(header.timestamp) || updatedAt
    const sessionId = stringValue(header.id) || basename(filePath, '.jsonl')

    return {
      summary: {
        viewerId: encodeViewerId(filePath),
        sessionId,
        title,
        preview,
        previewRole: latestTurnRole || undefined,
        lastUserPreview: latestUserText ? truncate(latestUserText, 120) : undefined,
        cwd,
        filePath,
        fileName: basename(filePath),
        source,
        startedAt,
        updatedAt,
        messageCount,
        userMessageCount,
        assistantMessageCount,
        hasBranches: Array.from(childCounts.values()).some((count) => count > 1),
        provider: latestProvider || undefined,
        model: latestModel || undefined,
      },
      entries: normalizedEntries,
    }
  } catch {
    return null
  }
}

export async function listWorkspaceSessions(workspacePath: string): Promise<SessionSummary[]> {
  const targetPath = resolve(workspacePath)
  const results = await Promise.all(SOURCE_ROOTS.map(async ({ source, dir }) => {
    const files = await walkJsonlFiles(dir)
    return files
      .map((filePath) => parseSessionFile(filePath, source))
      .filter((session): session is ParsedSession => session !== null)
      .filter((session) => session.summary.cwd === targetPath)
      .map((session) => session.summary)
  }))

  return results
    .flat()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getWorkspaceSessionDetailByFilePath(workspacePath: string, filePath: string): Promise<SessionDetail | null> {
  const targetPath = resolve(workspacePath)
  const source = filePath.includes(`${join(homedir(), '.birdseye', 'sessions')}/`) ? 'birdseye' : 'pi'
  const parsed = parseSessionFile(filePath, source)

  if (!parsed || parsed.summary.cwd !== targetPath) {
    return null
  }

  return {
    ...parsed.summary,
    entries: parsed.entries,
  }
}

export async function getWorkspaceSessionDetail(workspacePath: string, viewerId: string): Promise<SessionDetail | null> {
  return getWorkspaceSessionDetailByFilePath(workspacePath, decodeViewerId(viewerId))
}

export async function archiveSessionFile(filePath: string): Promise<string> {
  const resolvedFilePath = resolve(filePath)
  const sourceRoot = SOURCE_ROOTS.find(({ dir }) => {
    const resolvedDir = resolve(dir)
    return resolvedFilePath === resolvedDir || resolvedFilePath.startsWith(`${resolvedDir}${sep}`)
  })

  if (!sourceRoot) {
    throw new Error('Session file is not in a known sessions directory')
  }

  const resolvedRoot = resolve(sourceRoot.dir)
  const relativePath = relative(resolvedRoot, resolvedFilePath)
  const targetPath = join(sourceRoot.archiveDir, relativePath)

  await mkdir(dirname(targetPath), { recursive: true })
  await rename(resolvedFilePath, targetPath)

  return targetPath
}
