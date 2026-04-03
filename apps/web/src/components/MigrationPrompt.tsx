import { useMemo, useState } from 'react'
import type { PiMigrationStatus } from '../types'

interface Props {
  status: PiMigrationStatus
  onMigrate: (categories?: Record<string, boolean>) => Promise<void>
  onSkip: () => Promise<void>
}

const CATEGORY_LABELS: Record<string, string> = {
  settings: 'settings + keybindings',
  auth: 'auth credentials',
  resources: 'skills, extensions, prompts, themes',
  context: 'AGENTS/SYSTEM context files',
}

export function MigrationPrompt({ status, onMigrate, onSkip }: Props) {
  const availableCategories = useMemo(
    () => Object.entries(status.available).filter(([, value]) => value).map(([key]) => key),
    [status.available],
  )

  const [selection, setSelection] = useState<Record<string, boolean>>(
    Object.fromEntries(availableCategories.map((key) => [key, true])),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleMigrate = async () => {
    setLoading(true)
    setError('')
    try {
      await onMigrate(selection)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    setLoading(true)
    setError('')
    try {
      await onSkip()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card migration-card">
      <div className="eyebrow">Pi migration</div>
      <h2>Import your existing Pi config into Bird's Eye</h2>
      <p className="muted">
        Bird's Eye found a legacy Pi home and can copy the parts you care about into{' '}
        <code>{status.targetDir}</code>.
      </p>

      <div className="migration-grid">
        {availableCategories.map((key) => (
          <label className="checkbox-row" key={key}>
            <input
              type="checkbox"
              checked={selection[key] ?? false}
              onChange={(event) => {
                setSelection((prev) => ({
                  ...prev,
                  [key]: event.target.checked,
                }))
              }}
            />
            <span>{CATEGORY_LABELS[key] || key}</span>
          </label>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="button-row">
        <button className="button button-primary" onClick={handleMigrate} disabled={loading}>
          {loading ? 'Migrating…' : 'Migrate selected'}
        </button>
        <button className="button button-secondary" onClick={handleSkip} disabled={loading}>
          Skip for now
        </button>
      </div>
    </section>
  )
}
