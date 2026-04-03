import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  type AgentSession,
} from '@mariozechner/pi-coding-agent'
import type { SessionDetail } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const skillPath = resolve(__dirname, '../../../skills/session-title-ui/SKILL.md')
const skillInstructions = readFileSync(skillPath, 'utf8')

function truncate(text: string, max = 160) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function extractTranscript(detail: SessionDetail) {
  return detail.entries
    .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
    .slice(-8)
    .map((entry) => `${entry.role.toUpperCase()}: ${truncate(entry.text.replace(/\s+/g, ' ').trim())}`)
    .join('\n')
}

const MAX_UI_TITLE_LENGTH = 36

function sanitizeTitle(title: string) {
  return title
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_UI_TITLE_LENGTH)
}

export async function maybeGenerateSessionTitle(
  session: AgentSession,
  detail: SessionDetail,
  authStorage: AuthStorage,
  modelRegistry: ModelRegistry,
) {
  if (session.sessionName?.trim()) {
    return session.sessionName.trim()
  }

  const transcript = extractTranscript(detail)
  if (!transcript) {
    return null
  }

  const model = session.model
  if (!model) {
    return null
  }

  const { session: titleSession } = await createAgentSession({
    cwd: detail.cwd,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel: 'off',
    tools: [],
    sessionManager: SessionManager.inMemory(),
  })

  let titleText = ''
  const unsubscribe = titleSession.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      titleText += event.assistantMessageEvent.delta
    }
  })

  try {
    await titleSession.prompt(`${skillInstructions}\n\nConversation excerpt:\n${transcript}\n\nReturn only the UI title.`)
  } catch {
    return null
  } finally {
    unsubscribe()
    titleSession.dispose()
  }

  const title = sanitizeTitle(titleText)
  if (!title) {
    return null
  }

  session.sessionManager.appendSessionInfo(title)
  return title
}
