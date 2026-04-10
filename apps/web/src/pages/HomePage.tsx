import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { FolderBrowser } from '../components/FolderBrowser'
import { MigrationPrompt } from '../components/MigrationPrompt'
import { GearIcon } from '../components/icons'
import { ThemeToggle } from '../components/ThemeToggle'
import type { BirdseyeSettings, PiMigrationStatus, Workspace } from '../types'

export function HomePage() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.title = "Bird's Eye"
  }, [])

  const navigate = useNavigate()
  const [migrationStatus, setMigrationStatus] = useState<PiMigrationStatus | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [settings, setSettings] = useState<BirdseyeSettings | null>(null)
  const [autoOpened, setAutoOpened] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [migrationResponse, workspacesResponse, settingsResponse] = await Promise.all([
        api.getMigrationStatus(),
        api.getWorkspaces(),
        api.getSettings(),
      ])
      setMigrationStatus(migrationResponse)
      setWorkspaces(workspacesResponse)
      setSettings(settingsResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const autoOpenTarget = useMemo(() => {
    if (!settings?.defaultWorkspace) return null
    if (settings.defaultWorkspace === 'last') {
      const last = workspaces.find((ws) => ws.exists)
      return last?.id ?? null
    }

    const match = workspaces.find((ws) => ws.id === settings.defaultWorkspace && ws.exists)
    return match?.id ?? null
  }, [settings?.defaultWorkspace, workspaces])

  useEffect(() => {
    if (autoOpened) return
    if (!autoOpenTarget) return
    if (migrationStatus?.state === 'pending') return
    if (showBrowser) return

    setAutoOpened(true)
    navigate(`/workspace/${autoOpenTarget}`)
  }, [autoOpened, autoOpenTarget, migrationStatus?.state, navigate, showBrowser])

  const handleCreateWorkspace = async (path: string) => {
    setCreating(true)
    try {
      const workspace = await api.createWorkspace(path)
      navigate(`/workspace/${workspace.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    const confirmed = window.confirm(`Delete workspace “${workspace.name}”?`)
    if (!confirmed) return

    setDeletingWorkspaceId(workspace.id)
    setError('')
    try {
      await api.deleteWorkspace(workspace.id)
      setWorkspaces((current) => current.filter((item) => item.id !== workspace.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeletingWorkspaceId(null)
    }
  }

  if (loading) {
    return (
      <main className="page-shell page-center">
        <div className="loading-card card">Loading Bird's Eye…</div>
      </main>
    )
  }

  return (
    <main className="page-shell home-shell">
      <div className="home-header">
        <div className="home-title-wrap">
          <img className="home-title-icon" src="/birds-eye-sketch.png" alt="" aria-hidden="true" />
          <h1>Bird's Eye</h1>
        </div>

        <div className="home-header-actions">
          <button
            className="icon-button"
            onClick={() => navigate('/settings')}
            title="Settings"
            aria-label="Settings"
            type="button"
          >
            <GearIcon className="icon" />
          </button>
          <ThemeToggle />
        </div>
      </div>

      {migrationStatus?.state === 'pending' && (
        <MigrationPrompt
          status={migrationStatus}
          onMigrate={async (selection) => {
            const next = await api.runMigration(selection)
            setMigrationStatus(next)
          }}
          onSkip={async () => {
            const next = await api.skipMigration()
            setMigrationStatus(next)
          }}
        />
      )}

      {error && <div className="error-banner global-error">{error}</div>}

      <section className="home-workspaces">
        <div className="section-header">
          <h2>Workspaces:</h2>
        </div>

        <div className="workspace-list">
          {workspaces.length === 0 ? (
            <div className="empty-state empty-state-large">
              No workspaces yet. Add a repo folder to start browsing sessions.
            </div>
          ) : (
            workspaces.map((workspace) => (
              <div className="workspace-card-shell" key={workspace.id}>
                <button
                  className={`workspace-card ${workspace.exists ? '' : 'workspace-card-missing'}`}
                  onClick={() => {
                    if (!workspace.exists) return
                    navigate(`/workspace/${workspace.id}`)
                  }}
                  disabled={!workspace.exists}
                  title={workspace.exists ? workspace.path : 'Workspace folder is missing. Delete this workspace entry.'}
                >
                  <div>
                    <strong>{workspace.name}</strong>
                    <div className="muted workspace-path">{workspace.path}</div>
                    {!workspace.exists && <div className="workspace-card-warning">Workspace folder is missing</div>}
                  </div>
                </button>

                <button
                  className={`workspace-delete-button ${workspace.exists ? '' : 'workspace-delete-button-visible'}`}
                  onClick={() => void handleDeleteWorkspace(workspace)}
                  aria-label={`Delete ${workspace.name}`}
                  title={`Delete ${workspace.name}`}
                  disabled={deletingWorkspaceId === workspace.id}
                >
                  ×
                </button>
              </div>
            ))
          )}

          {showBrowser ? (
            <div className="workspace-add-panel">
              <FolderBrowser onSelect={handleCreateWorkspace} onCancel={() => setShowBrowser(false)} />
              {creating && <p className="muted spacer-top-sm">Registering workspace…</p>}
            </div>
          ) : (
            <button
              className="workspace-add-card"
              onClick={() => setShowBrowser(true)}
              title="Add workspace"
              aria-label="Add workspace"
            >
              <span className="workspace-add-icon">+</span>
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
