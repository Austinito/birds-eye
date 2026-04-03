import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { FolderEntry } from '../types'

interface Props {
  onSelect: (path: string) => void
  onCancel?: () => void
}

export function FolderBrowser({ onSelect, onCancel }: Props) {
  const [currentPath, setCurrentPath] = useState('')
  const [folders, setFolders] = useState<FolderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const parentPath = useMemo(() => {
    if (!currentPath) return '/'
    return currentPath.split('/').slice(0, -1).join('/') || '/'
  }, [currentPath])

  const browse = async (path?: string) => {
    setLoading(true)
    setError('')
    try {
      const result = await api.browse(path)
      setCurrentPath(result.current)
      setFolders(result.folders)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void browse()
  }, [])

  return (
    <div className="card folder-browser">
      <div className="folder-path">{currentPath || 'Loading…'}</div>

      {error && <div className="error-banner">{error}</div>}

      <div className="folder-list">
        {currentPath && currentPath !== '/' && (
          <button className="folder-row folder-parent" onClick={() => void browse(parentPath)}>
            ..
          </button>
        )}

        {loading ? (
          <div className="empty-state">Loading folders…</div>
        ) : folders.length === 0 ? (
          <div className="empty-state">No subfolders here.</div>
        ) : (
          folders.map((folder) => (
            <button
              className="folder-row"
              key={folder.path}
              onClick={() => void browse(folder.path)}
            >
              <span className="folder-icon">/</span>
              <span>{folder.name}</span>
            </button>
          ))
        )}
      </div>

      <div className="button-row">
        {onCancel && (
          <button className="button button-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="button button-primary"
          onClick={() => onSelect(currentPath)}
          disabled={!currentPath}
        >
          Use this folder
        </button>
      </div>
    </div>
  )
}
