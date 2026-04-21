import { useEffect, useMemo, useRef, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { api } from './api'
import type { BirdseyeSettings, GlobalLiveSessionSummary } from './types'

function getActiveSessionKey(pathname: string): string | null {
  const sessionMatch = matchPath('/workspace/:workspaceId/sessions/:viewerId', pathname)
  if (sessionMatch?.params.workspaceId && sessionMatch?.params.viewerId) {
    return `${sessionMatch.params.workspaceId}:${sessionMatch.params.viewerId}`
  }

  return null
}

function shouldNotifyForSession(options: {
  settings: BirdseyeSettings
  activeSessionKey: string | null
  summaryKey: string
}): boolean {
  const { settings, activeSessionKey, summaryKey } = options

  if (!settings.notifyOnWorkComplete) return false

  // Default behavior: only notify when you are not viewing that exact session.
  const onlyWhenNotViewing = settings.notifyOnlyWhenNotViewing ?? true
  if (!onlyWhenNotViewing) return true

  // If you're currently looking at it and the tab is visible, skip.
  if (activeSessionKey === summaryKey && typeof document !== 'undefined' && !document.hidden) {
    return false
  }

  return true
}

function sendBrowserNotification(summary: GlobalLiveSessionSummary) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const sessionLabel = summary.sessionName?.trim() || 'Session'
  const notification = new Notification("Bird's Eye — ready", {
    body: `${sessionLabel} in ${summary.workspaceName} finished working.`,
    icon: '/birds-eye-sketch.png',
  })

  notification.onclick = () => {
    try {
      window.focus()
      window.location.href = `/workspace/${summary.workspaceId}/sessions/${summary.viewerId}`
    } catch {
      // ignore
    }
  }
}

export function WorkCompleteNotifier() {
  const location = useLocation()

  const activeSessionKey = useMemo(
    () => getActiveSessionKey(location.pathname),
    [location.pathname],
  )

  const [settings, setSettings] = useState<BirdseyeSettings>({})
  const previousStreamingRef = useRef<Map<string, boolean>>(new Map())
  const hydratedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    api.getSettings()
      .then((value) => {
        if (!cancelled) setSettings(value)
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      api.getSettings().then(setSettings).catch(() => null)
    }

    window.addEventListener('birdseye-settings-changed', handler)
    return () => window.removeEventListener('birdseye-settings-changed', handler)
  }, [])

  useEffect(() => {
    if (!settings.notifyOnWorkComplete) {
      previousStreamingRef.current = new Map()
      hydratedRef.current = false
      return
    }

    let stopped = false

    const poll = async () => {
      try {
        const summaries = await api.getGlobalLiveSessionSummaries()
        if (stopped) return

        const nextMap = new Map<string, boolean>()
        for (const summary of summaries) {
          const key = `${summary.workspaceId}:${summary.viewerId}`
          nextMap.set(key, Boolean(summary.isStreaming))

          const wasStreaming = previousStreamingRef.current.get(key)
          const isStreaming = Boolean(summary.isStreaming)

          if (hydratedRef.current && wasStreaming === true && isStreaming === false) {
            if (shouldNotifyForSession({ settings, activeSessionKey, summaryKey: key })) {
              sendBrowserNotification(summary)
            }
          }
        }

        previousStreamingRef.current = nextMap
        hydratedRef.current = true
      } catch {
        // ignore polling failures
      }
    }

    void poll()
    const timer = window.setInterval(poll, 4000)

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [settings, activeSessionKey])

  return null
}
