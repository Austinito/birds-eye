import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { ThemeToggle } from '../components/ThemeToggle'
import type { BirdseyeSettings, ModelOption, ThinkingLevel, Workspace } from '../types'

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

function normalizeWorkspaceSelection(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function normalizeModelKeySelection(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function normalizeThinkingSelection(value: string): ThinkingLevel | undefined {
  const trimmed = value.trim()
  return (THINKING_LEVELS as string[]).includes(trimmed) ? (trimmed as ThinkingLevel) : undefined
}

export function SettingsPage() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.title = "Settings - Bird's Eye"
  }, [])

  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [settings, setSettings] = useState<BirdseyeSettings>({})
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])

  const [defaultWorkspace, setDefaultWorkspace] = useState<string>('')
  const [defaultModelKey, setDefaultModelKey] = useState<string>('')
  const [defaultThinkingLevel, setDefaultThinkingLevel] = useState<string>('')

  const [notifyOnWorkComplete, setNotifyOnWorkComplete] = useState(false)
  const [notifyOnlyWhenNotViewing, setNotifyOnlyWhenNotViewing] = useState(true)

  const selectedModel = useMemo(
    () => modelOptions.find((option) => option.key === defaultModelKey) ?? null,
    [modelOptions, defaultModelKey],
  )

  const availableThinkingLevels = useMemo<ThinkingLevel[]>(() => {
    if (!selectedModel) return THINKING_LEVELS
    return selectedModel.reasoning ? THINKING_LEVELS : ['off']
  }, [selectedModel])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setSuccess('')

    Promise.all([
      api.getSettings(),
      api.getWorkspaces(),
      api.getAvailableModels(),
    ])
      .then(([settingsResponse, workspacesResponse, modelsResponse]) => {
        if (cancelled) return
        setSettings(settingsResponse)
        setWorkspaces(workspacesResponse)
        setModelOptions(modelsResponse)

        setDefaultWorkspace(settingsResponse.defaultWorkspace ?? '')
        setDefaultModelKey(settingsResponse.defaultModelKey ?? '')
        setDefaultThinkingLevel(settingsResponse.defaultThinkingLevel ?? '')

        setNotifyOnWorkComplete(Boolean(settingsResponse.notifyOnWorkComplete))
        setNotifyOnlyWhenNotViewing(settingsResponse.notifyOnlyWhenNotViewing ?? true)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Keep thinking level valid when model selection changes.
    if (selectedModel && !selectedModel.reasoning) {
      if (defaultThinkingLevel !== 'off') {
        setDefaultThinkingLevel('off')
      }
      return
    }

    if (selectedModel?.reasoning) {
      if (defaultThinkingLevel && !availableThinkingLevels.includes(defaultThinkingLevel as ThinkingLevel)) {
        setDefaultThinkingLevel('medium')
      }
    }
  }, [selectedModel, defaultThinkingLevel, availableThinkingLevels])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload: BirdseyeSettings = {
        ...settings,
        defaultWorkspace: normalizeWorkspaceSelection(defaultWorkspace),
        defaultModelKey: normalizeModelKeySelection(defaultModelKey),
        defaultThinkingLevel: normalizeThinkingSelection(defaultThinkingLevel),
        notifyOnWorkComplete,
        notifyOnlyWhenNotViewing,
      }

      const saved = await api.saveSettings(payload)
      setSettings(saved)
      setDefaultWorkspace(saved.defaultWorkspace ?? '')
      setDefaultModelKey(saved.defaultModelKey ?? '')
      setDefaultThinkingLevel(saved.defaultThinkingLevel ?? '')
      setNotifyOnWorkComplete(Boolean(saved.notifyOnWorkComplete))
      setNotifyOnlyWhenNotViewing(saved.notifyOnlyWhenNotViewing ?? true)
      setSuccess('Saved')
      window.dispatchEvent(new Event('birdseye-settings-changed'))

      setTimeout(() => setSuccess(''), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-shell page-center">
        <div className="loading-card card">Loading settings…</div>
      </main>
    )
  }

  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window

  const requestNotificationPermission = async () => {
    if (!notificationsSupported) return
    try {
      await Notification.requestPermission()
    } catch {
      // ignore
    }
  }

  const handleNotifyToggle = (checked: boolean) => {
    setNotifyOnWorkComplete(checked)
    if (checked) {
      void requestNotificationPermission()
    }
  }

  return (
    <main className="page-shell home-shell">
      <div className="home-header">
        <div className="home-title-wrap">
          <img className="home-title-icon" src="/birds-eye-sketch.png" alt="" aria-hidden="true" />
          <h1>Settings</h1>
        </div>
        <ThemeToggle />
      </div>

      <div className="card settings-card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Bird's Eye</div>
            <h2>Preferences</h2>
          </div>

          <div className="button-row">
            <button className="button button-secondary" onClick={() => navigate('/')}>Back</button>
            <button className="button button-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error && <div className="error-banner spacer-top-sm">{error}</div>}
        {success && <div className="success-banner spacer-top-sm">{success}</div>}

        <div className="settings-grid spacer-top">
          <label className="settings-field">
            <span className="settings-label">Default workspace</span>
            <select value={defaultWorkspace} onChange={(e) => setDefaultWorkspace(e.target.value)}>
              <option value="">None (stay on home)</option>
              <option value="last">Last opened workspace</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id} disabled={!ws.exists}>
                  {ws.name}{ws.exists ? '' : ' (missing)'}
                </option>
              ))}
            </select>
            <span className="settings-hint muted">
              When set, Bird's Eye will jump to that workspace on launch.
            </span>
          </label>

          <label className="settings-field">
            <span className="settings-label">Default model</span>
            <select value={defaultModelKey} onChange={(e) => setDefaultModelKey(e.target.value)}>
              <option value="">None</option>
              {modelOptions.map((model) => (
                <option key={model.key} value={model.key}>
                  {model.name}
                </option>
              ))}
            </select>
            <span className="settings-hint muted">
              Used when starting a new live session.
            </span>
          </label>

          <label className="settings-field">
            <span className="settings-label">Default thinking level</span>
            <select
              value={defaultThinkingLevel}
              onChange={(e) => setDefaultThinkingLevel(e.target.value)}
              disabled={Boolean(selectedModel && !selectedModel.reasoning)}
            >
              <option value="">None</option>
              {availableThinkingLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <span className="settings-hint muted">
              Reasoning models only. Non-reasoning models use "off".
            </span>
          </label>

          <label className="settings-field">
            <span className="settings-label">Notifications</span>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={notifyOnWorkComplete}
                onChange={(e) => handleNotifyToggle(e.target.checked)}
                disabled={!notificationsSupported}
              />
              <span>Notify me when a live session finishes working</span>
            </label>
            <label className="checkbox-row spacer-top-sm">
              <input
                type="checkbox"
                checked={notifyOnlyWhenNotViewing}
                onChange={(e) => setNotifyOnlyWhenNotViewing(e.target.checked)}
                disabled={!notifyOnWorkComplete}
              />
              <span>Only when I’m not viewing that session</span>
            </label>
            <span className="settings-hint muted">
              Uses browser notifications. You may need to allow notifications for this site.
              {!notificationsSupported ? ' (Not supported in this browser.)' : ''}
            </span>
          </label>
        </div>
      </div>
    </main>
  )
}
