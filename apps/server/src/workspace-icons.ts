import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { BIRDSEYE_HOME, ensureDir } from './config.js'

const ICONS_DIR = join(BIRDSEYE_HOME, 'workspace-icons')

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export interface WorkspaceIconMeta {
  path: string
  mime: string
  updatedAt: string
}

function iconPath(workspaceId: string, ext: string): string {
  ensureDir(ICONS_DIR)
  return join(ICONS_DIR, `${workspaceId}.${ext}`)
}

export async function getWorkspaceIconMeta(workspaceId: string): Promise<WorkspaceIconMeta | null> {
  for (const ext of Object.keys(EXT_MIME)) {
    const path = iconPath(workspaceId, ext)
    if (!existsSync(path)) continue

    try {
      const stats = await stat(path)
      return {
        path,
        mime: EXT_MIME[ext] ?? 'application/octet-stream',
        updatedAt: stats.mtime.toISOString(),
      }
    } catch {
      // File disappeared between existsSync + stat.
      continue
    }
  }

  return null
}

export function getWorkspaceIconMetaSync(workspaceId: string): { path: string; mime: string } | null {
  for (const ext of Object.keys(EXT_MIME)) {
    const path = iconPath(workspaceId, ext)
    if (!existsSync(path)) continue
    return { path, mime: EXT_MIME[ext] ?? 'application/octet-stream' }
  }

  return null
}

export function deleteWorkspaceIcon(workspaceId: string): boolean {
  let removed = false
  for (const ext of Object.keys(EXT_MIME)) {
    const path = iconPath(workspaceId, ext)
    if (!existsSync(path)) continue

    try {
      rmSync(path)
      removed = true
    } catch {
      // ignore
    }
  }
  return removed
}

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Icon payload must be a base64 data URL')
  }

  const mime = match[1] ?? ''
  const base64 = match[2] ?? ''

  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length === 0) {
    throw new Error('Icon payload was empty')
  }

  return { mime, bytes }
}

export function saveWorkspaceIconFromDataUrl(workspaceId: string, dataUrl: string): { mime: string; bytesWritten: number } {
  const { mime, bytes } = parseDataUrl(dataUrl)

  const ext = MIME_EXT[mime]
  if (!ext) {
    throw new Error('Unsupported icon type. Please upload a PNG, JPG, WebP, or GIF.')
  }

  // Keep this conservative; we're storing it inline in JSON.
  const maxBytes = 2_500_000
  if (bytes.length > maxBytes) {
    throw new Error('Icon is too large (max 2.5MB).')
  }

  // Ensure only one icon exists.
  deleteWorkspaceIcon(workspaceId)

  const path = iconPath(workspaceId, ext)
  writeFileSync(path, bytes)

  return { mime, bytesWritten: bytes.length }
}
