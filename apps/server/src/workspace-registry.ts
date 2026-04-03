import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BIRDSEYE_WORKSPACES_PATH, defaultWorkspaceNameFromPath, ensureBirdseyeHome } from './config.js'
import type { WorkspaceRecord } from './types.js'

interface PersistedWorkspaceRecord {
  id: string
  name: string
  path: string
  createdAt: string
  lastOpenedAt?: string
}

function readRegistry(): PersistedWorkspaceRecord[] {
  ensureBirdseyeHome()

  if (!existsSync(BIRDSEYE_WORKSPACES_PATH)) {
    return []
  }

  try {
    const content = readFileSync(BIRDSEYE_WORKSPACES_PATH, 'utf8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRegistry(records: PersistedWorkspaceRecord[]): void {
  ensureBirdseyeHome()
  writeFileSync(BIRDSEYE_WORKSPACES_PATH, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
}

async function toWorkspaceRecord(record: PersistedWorkspaceRecord): Promise<WorkspaceRecord> {
  return {
    ...record,
    exists: existsSync(record.path),
  }
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  const records = readRegistry()
  const workspaces = await Promise.all(records.map(toWorkspaceRecord))

  return workspaces.sort((a, b) => {
    const aTime = a.lastOpenedAt ?? a.createdAt
    const bTime = b.lastOpenedAt ?? b.createdAt
    return bTime.localeCompare(aTime)
  })
}

export async function getWorkspace(id: string): Promise<WorkspaceRecord | null> {
  const record = readRegistry().find((item) => item.id === id)
  if (!record) return null
  return toWorkspaceRecord(record)
}

export async function createWorkspace(inputPath: string, inputName?: string): Promise<WorkspaceRecord> {
  const workspacePath = resolve(inputPath.replace(/^~/, process.env.HOME ?? ''))
  const stats = await stat(workspacePath)

  if (!stats.isDirectory()) {
    throw new Error('Workspace path must be a directory')
  }

  const registry = readRegistry()
  const existing = registry.find((item) => item.path === workspacePath)

  if (existing) {
    const updated: PersistedWorkspaceRecord = {
      ...existing,
      lastOpenedAt: new Date().toISOString(),
    }
    writeRegistry(registry.map((item) => (item.id === existing.id ? updated : item)))
    return toWorkspaceRecord(updated)
  }

  const record: PersistedWorkspaceRecord = {
    id: randomUUID(),
    name: (inputName?.trim() || defaultWorkspaceNameFromPath(workspacePath)).trim(),
    path: workspacePath,
    createdAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
  }

  registry.push(record)
  writeRegistry(registry)
  return toWorkspaceRecord(record)
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  const registry = readRegistry()
  const next = registry.filter((item) => item.id !== id)

  if (next.length === registry.length) {
    return false
  }

  writeRegistry(next)
  return true
}

export function touchWorkspace(id: string): void {
  const registry = readRegistry()
  const next = registry.map((item) => (
    item.id === id
      ? { ...item, lastOpenedAt: new Date().toISOString() }
      : item
  ))
  writeRegistry(next)
}
