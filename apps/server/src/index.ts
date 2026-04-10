import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BIRDSEYE_HOME, LEGACY_PI_HOME, ensureBirdseyeHome } from './config.js'
import { deleteWorkspaceIcon, getWorkspaceIconMetaSync, saveWorkspaceIconFromDataUrl } from './workspace-icons.js'
import { loadBirdseyeSettings, normalizeBirdseyeSettingsPayload, saveBirdseyeSettings } from './birdseye-settings.js'
import { getPiMigrationStatus, runPiMigration, skipPiMigration } from './pi-migration.js'
import {
  createLiveSession,
  getLiveSession,
  getLiveSessionFallbackDetail,
  listAvailableModels,
  listLiveSessionSummaries,
  archiveSession,
  queueLiveSessionMessage,
  generateSessionTitle,
  renameSession,
  sendLiveSessionMessage,
  sendLiveSessionMessageStream,
  startLiveSession,
} from './pi-live-session.js'
import { getWorkspaceSessionDetail, listWorkspaceSessions } from './session-discovery.js'
import { createWorkspace, deleteWorkspace, getWorkspace, listWorkspaces, touchWorkspace } from './workspace-registry.js'

const app = express()
const port = Number(process.env.PORT || 3100)
const __dirname = dirname(fileURLToPath(import.meta.url))
const webDistDir = resolve(__dirname, '../../web/dist')

ensureBirdseyeHome()

app.use(cors())
app.use(express.json({ limit: '8mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/config', (_req, res) => {
  res.json({
    birdsEyeHome: BIRDSEYE_HOME,
    legacyPiHome: LEGACY_PI_HOME,
  })
})

app.get('/api/settings', (_req, res) => {
  res.json(loadBirdseyeSettings() ?? {})
})

app.post('/api/settings', (req, res) => {
  const normalized = normalizeBirdseyeSettingsPayload(req.body)
  if (!normalized.ok) {
    res.status(400).json({ error: normalized.error })
    return
  }

  const current = loadBirdseyeSettings() ?? {}
  const next = {
    ...current,
    ...normalized.value,
  }

  saveBirdseyeSettings(next)
  res.json(next)
})

app.get('/api/browse', async (req, res) => {
  const rawPath = typeof req.query.path === 'string' ? req.query.path : homedir()
  const dir = resolve(rawPath.replace(/^~/, homedir()))

  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const folders = entries
      .filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith('.'))
      .map((entry) => ({
        name: entry.name,
        path: join(dir, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    res.json({ current: dir, folders })
  } catch {
    res.status(400).json({ error: 'Cannot read directory' })
  }
})

app.get('/api/migration/status', (_req, res) => {
  res.json(getPiMigrationStatus())
})

app.post('/api/migration/run', (req, res) => {
  res.json(runPiMigration(req.body?.categories))
})

app.post('/api/migration/skip', (_req, res) => {
  res.json(skipPiMigration())
})

app.get('/api/workspaces', async (_req, res) => {
  res.json(await listWorkspaces())
})

app.get('/api/models', async (_req, res) => {
  try {
    res.json(await listAvailableModels())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load models'
    res.status(400).json({ error: message })
  }
})

app.get('/api/workspaces/:workspaceId/sessions/live', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  try {
    res.json(listLiveSessionSummaries(workspace.path))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load live session summaries'
    res.status(400).json({ error: message })
  }
})

app.post('/api/workspaces', async (req, res) => {
  const path = typeof req.body?.path === 'string' ? req.body.path : ''
  const name = typeof req.body?.name === 'string' ? req.body.name : undefined

  if (!path.trim()) {
    res.status(400).json({ error: 'Path is required' })
    return
  }

  try {
    const workspace = await createWorkspace(path, name)
    res.json(workspace)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create workspace'
    res.status(400).json({ error: message })
  }
})

app.delete('/api/workspaces/:workspaceId', async (req, res) => {
  const removed = await deleteWorkspace(req.params.workspaceId)
  if (!removed) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  res.json({ ok: true })
})

app.get('/api/workspaces/:workspaceId/icon', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const iconMeta = getWorkspaceIconMetaSync(workspace.id)
  if (!iconMeta) {
    res.status(404).json({ error: 'Workspace icon not found' })
    return
  }

  res.setHeader('Content-Type', iconMeta.mime)
  // Icon URLs are cache-busted via iconUpdatedAt.
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.sendFile(iconMeta.path)
})

app.post('/api/workspaces/:workspaceId/icon', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : ''
  if (!dataUrl.trim()) {
    res.status(400).json({ error: 'dataUrl is required' })
    return
  }

  try {
    saveWorkspaceIconFromDataUrl(workspace.id, dataUrl)
    touchWorkspace(workspace.id)
    res.json(await getWorkspace(workspace.id))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save workspace icon'
    res.status(400).json({ error: message })
  }
})

app.delete('/api/workspaces/:workspaceId/icon', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  deleteWorkspaceIcon(workspace.id)
  touchWorkspace(workspace.id)
  res.json(await getWorkspace(workspace.id))
})

app.get('/api/workspaces/:workspaceId', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  touchWorkspace(workspace.id)
  res.json(workspace)
})

app.get('/api/workspaces/:workspaceId/sessions', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  touchWorkspace(workspace.id)
  res.json(await listWorkspaceSessions(workspace.path))
})

app.get('/api/workspaces/:workspaceId/sessions/:viewerId', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const viewerId = req.params.viewerId
  const detail = await getWorkspaceSessionDetail(workspace.path, viewerId)

  if (detail) {
    touchWorkspace(workspace.id)
    res.json(detail)
    return
  }

  const fallback = getLiveSessionFallbackDetail(workspace.path, viewerId)
  if (fallback) {
    touchWorkspace(workspace.id)
    res.json(fallback)
    return
  }

  res.status(404).json({ error: 'Session not found' })
})

app.post('/api/workspaces/:workspaceId/sessions/live', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  try {
    const result = await createLiveSession(workspace.path, req.body ?? {})
    touchWorkspace(workspace.id)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create live session'
    res.status(400).json({ error: message })
  }
})

app.get('/api/workspaces/:workspaceId/sessions/:viewerId/live', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  try {
    const result = await getLiveSession(workspace.path, req.params.viewerId)
    touchWorkspace(workspace.id)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load live session state'
    res.status(400).json({ error: message })
  }
})

app.post('/api/workspaces/:workspaceId/sessions/:viewerId/live', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const detail = await getWorkspaceSessionDetail(workspace.path, req.params.viewerId)
  if (!detail) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    const result = await startLiveSession(workspace.path, req.params.viewerId, req.body ?? {})
    touchWorkspace(workspace.id)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start live session'
    res.status(400).json({ error: message })
  }
})

app.post('/api/workspaces/:workspaceId/sessions/:viewerId/live/queue', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  try {
    const result = await queueLiveSessionMessage(workspace.path, req.params.viewerId, req.body ?? {})
    touchWorkspace(workspace.id)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue live session message'
    res.status(400).json({ error: message })
  }
})

app.post('/api/workspaces/:workspaceId/sessions/:viewerId/live/message/stream', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  try {
    await sendLiveSessionMessageStream(workspace.path, req.params.viewerId, req.body ?? {}, (event) => {
      if (res.writableEnded) {
        return
      }

      res.write(`${JSON.stringify(event)}\n`)
    })
    touchWorkspace(workspace.id)
  } catch {
  } finally {
    if (!res.writableEnded) {
      res.end()
    }
  }
})

app.post('/api/workspaces/:workspaceId/sessions/:viewerId/live/message', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  try {
    const result = await sendLiveSessionMessage(workspace.path, req.params.viewerId, req.body ?? {})
    touchWorkspace(workspace.id)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send live session message'
    res.status(400).json({ error: message })
  }
})

app.post('/api/workspaces/:workspaceId/sessions/:viewerId/rename/auto', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const detail = await getWorkspaceSessionDetail(workspace.path, req.params.viewerId)
  if (!detail) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    const updated = await generateSessionTitle(workspace.path, req.params.viewerId)
    touchWorkspace(workspace.id)
    res.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate session title'
    res.status(400).json({ error: message })
  }
})

app.post('/api/workspaces/:workspaceId/sessions/:viewerId/rename', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const title = typeof req.body?.title === 'string' ? req.body.title : ''
  if (!title.trim()) {
    res.status(400).json({ error: 'Title is required' })
    return
  }

  try {
    const detail = await renameSession(workspace.path, req.params.viewerId, title)
    touchWorkspace(workspace.id)
    res.json(detail)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rename session'
    res.status(400).json({ error: message })
  }
})

app.post('/api/workspaces/:workspaceId/sessions/:viewerId/archive', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const detail = await getWorkspaceSessionDetail(workspace.path, req.params.viewerId)
  if (!detail) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    await archiveSession(workspace.path, req.params.viewerId)
    touchWorkspace(workspace.id)
    res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to archive session'
    res.status(400).json({ error: message })
  }
})

app.post('/api/workspaces/:workspaceId/sessions/archive', async (req, res) => {
  const workspace = await getWorkspace(req.params.workspaceId)
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const viewerIdsRaw = req.body?.viewerIds
  const viewerIds = Array.isArray(viewerIdsRaw)
    ? viewerIdsRaw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []

  if (viewerIds.length === 0) {
    res.status(400).json({ error: 'viewerIds is required' })
    return
  }

  if (viewerIds.length > 500) {
    res.status(400).json({ error: 'Too many sessions requested for archival (max 500).' })
    return
  }

  const archived: string[] = []
  const errors: Array<{ viewerId: string; error: string }> = []

  for (const viewerId of viewerIds) {
    try {
      await archiveSession(workspace.path, viewerId)
      archived.push(viewerId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to archive session'
      errors.push({ viewerId, error: message })
    }
  }

  touchWorkspace(workspace.id)
  res.json({ ok: true, archived, errors })
})

if (existsSync(webDistDir)) {
  app.use(express.static(webDistDir))

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next()
      return
    }

    res.sendFile(join(webDistDir, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`Bird's Eye server listening on http://127.0.0.1:${port}`)
})
