import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  BIRDSEYE_PI_AGENT_DIR,
  BIRDSEYE_PI_MIGRATION_PATH,
  LEGACY_PI_AGENT_DIR,
  LEGACY_PI_HOME,
} from './config.js'
import type { PiMigrationCategoryAvailability, PiMigrationStatus, PiMigrationState } from './types.js'

const CATEGORY_PATHS = {
  settings: ['settings.json', 'keybindings.json', 'models.json'],
  auth: ['auth.json'],
  resources: ['skills', 'extensions', 'prompts', 'themes'],
  context: ['AGENTS.md', 'SYSTEM.md', 'APPEND_SYSTEM.md'],
} as const

type MigrationCategory = keyof typeof CATEGORY_PATHS

interface PersistedMigrationState {
  state: Exclude<PiMigrationState, 'pending'>
  selectedCategories: MigrationCategory[]
  decidedAt: string
}

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
}

function readPersistedState(): PersistedMigrationState | null {
  if (!existsSync(BIRDSEYE_PI_MIGRATION_PATH)) {
    return null
  }

  try {
    const raw = JSON.parse(readFileSync(BIRDSEYE_PI_MIGRATION_PATH, 'utf8')) as Partial<PersistedMigrationState>
    if (!raw || typeof raw !== 'object') return null
    if (raw.state !== 'migrated' && raw.state !== 'skipped' && raw.state !== 'not_needed') return null

    return {
      state: raw.state,
      selectedCategories: Array.isArray(raw.selectedCategories)
        ? raw.selectedCategories.filter((value): value is MigrationCategory => value in CATEGORY_PATHS)
        : [],
      decidedAt: typeof raw.decidedAt === 'string' ? raw.decidedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function writePersistedState(state: PersistedMigrationState): void {
  ensureParent(BIRDSEYE_PI_MIGRATION_PATH)
  writeFileSync(BIRDSEYE_PI_MIGRATION_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function detectAvailability(): PiMigrationCategoryAvailability {
  const hasAny = (paths: readonly string[]) => paths.some((relativePath) => existsSync(join(LEGACY_PI_AGENT_DIR, relativePath)))

  return {
    settings: hasAny(CATEGORY_PATHS.settings),
    auth: hasAny(CATEGORY_PATHS.auth),
    resources: hasAny(CATEGORY_PATHS.resources),
    context: hasAny(CATEGORY_PATHS.context),
  }
}

function hasAnyAvailable(availability: PiMigrationCategoryAvailability): boolean {
  return Object.values(availability).some(Boolean)
}

function toStatus(
  state: PiMigrationState,
  availability: PiMigrationCategoryAvailability,
  selectedCategories: MigrationCategory[] = [],
  decidedAt?: string,
): PiMigrationStatus {
  return {
    state,
    hasLegacyPiDir: existsSync(LEGACY_PI_HOME),
    targetDir: BIRDSEYE_PI_AGENT_DIR,
    available: availability,
    selectedCategories,
    decidedAt,
  }
}

function ensureTargetDir(): void {
  mkdirSync(BIRDSEYE_PI_AGENT_DIR, { recursive: true })
}

function copyEntry(relativePath: string): void {
  const fromPath = join(LEGACY_PI_AGENT_DIR, relativePath)
  const toPath = join(BIRDSEYE_PI_AGENT_DIR, relativePath)

  if (!existsSync(fromPath)) {
    return
  }

  ensureTargetDir()
  cpSync(fromPath, toPath, {
    recursive: true,
    force: false,
    errorOnExist: false,
  })
}

function normalizeSelection(input?: Partial<Record<MigrationCategory, boolean>>): MigrationCategory[] {
  const availability = detectAvailability()
  const all = Object.keys(CATEGORY_PATHS) as MigrationCategory[]

  if (!input) {
    return all.filter((category) => availability[category])
  }

  return all.filter((category) => input[category] === true && availability[category])
}

export function getPiMigrationStatus(): PiMigrationStatus {
  const persisted = readPersistedState()
  const availability = detectAvailability()

  if (persisted) {
    return toStatus(persisted.state, availability, persisted.selectedCategories, persisted.decidedAt)
  }

  if (!existsSync(LEGACY_PI_HOME) || !hasAnyAvailable(availability)) {
    const decidedAt = new Date().toISOString()
    writePersistedState({ state: 'not_needed', selectedCategories: [], decidedAt })
    return toStatus('not_needed', availability, [], decidedAt)
  }

  return toStatus('pending', availability)
}

export function runPiMigration(selection?: Partial<Record<MigrationCategory, boolean>>): PiMigrationStatus {
  const availability = detectAvailability()
  const selectedCategories = normalizeSelection(selection)

  for (const category of selectedCategories) {
    for (const relativePath of CATEGORY_PATHS[category]) {
      copyEntry(relativePath)
    }
  }

  const decidedAt = new Date().toISOString()
  writePersistedState({ state: 'migrated', selectedCategories, decidedAt })

  return toStatus('migrated', availability, selectedCategories, decidedAt)
}

export function skipPiMigration(): PiMigrationStatus {
  const availability = detectAvailability()
  const decidedAt = new Date().toISOString()
  writePersistedState({ state: 'skipped', selectedCategories: [], decidedAt })
  return toStatus('skipped', availability, [], decidedAt)
}
