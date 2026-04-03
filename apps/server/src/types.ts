export type ThemeMode = 'light' | 'dark'

export interface BirdseyeSettings {
  /** Theme mode (light/dark). */
  theme?: ThemeMode
  /** Workspace launch behavior: workspaceId or "last". When unset, stay on home screen. */
  defaultWorkspace?: string
  /** Default model key in provider/modelId form (e.g. "anthropic/claude-sonnet-4") */
  defaultModelKey?: string
  /** Default thinking level for new live sessions */
  defaultThinkingLevel?: ThinkingLevel
  [key: string]: unknown
}

export interface WorkspaceRecord {
  id: string
  name: string
  path: string
  createdAt: string
  lastOpenedAt?: string
  exists: boolean
}

export type PiMigrationState = 'pending' | 'migrated' | 'skipped' | 'not_needed'

export interface PiMigrationCategoryAvailability {
  settings: boolean
  auth: boolean
  resources: boolean
  context: boolean
}

export interface PiMigrationStatus {
  state: PiMigrationState
  hasLegacyPiDir: boolean
  targetDir: string
  available: PiMigrationCategoryAvailability
  selectedCategories: Array<keyof PiMigrationCategoryAvailability>
  decidedAt?: string
}

export interface SessionSummary {
  viewerId: string
  sessionId: string
  title: string
  preview: string
  previewRole?: 'user' | 'assistant'
  lastUserPreview?: string
  cwd: string
  filePath: string
  fileName: string
  source: 'pi' | 'birdseye'
  startedAt: string
  updatedAt: string
  messageCount: number
  userMessageCount: number
  assistantMessageCount: number
  hasBranches: boolean
  provider?: string
  model?: string
}

export interface SessionEntryView {
  id?: string
  parentId?: string | null
  timestamp?: string
  entryType: string
  role: string
  text: string
  metadata?: Record<string, string | number | boolean | null | undefined>
}

export interface SessionDetail extends SessionSummary {
  entries: SessionEntryView[]
}

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export interface ModelOption {
  key: string
  provider: string
  modelId: string
  name: string
  reasoning: boolean
}

export interface LiveSessionState {
  active: boolean
  isStreaming: boolean
  modelKey: string
  thinkingLevel: ThinkingLevel
  availableThinkingLevels: ThinkingLevel[]
  steeringMessages: string[]
  followUpMessages: string[]
}

export interface LiveSessionSummary {
  viewerId: string
  active: boolean
  isStreaming: boolean
}

export interface LiveSessionStartRequest {
  modelKey?: string
  thinkingLevel?: ThinkingLevel
}

export interface LiveSessionResponse {
  runtime: LiveSessionState
}

export interface CreateLiveSessionResponse {
  detail: SessionDetail
  runtime: LiveSessionState
}

export interface SendLiveSessionMessageRequest extends LiveSessionStartRequest {
  message: string
}

export interface QueueLiveSessionMessageRequest {
  message: string
  mode: 'steer' | 'followUp'
}

export interface SendLiveSessionMessageResponse {
  detail: SessionDetail
  runtime: LiveSessionState
}

export interface QueueLiveSessionMessageResponse {
  runtime: LiveSessionState
}

export interface RenameSessionRequest {
  title: string
}

export interface LiveSessionStreamEvent {
  type:
    | 'text-delta'
    | 'thinking-start'
    | 'thinking-delta'
    | 'thinking-end'
    | 'tool-start'
    | 'tool-delta'
    | 'tool-end'
    | 'status'
    | 'queue-update'
    | 'done'
    | 'error'
  delta?: string
  message?: string
  detail?: SessionDetail
  runtime?: LiveSessionState
  toolCallId?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  isError?: boolean
  result?: string
}
