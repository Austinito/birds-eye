import type {
  AppConfig,
  BirdseyeSettings,
  CreateLiveSessionResponse,
  FolderBrowseResponse,
  LiveSessionResponse,
  LiveSessionStreamEvent,
  ModelOption,
  PiMigrationStatus,
  LiveSessionSummary,
  GlobalLiveSessionSummary,
  QueueLiveSessionMessageResponse,
  RenameSessionRequest,
  SendLiveSessionMessageResponse,
  SessionDetail,
  SessionSummary,
  ThinkingLevel,
  Workspace,
} from './types'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `Request failed (${response.status})` }))
    throw new Error(error.error || `Request failed (${response.status})`)
  }

  return response.json() as Promise<T>
}

export const api = {
  getConfig(): Promise<AppConfig> {
    return fetch('/api/config').then((response) => parseJson<AppConfig>(response))
  },

  getSettings(): Promise<BirdseyeSettings> {
    return fetch('/api/settings').then((response) => parseJson<BirdseyeSettings>(response))
  },

  saveSettings(settings: BirdseyeSettings): Promise<BirdseyeSettings> {
    return fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).then((response) => parseJson<BirdseyeSettings>(response))
  },

  getMigrationStatus(): Promise<PiMigrationStatus> {
    return fetch('/api/migration/status').then((response) => parseJson<PiMigrationStatus>(response))
  },

  runMigration(categories?: Record<string, boolean>): Promise<PiMigrationStatus> {
    return fetch('/api/migration/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories }),
    }).then((response) => parseJson<PiMigrationStatus>(response))
  },

  skipMigration(): Promise<PiMigrationStatus> {
    return fetch('/api/migration/skip', { method: 'POST' }).then((response) => parseJson<PiMigrationStatus>(response))
  },

  browse(path?: string): Promise<FolderBrowseResponse> {
    const url = path ? `/api/browse?path=${encodeURIComponent(path)}` : '/api/browse'
    return fetch(url).then((response) => parseJson<FolderBrowseResponse>(response))
  },

  getWorkspaces(): Promise<Workspace[]> {
    return fetch('/api/workspaces').then((response) => parseJson<Workspace[]>(response))
  },

  createWorkspace(path: string, name?: string): Promise<Workspace> {
    return fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    }).then((response) => parseJson<Workspace>(response))
  },

  deleteWorkspace(workspaceId: string): Promise<{ ok: true }> {
    return fetch(`/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
    }).then((response) => parseJson<{ ok: true }>(response))
  },

  getWorkspace(workspaceId: string): Promise<Workspace> {
    return fetch(`/api/workspaces/${workspaceId}`).then((response) => parseJson<Workspace>(response))
  },

  getSessions(workspaceId: string): Promise<SessionSummary[]> {
    return fetch(`/api/workspaces/${workspaceId}/sessions`).then((response) => parseJson<SessionSummary[]>(response))
  },

  getSession(workspaceId: string, viewerId: string): Promise<SessionDetail> {
    return fetch(`/api/workspaces/${workspaceId}/sessions/${viewerId}`).then((response) => parseJson<SessionDetail>(response))
  },

  getAvailableModels(): Promise<ModelOption[]> {
    return fetch('/api/models').then((response) => parseJson<ModelOption[]>(response))
  },

  getLiveSessionSummaries(workspaceId: string): Promise<LiveSessionSummary[]> {
    return fetch(`/api/workspaces/${workspaceId}/sessions/live`).then((response) => parseJson<LiveSessionSummary[]>(response))
  },

  getGlobalLiveSessionSummaries(): Promise<GlobalLiveSessionSummary[]> {
    return fetch('/api/sessions/live').then((response) => parseJson<GlobalLiveSessionSummary[]>(response))
  },

  createLiveSession(workspaceId: string, options: { modelKey?: string; thinkingLevel?: ThinkingLevel }) {
    return fetch(`/api/workspaces/${workspaceId}/sessions/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    }).then((response) => parseJson<CreateLiveSessionResponse>(response))
  },

  getLiveSession(workspaceId: string, viewerId: string) {
    return fetch(`/api/workspaces/${workspaceId}/sessions/${viewerId}/live`).then((response) => parseJson<LiveSessionResponse>(response))
  },

  startLiveSession(workspaceId: string, viewerId: string, options: { modelKey?: string; thinkingLevel?: ThinkingLevel }) {
    return fetch(`/api/workspaces/${workspaceId}/sessions/${viewerId}/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    }).then((response) => parseJson<LiveSessionResponse>(response))
  },

  queueLiveSessionMessage(workspaceId: string, viewerId: string, options: { message: string; mode: 'steer' | 'followUp' }) {
    return fetch(`/api/workspaces/${workspaceId}/sessions/${viewerId}/live/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    }).then((response) => parseJson<QueueLiveSessionMessageResponse>(response))
  },

  async sendLiveSessionMessageStream(
    workspaceId: string,
    viewerId: string,
    options: { message: string; modelKey?: string; thinkingLevel?: ThinkingLevel },
    handlers: { onOpen?: () => void; onEvent: (event: LiveSessionStreamEvent) => void },
  ) {
    const response = await fetch(`/api/workspaces/${workspaceId}/sessions/${viewerId}/live/message/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Request failed (${response.status})` }))
      throw new Error(error.error || `Request failed (${response.status})`)
    }

    if (!response.body) {
      throw new Error('Streaming response body was not available')
    }

    handlers.onOpen?.()

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)

        if (line) {
          handlers.onEvent(JSON.parse(line) as LiveSessionStreamEvent)
        }

        newlineIndex = buffer.indexOf('\n')
      }
    }

    const finalChunk = buffer.trim()
    if (finalChunk) {
      handlers.onEvent(JSON.parse(finalChunk) as LiveSessionStreamEvent)
    }
  },

  sendLiveSessionMessage(
    workspaceId: string,
    viewerId: string,
    options: { message: string; modelKey?: string; thinkingLevel?: ThinkingLevel },
  ) {
    return fetch(`/api/workspaces/${workspaceId}/sessions/${viewerId}/live/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    }).then((response) => parseJson<SendLiveSessionMessageResponse>(response))
  },

  generateSessionTitle(workspaceId: string, viewerId: string): Promise<SessionDetail> {
    return fetch(`/api/workspaces/${workspaceId}/sessions/${viewerId}/rename/auto`, {
      method: 'POST',
    }).then((response) => parseJson<SessionDetail>(response))
  },

  renameSession(workspaceId: string, viewerId: string, payload: RenameSessionRequest): Promise<SessionDetail> {
    return fetch(`/api/workspaces/${workspaceId}/sessions/${viewerId}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((response) => parseJson<SessionDetail>(response))
  },

  archiveSession(workspaceId: string, viewerId: string): Promise<{ ok: true }> {
    return fetch(`/api/workspaces/${workspaceId}/sessions/${viewerId}/archive`, {
      method: 'POST',
    }).then((response) => parseJson<{ ok: true }>(response))
  },

  archiveSessions(
    workspaceId: string,
    viewerIds: string[],
  ): Promise<{ ok: true; archived: string[]; errors: Array<{ viewerId: string; error: string }> }> {
    return fetch(`/api/workspaces/${workspaceId}/sessions/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerIds }),
    }).then((response) => parseJson<{ ok: true; archived: string[]; errors: Array<{ viewerId: string; error: string }> }>(response))
  },

  saveWorkspaceIcon(workspaceId: string, dataUrl: string): Promise<Workspace> {
    return fetch(`/api/workspaces/${workspaceId}/icon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    }).then((response) => parseJson<Workspace>(response))
  },

  deleteWorkspaceIcon(workspaceId: string): Promise<Workspace> {
    return fetch(`/api/workspaces/${workspaceId}/icon`, {
      method: 'DELETE',
    }).then((response) => parseJson<Workspace>(response))
  },
}
