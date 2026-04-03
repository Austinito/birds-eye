import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

export const BIRDSEYE_HOME = join(homedir(), '.birdseye')
export const BIRDSEYE_WORKSPACES_PATH = join(BIRDSEYE_HOME, 'workspaces.json')
export const BIRDSEYE_SETTINGS_PATH = join(BIRDSEYE_HOME, 'settings.json')
export const BIRDSEYE_PI_MIGRATION_PATH = join(BIRDSEYE_HOME, 'pi-migration.json')
export const BIRDSEYE_PI_AGENT_DIR = join(BIRDSEYE_HOME, 'pi-agent')
export const LEGACY_PI_HOME = join(homedir(), '.pi')
export const LEGACY_PI_AGENT_DIR = join(LEGACY_PI_HOME, 'agent')

export function ensureBirdseyeHome(): string {
  if (!existsSync(BIRDSEYE_HOME)) {
    mkdirSync(BIRDSEYE_HOME, { recursive: true })
  }

  return BIRDSEYE_HOME
}

export function ensureDir(path: string): string {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }

  return path
}

export function sanitizeWorkspaceName(name: string): string {
  const normalized = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return normalized || 'workspace'
}

export function defaultWorkspaceNameFromPath(workspacePath: string): string {
  return basename(workspacePath) || workspacePath
}
