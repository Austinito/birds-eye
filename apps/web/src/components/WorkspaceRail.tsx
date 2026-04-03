import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Workspace } from '../types'

function initials(name: string) {
  const parts = name.split(/[-_.\s]+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function hueFromName(name: string) {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

export function WorkspaceRail() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const stackRef = useRef<HTMLDivElement | null>(null)
  const pillRefs = useRef<Record<string, HTMLAnchorElement | null>>({})

  useEffect(() => {
    api.getWorkspaces().then(setWorkspaces).catch(console.error)
  }, [location.pathname])

  const sortedWorkspaces = useMemo(
    () => [...workspaces]
      .filter((workspace) => workspace.exists)
      .sort((left, right) => left.name.localeCompare(right.name)),
    [workspaces],
  )

  const activeWorkspaceId = useMemo(
    () => sortedWorkspaces.find((workspace) => location.pathname.includes(`/workspace/${workspace.id}`))?.id ?? null,
    [sortedWorkspaces, location.pathname],
  )

  const updateIndicator = useCallback(() => {
    const stack = stackRef.current
    const activePill = activeWorkspaceId ? pillRefs.current[activeWorkspaceId] : null

    if (!stack || !activePill) {
      setIndicatorStyle(null)
      return
    }

    const stackRect = stack.getBoundingClientRect()
    const pillRect = activePill.getBoundingClientRect()
    const left = pillRect.left - stackRect.left - 4
    const top = pillRect.top - stackRect.top - 4

    setIndicatorStyle({
      width: `${pillRect.width + 8}px`,
      height: `${pillRect.height + 8}px`,
      transform: `translate(${left}px, ${top}px)`,
    })
  }, [activeWorkspaceId])

  useLayoutEffect(() => {
    updateIndicator()

    const handleResize = () => updateIndicator()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateIndicator])

  return (
    <aside className="workspace-rail">
      <button className="rail-brand" onClick={() => navigate('/')} title="Bird's Eye home" aria-label="Bird's Eye home">
        <img className="rail-brand-image" src="/birds-eye-sketch.png" alt="Bird's Eye" />
      </button>

      <div className="rail-stack" ref={stackRef}>
        {sortedWorkspaces.map((workspace) => {
          const active = workspace.id === activeWorkspaceId
          const hue = hueFromName(workspace.name)
          return (
            <Link
              className={`rail-pill ${active ? 'rail-pill-active' : ''}`}
              key={workspace.id}
              to={`/workspace/${workspace.id}`}
              title={workspace.path}
              ref={(element) => {
                pillRefs.current[workspace.id] = element
              }}
              aria-current={active ? 'page' : undefined}
              style={{ backgroundColor: `hsl(${hue}, 54%, 44%)` }}
            >
              {initials(workspace.name)}
            </Link>
          )
        })}

        {indicatorStyle && (
          <span aria-hidden className="rail-selection-indicator" style={indicatorStyle} />
        )}
      </div>

      <Link className="rail-add" to="/" title="All workspaces">
        +
      </Link>
    </aside>
  )
}
