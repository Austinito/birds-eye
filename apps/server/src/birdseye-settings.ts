import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { BIRDSEYE_SETTINGS_PATH, ensureBirdseyeHome } from './config.js'
import type { BirdseyeSettings, ThemeMode, ThinkingLevel } from './types.js'

const VALID_THEMES = new Set<ThemeMode>(['light', 'dark'])
const VALID_THINKING_LEVELS = new Set<ThinkingLevel>(['off', 'minimal', 'low', 'medium', 'high', 'xhigh'])

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}


export function loadBirdseyeSettings(): BirdseyeSettings | null {
  ensureBirdseyeHome()

  if (!existsSync(BIRDSEYE_SETTINGS_PATH)) {
    return null
  }

  try {
    const content = readFileSync(BIRDSEYE_SETTINGS_PATH, 'utf8')
    const parsed = JSON.parse(content)
    if (!isRecord(parsed)) return null

    const settings = parsed as BirdseyeSettings

    // Sanitize unsupported/legacy values.
    if (settings.theme && !VALID_THEMES.has(settings.theme as ThemeMode)) {
      delete (settings as any).theme
    }

    return settings
  } catch {
    return null
  }
}

export function saveBirdseyeSettings(settings: BirdseyeSettings): void {
  ensureBirdseyeHome()
  writeFileSync(BIRDSEYE_SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
}

export function normalizeBirdseyeSettingsPayload(
  payload: unknown,
): { ok: true; value: BirdseyeSettings } | { ok: false; error: string } {
  if (!isRecord(payload)) {
    return { ok: false, error: 'Settings payload must be an object' }
  }

  const normalized: BirdseyeSettings = { ...payload }

  if ('theme' in payload) {
    const theme = payload.theme
    if (theme === null || theme === undefined || theme === 'system') {
      delete normalized.theme
    } else if (typeof theme === 'string' && VALID_THEMES.has(theme as ThemeMode)) {
      normalized.theme = theme as ThemeMode
    } else {
      return { ok: false, error: 'Invalid theme value' }
    }
  }

  if ('defaultWorkspace' in payload) {
    const value = normalizeOptionalString(payload.defaultWorkspace)
    if (!value) {
      delete normalized.defaultWorkspace
    } else if (value === 'last' || value.length <= 128) {
      normalized.defaultWorkspace = value
    } else {
      return { ok: false, error: 'Invalid defaultWorkspace value' }
    }
  }

  if ('defaultModelKey' in payload) {
    const value = normalizeOptionalString(payload.defaultModelKey)
    if (!value) {
      delete normalized.defaultModelKey
    } else if (value.length <= 200) {
      normalized.defaultModelKey = value
    } else {
      return { ok: false, error: 'Invalid defaultModelKey value' }
    }
  }

  if ('defaultThinkingLevel' in payload) {
    const raw = payload.defaultThinkingLevel
    if (raw === null || raw === undefined || raw === '') {
      delete normalized.defaultThinkingLevel
    } else if (typeof raw === 'string' && VALID_THINKING_LEVELS.has(raw as ThinkingLevel)) {
      normalized.defaultThinkingLevel = raw as ThinkingLevel
    } else {
      return { ok: false, error: 'Invalid defaultThinkingLevel value' }
    }
  }

  if ('notifyOnWorkComplete' in payload) {
    const raw = payload.notifyOnWorkComplete
    if (raw === null || raw === undefined) {
      delete (normalized as any).notifyOnWorkComplete
    } else if (typeof raw === 'boolean') {
      normalized.notifyOnWorkComplete = raw
    } else {
      return { ok: false, error: 'Invalid notifyOnWorkComplete value' }
    }
  }

  if ('notifyOnlyWhenNotViewing' in payload) {
    const raw = payload.notifyOnlyWhenNotViewing
    if (raw === null || raw === undefined) {
      delete (normalized as any).notifyOnlyWhenNotViewing
    } else if (typeof raw === 'boolean') {
      normalized.notifyOnlyWhenNotViewing = raw
    } else {
      return { ok: false, error: 'Invalid notifyOnlyWhenNotViewing value' }
    }
  }

  return { ok: true, value: normalized }
}
