import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { ThemeToggle } from '../components/ThemeToggle'
import { WorkspaceRail } from '../components/WorkspaceRail'
import { AgentIcon, ArchiveIcon, ArrowRightIcon, BrainIcon, CacheReadIcon, CacheWriteIcon, DoneIcon, GearIcon, SpinnerIcon, SystemIcon, TokenInIcon, TokenOutIcon, ToolErrIcon, ToolOkIcon, UserIcon } from '../components/icons'
import type { BirdseyeSettings, LiveSessionState, LiveSessionSummary, ModelOption, SessionDetail, SessionEntryView, SessionSummary, ThinkingLevel, Workspace } from '../types'

const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'medium'
const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']
const NEW_SESSION_DRAFT_SCOPE = '__new__'
const LIVE_ASSISTANT_ENTRY_PREFIX = '__live-assistant__:'
const LIVE_EVENT_ENTRY_PREFIX = '__live-event__:'

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function roleClass(role: string) {
  switch (role) {
    case 'user':
      return 'entry-user'
    case 'assistant':
      return 'entry-assistant'
    case 'thinking':
      return 'entry-thinking'
    case 'toolResult':
      return 'entry-tool'
    default:
      return 'entry-system'
  }
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatCost(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value)
}

function getDraftStorageKey(workspaceId?: string, viewerId?: string) {
  if (!workspaceId) return null
  return `birds-eye:session-draft:${workspaceId}:${viewerId ?? NEW_SESSION_DRAFT_SCOPE}`
}

function readStoredDraft(key: string) {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(key) ?? ''
}

function writeStoredDraft(key: string, value: string) {
  if (typeof window === 'undefined') return

  if (value.trim()) {
    window.localStorage.setItem(key, value)
  } else {
    window.localStorage.removeItem(key)
  }
}

function createOptimisticRuntime(runtime: LiveSessionState | null, modelKey: string, thinkingLevel: ThinkingLevel): LiveSessionState {
  return {
    active: true,
    isStreaming: true,
    modelKey: modelKey || runtime?.modelKey || '',
    thinkingLevel,
    availableThinkingLevels: runtime?.availableThinkingLevels?.length ? runtime.availableThinkingLevels : THINKING_LEVELS,
    steeringMessages: runtime?.steeringMessages ?? [],
    followUpMessages: runtime?.followUpMessages ?? [],
  }
}

function appendOptimisticPrompt(detail: SessionDetail, message: string, assistantEntryId: string): SessionDetail {
  const timestamp = new Date().toISOString()

  return {
    ...detail,
    updatedAt: timestamp,
    entries: [
      ...detail.entries,
      {
        id: `${assistantEntryId}:user`,
        entryType: 'message',
        role: 'user',
        text: message,
        timestamp,
      },
      {
        id: assistantEntryId,
        entryType: 'message',
        role: 'assistant',
        text: '',
        timestamp,
      },
    ],
  }
}

function appendAssistantDelta(detail: SessionDetail, assistantEntryId: string, delta: string): SessionDetail {
  return {
    ...detail,
    entries: detail.entries.map((entry) => (
      entry.id === assistantEntryId
        ? { ...entry, text: `${entry.text}${delta}` }
        : entry
    )),
  }
}

function appendLiveEventEntry(detail: SessionDetail, text: string, role: SessionEntryView['role'] = 'system'): SessionDetail {
  const timestamp = new Date().toISOString()

  return {
    ...detail,
    updatedAt: timestamp,
    entries: [
      ...detail.entries,
      {
        id: `${LIVE_EVENT_ENTRY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`,
        entryType: 'custom',
        role,
        text,
        timestamp,
      },
    ],
  }
}

function SessionEntryBody({ text, defaultExpanded = false }: { text: string; defaultExpanded?: boolean }) {
  const contentRef = useRef<HTMLPreElement | null>(null)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    setExpanded(defaultExpanded)
  }, [defaultExpanded, text])

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) return
    setOverflowing(element.scrollHeight > 240)
  }, [text])

  return (
    <div className="session-entry-body-wrap">
      <pre
        className={`session-entry-body ${overflowing && !expanded ? 'session-entry-body-collapsed' : ''}`}
        ref={contentRef}
      >
        {text}
      </pre>
      {overflowing && (
        <button className="session-entry-toggle" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </div>
  )
}

function SessionEntry({ entry, defaultExpanded = false }: { entry: SessionEntryView; defaultExpanded?: boolean }) {
  return (
    <article className={`session-entry ${roleClass(entry.role)}`} data-role={entry.role}>
      <div className="session-entry-header">
        <span className="session-entry-role" title={entry.role}>
          {entry.role === 'user' && <UserIcon className="icon icon-role" />}
          {entry.role === 'assistant' && <AgentIcon className="icon icon-role" />}
          {entry.role === 'thinking' && <BrainIcon className="icon icon-role" />}
          {entry.role === 'system' && <SystemIcon className="icon icon-role" />}
          {entry.role === 'toolResult' && <ToolOkIcon className="icon icon-role" />}
          {entry.role}
        </span>
        {entry.timestamp && <span className="session-entry-time">{formatDate(entry.timestamp)}</span>}
      </div>
      <SessionEntryBody text={entry.text} defaultExpanded={defaultExpanded} />
    </article>
  )
}

export function WorkspacePage() {
  const { workspaceId, viewerId } = useParams()
  const navigate = useNavigate()
  const entryListRef = useRef<HTMLDivElement | null>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const activeWorkspaceIdRef = useRef<string | undefined>(workspaceId)
  const activeViewerIdRef = useRef<string | undefined>(viewerId)
  const selectedSessionRef = useRef<SessionDetail | null>(null)
  const runtimeRef = useRef<LiveSessionState | null>(null)
  const composerTextRef = useRef('')
  const lastDraftKeyRef = useRef<string | null>(null)

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [settings, setSettings] = useState<BirdseyeSettings | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null)
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [runtime, setRuntime] = useState<LiveSessionState | null>(null)
  const [liveSessionSummaries, setLiveSessionSummaries] = useState<LiveSessionSummary[]>([])
  const [composerText, setComposerText] = useState('')
  const [composerHeight, setComposerHeight] = useState<number | null>(null)
  const [selectedModelKey, setSelectedModelKey] = useState('')
  const [selectedThinkingLevel, setSelectedThinkingLevel] = useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showThinkingMenu, setShowThinkingMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [composerActionLoading, setComposerActionLoading] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [error, setError] = useState('')
  const [renamingSession, setRenamingSession] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)

  const [liveThinkingText, setLiveThinkingText] = useState('')

  const [thinkingExpandedByDefault, setThinkingExpandedByDefault] = useState(false)
  const [toolOutputsExpandedByDefault, setToolOutputsExpandedByDefault] = useState(false)
  const [shortcutToast, setShortcutToast] = useState<{ id: number; message: string } | null>(null)
  const [showHotkeyHelp, setShowHotkeyHelp] = useState(false)
  const [liveToolCalls, setLiveToolCalls] = useState<Array<{
    toolCallId: string
    toolName: string
    input?: Record<string, unknown>
    output: string
    isComplete: boolean
    isError: boolean
    result?: string
  }>>([])

  const composerHistoryRef = useRef<{
    index: number
    draftBeforeHistory: string
    messages: string[]
  }>({
    index: -1,
    draftBeforeHistory: '',
    messages: [],
  })

  const selectionTouchedRef = useRef(false)

  const draftKey = useMemo(() => getDraftStorageKey(workspaceId, viewerId), [workspaceId, viewerId])

  const selectedSummary = useMemo(
    () => sessions.find((session) => session.viewerId === viewerId) ?? null,
    [sessions, viewerId],
  )

  const liveSummaryMap = useMemo(() => {
    const map = new Map<string, LiveSessionSummary>()
    for (const summary of liveSessionSummaries) {
      map.set(summary.viewerId, summary)
    }
    return map
  }, [liveSessionSummaries])

  useEffect(() => {
    if (!selectedSession) {
      setRenamingSession(false)
      setRenameValue('')
      return
    }

    if (!renamingSession) {
      setRenameValue(selectedSession.title)
    }
  }, [selectedSession, renamingSession])

  const applySessionRename = (detail: SessionDetail) => {
    setSelectedSession(detail)
    setSessions((prev) =>
      prev.map((session) => (session.viewerId === detail.viewerId ? { ...session, title: detail.title } : session)),
    )
  }

  const MAX_SESSION_TITLE_LENGTH = 36

  const commitRename = async () => {
    if (!workspaceId || !selectedSession || renameLoading) return
    const nextTitle = renameValue.trim().slice(0, MAX_SESSION_TITLE_LENGTH)
    if (!nextTitle) {
      setRenamingSession(false)
      setRenameValue(selectedSession.title)
      return
    }

    if (nextTitle === selectedSession.title) {
      setRenamingSession(false)
      return
    }

    try {
      setRenameLoading(true)
      const detail = await api.renameSession(workspaceId, selectedSession.viewerId, { title: nextTitle })
      applySessionRename(detail)
      setRenamingSession(false)
    } catch (renameError) {
      const message = renameError instanceof Error ? renameError.message : 'Failed to rename session'
      setError(message)
    } finally {
      setRenameLoading(false)
    }
  }

  const generateTitle = async () => {
    if (!workspaceId || !selectedSession || renameLoading) return

    setError('')
    try {
      setRenameLoading(true)
      const detail = await api.generateSessionTitle(workspaceId, selectedSession.viewerId)
      applySessionRename(detail)
      setRenamingSession(false)
      setRenameValue(detail.title)
    } catch (renameError) {
      const message = renameError instanceof Error ? renameError.message : 'Failed to generate session title'
      setError(message)
    } finally {
      setRenameLoading(false)
    }
  }

  const commitArchive = async () => {
    if (!workspaceId || !selectedSession || archiveLoading) return

    const confirmed = window.confirm(`Archive session “${selectedSession.title}”?`)
    if (!confirmed) return

    try {
      setArchiveLoading(true)
      await api.archiveSession(workspaceId, selectedSession.viewerId)
      clearDraftByKey(getDraftStorageKey(workspaceId, selectedSession.viewerId))
      setSessions((prev) => prev.filter((session) => session.viewerId !== selectedSession.viewerId))
      setLiveSessionSummaries((prev) => prev.filter((summary) => summary.viewerId !== selectedSession.viewerId))
      setSelectedSession(null)
      setRuntime(null)
      setRenamingSession(false)
      setRenameValue('')
      navigate(`/workspace/${workspaceId}`)
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : 'Failed to archive session'
      setError(message)
    } finally {
      setArchiveLoading(false)
    }
  }

  const selectedSessionStats = useMemo(() => {
    if (!selectedSession) return null

    const stats = selectedSession.entries.reduce((stats, entry) => {
      if (entry.role === 'user') stats.userMessages += 1
      else if (entry.role === 'assistant') stats.assistantMessages += 1
      else if (entry.role === 'system' || entry.role === 'session') stats.systemMessages += 1

      if (entry.role === 'toolResult') {
        if (entry.metadata?.isError) stats.toolFailures += 1
        else stats.toolSuccesses += 1
      }

      stats.inputTokens += typeof entry.metadata?.usageInput === 'number' ? entry.metadata.usageInput : 0
      stats.outputTokens += typeof entry.metadata?.usageOutput === 'number' ? entry.metadata.usageOutput : 0
      stats.cacheReadTokens += typeof entry.metadata?.usageCacheRead === 'number' ? entry.metadata.usageCacheRead : 0
      stats.cacheWriteTokens += typeof entry.metadata?.usageCacheWrite === 'number' ? entry.metadata.usageCacheWrite : 0
      stats.totalTokens += typeof entry.metadata?.usageTotalTokens === 'number' ? entry.metadata.usageTotalTokens : 0
      stats.totalCost += typeof entry.metadata?.usageCostTotal === 'number' ? entry.metadata.usageCostTotal : 0

      return stats
    }, {
      userMessages: 0,
      assistantMessages: 0,
      systemMessages: 0,
      toolSuccesses: 0,
      toolFailures: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      totalCost: 0,
    })

    return {
      ...stats,
      promptResponseTokens: stats.inputTokens + stats.outputTokens,
      allUsageTokens: stats.totalTokens,
    }
  }, [selectedSession])

  const selectedModel = useMemo(
    () => modelOptions.find((option) => option.key === selectedModelKey) ?? null,
    [modelOptions, selectedModelKey],
  )

  const sessionStatus = composerActionLoading
    ? 'Starting…'
    : runtime?.isStreaming
      ? 'Working'
      : runtime
        ? 'Ready'
        : selectedSession
          ? 'Paused'
          : 'New'

  const queueSummary = useMemo(() => {
    if (!runtime) return null

    const pendingCount = runtime.steeringMessages.length + runtime.followUpMessages.length
    if (pendingCount === 0) return null

    return {
      pendingCount,
      steeringMessages: runtime.steeringMessages,
      followUpMessages: runtime.followUpMessages,
    }
  }, [runtime])

  const clearDraftByKey = (targetDraftKey: string | null) => {
    if (!targetDraftKey) return
    writeStoredDraft(targetDraftKey, '')
    if (draftKey === targetDraftKey) {
      setComposerText('')
    }
  }

  const maybeScrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    requestAnimationFrame(() => {
      const element = entryListRef.current
      if (!element) return

      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
      if (distanceFromBottom <= 120) {
        element.scrollTo({ top: element.scrollHeight, behavior })
        setShowScrollToBottom(false)
      }
    })
  }

  const isViewingSession = (targetViewerId: string) => selectedSessionRef.current?.viewerId === targetViewerId

  const loadSessions = async (targetWorkspaceId: string) => {
    const sessionsResponse = await api.getSessions(targetWorkspaceId)
    setSessions(sessionsResponse)
    return sessionsResponse
  }

  const loadWorkspace = async () => {
    if (!workspaceId) return

    setLoading(true)
    setError('')
    try {
      const [workspaceResponse, sessionsResponse, modelOptionsResponse, settingsResponse] = await Promise.all([
        api.getWorkspace(workspaceId),
        api.getSessions(workspaceId),
        api.getAvailableModels(),
        api.getSettings(),
      ])
      setWorkspace(workspaceResponse)
      setSessions(sessionsResponse)
      setModelOptions(modelOptionsResponse)
      setSettings(settingsResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    activeWorkspaceIdRef.current = workspaceId
    activeViewerIdRef.current = viewerId
  }, [workspaceId, viewerId])

  useEffect(() => {
    selectedSessionRef.current = selectedSession
  }, [selectedSession])

  useEffect(() => {
    runtimeRef.current = runtime
  }, [runtime])

  useEffect(() => {
    composerTextRef.current = composerText
  }, [composerText])

  useEffect(() => {
    void loadWorkspace()
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId) {
      setLiveSessionSummaries([])
      return
    }

    let stopped = false
    const fetchSummaries = async () => {
      try {
        const summaries = await api.getLiveSessionSummaries(workspaceId)
        if (!stopped) {
          setLiveSessionSummaries(summaries)
        }
      } catch {
        if (!stopped) {
          setLiveSessionSummaries([])
        }
      }
    }

    void fetchSummaries()
    const timer = window.setInterval(fetchSummaries, 4000)

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId || !viewerId) {
      setSelectedSession(null)
      setRuntime(null)
      setDetailLoading(false)
      setLiveThinkingText('')
      setLiveToolCalls([])
      setError('')
      return
    }

    const alreadyHydrated = selectedSessionRef.current?.viewerId === viewerId

    // Don’t clobber UI state if we already have a hydrated session (e.g. we just created it
    // and navigated to the new viewerId). Still refresh in the background.
    if (!alreadyHydrated) {
      setDetailLoading(true)
      setRuntime(null)
      setLiveThinkingText('')
      setLiveToolCalls([])
    } else {
      setDetailLoading(false)
    }

    setError('')

    Promise.all([
      api.getSession(workspaceId, viewerId),
      api.getLiveSession(workspaceId, viewerId),
    ])
      .then(([detail, live]) => {
        if (activeWorkspaceIdRef.current !== workspaceId || activeViewerIdRef.current !== viewerId) {
          return
        }

        // If the session is currently streaming and we already have entries, avoid overwriting
        // the optimistic/live view with a stale disk snapshot.
        const shouldPreserve = Boolean(runtimeRef.current?.isStreaming)
          && selectedSessionRef.current?.viewerId === viewerId
          && (selectedSessionRef.current?.entries.length ?? 0) > 0

        if (!shouldPreserve) {
          setSelectedSession(detail)
        }

        setRuntime(live.runtime.active ? live.runtime : null)
      })
      .catch((err) => {
        if (activeWorkspaceIdRef.current === workspaceId && activeViewerIdRef.current === viewerId) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (activeWorkspaceIdRef.current === workspaceId && activeViewerIdRef.current === viewerId) {
          setDetailLoading(false)
        }
      })
  }, [workspaceId, viewerId])

  useEffect(() => {
    if (!draftKey) {
      lastDraftKeyRef.current = null
      setComposerText('')
      return
    }

    if (lastDraftKeyRef.current === draftKey) {
      return
    }

    if (lastDraftKeyRef.current) {
      writeStoredDraft(lastDraftKeyRef.current, composerTextRef.current)
    }

    setComposerText(readStoredDraft(draftKey))
    lastDraftKeyRef.current = draftKey
  }, [draftKey])

  useEffect(() => {
    if (!draftKey || lastDraftKeyRef.current !== draftKey) return
    writeStoredDraft(draftKey, composerText)
  }, [composerText, draftKey])

  useEffect(() => {
    if (runtime?.modelKey) {
      setSelectedModelKey((current) => {
        if (!current) return runtime.modelKey
        const hasCurrent = modelOptions.some((option) => option.key === current)
        if (!hasCurrent) return runtime.modelKey
        return current
      })
      return
    }

    if (selectedModelKey) {
      const stillAvailable = modelOptions.some((option) => option.key === selectedModelKey)
      if (stillAvailable) {
        return
      }
    }

    if (selectedSession?.provider && selectedSession?.model) {
      setSelectedModelKey(`${selectedSession.provider}/${selectedSession.model}`)
      return
    }

    if (!selectedModelKey && settings?.defaultModelKey) {
      const exists = modelOptions.some((option) => option.key === settings.defaultModelKey)
      if (exists) {
        setSelectedModelKey(settings.defaultModelKey)
        if (!selectionTouchedRef.current && settings.defaultThinkingLevel) {
          setSelectedThinkingLevel(settings.defaultThinkingLevel)
        }
        return
      }
    }

    if (modelOptions.length > 0 && !selectedModelKey) {
      setSelectedModelKey(modelOptions[0].key)
    }
  }, [
    runtime?.modelKey,
    selectedSession?.provider,
    selectedSession?.model,
    modelOptions,
    selectedModelKey,
    settings?.defaultModelKey,
    settings?.defaultThinkingLevel,
  ])


  useEffect(() => {
    // Refresh message history when switching sessions or when persisted entries change.
    // We keep this simple: exiting history navigation whenever the backing session entries update.
    if (!selectedSession) {
      composerHistoryRef.current = { index: -1, draftBeforeHistory: '', messages: [] }
      return
    }

    const messages = selectedSession.entries
      .filter((entry) => entry.role === 'user')
      .map((entry) => entry.text)
      .filter(Boolean)

    composerHistoryRef.current = {
      index: -1,
      draftBeforeHistory: '',
      messages,
    }
  }, [selectedSession?.viewerId, selectedSession?.entries.length])

  useLayoutEffect(() => {
    if (!selectedSession) return
    const element = entryListRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
    setShowScrollToBottom(false)
  }, [selectedSession?.viewerId, selectedSession?.entries.length])

  useEffect(() => {
    const element = entryListRef.current
    if (!element || !selectedSession) {
      setShowScrollToBottom(false)
      return
    }

    const updateScrollState = () => {
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
      setShowScrollToBottom(distanceFromBottom > 64)
    }

    updateScrollState()
    element.addEventListener('scroll', updateScrollState)
    return () => element.removeEventListener('scroll', updateScrollState)
  }, [selectedSession?.viewerId, selectedSession?.entries.length])

  const applyComposerText = (nextText: string) => {
    setComposerText(nextText)
    requestAnimationFrame(() => {
      const element = document.activeElement
      if (element && element instanceof HTMLTextAreaElement) {
        element.selectionStart = nextText.length
        element.selectionEnd = nextText.length
      }
    })
  }

  const handleComposerArrowHistory = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget
    const value = element.value
    const selectionStart = element.selectionStart ?? 0
    const selectionEnd = element.selectionEnd ?? 0
    const isCollapsed = selectionStart === selectionEnd

    const history = composerHistoryRef.current
    if (history.messages.length === 0) return

    if (event.key === 'ArrowUp') {
      // Only intercept when caret is at start, otherwise allow normal multi-line navigation.
      if (!isCollapsed || selectionStart !== 0) return

      event.preventDefault()

      if (history.index === -1) {
        history.draftBeforeHistory = value
        history.index = history.messages.length - 1
      } else {
        history.index = Math.max(0, history.index - 1)
      }

      applyComposerText(history.messages[history.index] ?? '')
      return
    }

    if (event.key === 'ArrowDown') {
      // Only intercept when caret is at end.
      if (!isCollapsed || selectionEnd !== value.length) return
      if (history.index === -1) return

      event.preventDefault()

      if (history.index >= history.messages.length - 1) {
        history.index = -1
        const draft = history.draftBeforeHistory
        history.draftBeforeHistory = ''
        applyComposerText(draft)
        return
      }

      history.index += 1
      applyComposerText(history.messages[history.index] ?? '')
    }
  }

  const handleQueueMessage = async (mode: 'steer' | 'followUp') => {
    if (!workspaceId || !viewerId || !composerText.trim() || composerActionLoading) return

    const draftKeyAtActionStart = draftKey

    setComposerActionLoading(true)
    setError('')
    try {
      const response = await api.queueLiveSessionMessage(workspaceId, viewerId, {
        message: composerText,
        mode,
      })

      clearDraftByKey(draftKeyAtActionStart)
      if (isViewingSession(viewerId)) {
        setRuntime(response.runtime.active ? response.runtime : null)
        setSelectedSession((current) => (
          current && current.viewerId === viewerId
            ? appendLiveEventEntry(current, mode === 'steer' ? 'Steer queued' : 'Follow-up queued')
            : current
        ))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setComposerActionLoading(false)
    }
  }

  const handleSaveDefaults = async () => {
    if (!selectedModelKey || !settings) return

    setError('')
    try {
      const nextDefaults: BirdseyeSettings = {
        ...settings,
        defaultModelKey: selectedModelKey,
        defaultThinkingLevel: selectedModel?.reasoning ? selectedThinkingLevel : 'off',
      }

      const saved = await api.saveSettings(nextDefaults)
      setSettings(saved)

      if (selectedSession) {
        setSelectedSession((current) => (
          current ? appendLiveEventEntry(current, 'Defaults saved') : current
        ))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSendMessage = async () => {
    if (!workspaceId || !composerText.trim() || composerActionLoading) return

    const message = composerText.trim()
    const sendWorkspaceId = workspaceId
    const requestedModelKey = selectedModelKey || undefined
    const requestedThinkingLevel = selectedThinkingLevel
    const draftKeyAtSendStart = draftKey
    const activeViewerIdAtStart = viewerId
    const liveRuntimeAtStart = runtime?.active ? runtime : null

    if (activeViewerIdAtStart && liveRuntimeAtStart?.isStreaming) {
      await handleQueueMessage('followUp')
      return
    }

    setComposerActionLoading(true)
    setError('')

    try {
      let activeViewerId = activeViewerIdAtStart
      let liveRuntime = liveRuntimeAtStart
      let createdDetail: SessionDetail | null = null

      if (!activeViewerId) {
        const created = await api.createLiveSession(sendWorkspaceId, {
          modelKey: requestedModelKey,
          thinkingLevel: requestedThinkingLevel,
        })

        activeViewerId = created.detail.viewerId
        liveRuntime = created.runtime
        createdDetail = created.detail
        setSelectedSession(created.detail)
        setRuntime(created.runtime)
        await loadSessions(sendWorkspaceId)
        navigate(`/workspace/${sendWorkspaceId}/sessions/${created.detail.viewerId}`)
      }

      if (!activeViewerId) {
        throw new Error('Session could not be created')
      }

      if (!liveRuntime?.active) {
        const started = await api.startLiveSession(sendWorkspaceId, activeViewerId, {
          modelKey: requestedModelKey,
          thinkingLevel: requestedThinkingLevel,
        })
        liveRuntime = started.runtime
        if (isViewingSession(activeViewerId)) {
          setRuntime(started.runtime.active ? started.runtime : null)
        }
      }

      const assistantEntryId = `${LIVE_ASSISTANT_ENTRY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`
      let opened = false

      await api.sendLiveSessionMessageStream(
        sendWorkspaceId,
        activeViewerId,
        {
          message,
          modelKey: requestedModelKey || liveRuntime?.modelKey || undefined,
          thinkingLevel: requestedThinkingLevel,
        },
        {
          onOpen: () => {
            opened = true
            setComposerActionLoading(false)
            clearDraftByKey(draftKeyAtSendStart)

            setLiveThinkingText('')
            setLiveToolCalls([])

            if (isViewingSession(activeViewerId)) {
              setRuntime(createOptimisticRuntime(liveRuntime, requestedModelKey ?? '', requestedThinkingLevel))
            }

            setSelectedSession((current) => {
              if (current?.viewerId === activeViewerId) {
                return appendOptimisticPrompt(current, message, assistantEntryId)
              }

              if (createdDetail?.viewerId === activeViewerId) {
                return appendOptimisticPrompt(createdDetail, message, assistantEntryId)
              }

              return current
            })

            setSessions((prev) => prev.map((session) => (
              session.viewerId === activeViewerId
                ? {
                    ...session,
                    preview: message,
                    previewRole: 'user',
                    lastUserPreview: message,
                    updatedAt: new Date().toISOString(),
                    messageCount: session.messageCount + 1,
                    userMessageCount: session.userMessageCount + 1,
                  }
                : session
            )))

            maybeScrollToBottom('smooth')
          },
          onEvent: (event) => {
            if (!isViewingSession(activeViewerId)) {
              if (event.type === 'done' || event.type === 'error') {
                void loadSessions(sendWorkspaceId)
              }
              return
            }

            if (event.runtime) {
              setRuntime(event.runtime.active ? event.runtime : null)
            }

            if (event.type === 'text-delta' && event.delta) {
              const delta = event.delta
              setSelectedSession((current) => (
                current && current.viewerId === activeViewerId
                  ? appendAssistantDelta(current, assistantEntryId, delta)
                  : current
              ))
              maybeScrollToBottom()
              return
            }

            if (event.type === 'thinking-start') {
              setLiveThinkingText('')
              return
            }

            if (event.type === 'thinking-delta') {
              if (event.delta) {
                const delta = event.delta
                setLiveThinkingText((prev) => prev + delta)
                maybeScrollToBottom()
              }
              return
            }

            if (event.type === 'thinking-end') {
              // Keep thinking visible until the run finishes; the persisted session detail will include it.
              return
            }

            if (event.type === 'tool-start' && event.toolCallId && event.toolName) {
              const toolCallId = event.toolCallId
              setLiveToolCalls((prev) => {
                if (prev.some((tc) => tc.toolCallId === toolCallId)) return prev
                return [
                  ...prev,
                  {
                    toolCallId,
                    toolName: event.toolName ?? 'tool',
                    input: event.toolInput,
                    output: '',
                    isComplete: false,
                    isError: false,
                  },
                ]
              })
              maybeScrollToBottom()
              return
            }

            if (event.type === 'tool-delta' && event.toolCallId && event.delta) {
              const toolCallId = event.toolCallId
              const delta = event.delta
              setLiveToolCalls((prev) => prev.map((tc) => (
                tc.toolCallId === toolCallId
                  ? { ...tc, output: tc.output + delta }
                  : tc
              )))
              maybeScrollToBottom()
              return
            }

            if (event.type === 'tool-end' && event.toolCallId) {
              const toolCallId = event.toolCallId
              setLiveToolCalls((prev) => prev.map((tc) => (
                tc.toolCallId === toolCallId
                  ? {
                      ...tc,
                      toolName: event.toolName ?? tc.toolName,
                      isComplete: true,
                      isError: Boolean(event.isError),
                      result: event.result,
                      output: event.result ?? tc.output,
                    }
                  : tc
              )))
              maybeScrollToBottom()
              return
            }

            if (event.type === 'status') {
              const statusMessage = event.message
              if (statusMessage) {
                setSelectedSession((current) => (
                  current && current.viewerId === activeViewerId
                    ? appendLiveEventEntry(
                        current,
                        statusMessage,
                        statusMessage.startsWith('Tool:') ? 'toolResult' : 'system',
                      )
                    : current
                ))
                maybeScrollToBottom()
              }
              return
            }

            if (event.type === 'queue-update') {
              return
            }

            if (event.type === 'done') {
              setLiveThinkingText('')
              setLiveToolCalls([])
              if (event.detail) {
                setSelectedSession(event.detail)
              }
              void loadSessions(sendWorkspaceId)
              return
            }

            if (event.type === 'error') {
              setLiveThinkingText('')
              setLiveToolCalls([])
              setError(event.message ?? 'Failed to send live session message')
              void api.getSession(sendWorkspaceId, activeViewerId)
                .then((detail) => {
                  if (isViewingSession(activeViewerId)) {
                    setSelectedSession(detail)
                  }
                })
                .catch(() => undefined)
              void loadSessions(sendWorkspaceId)
            }
          },
        },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setComposerActionLoading(false)
    }
  }

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('.session-meta-bar')) {
        setShowModelMenu(false)
        setShowThinkingMenu(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingTarget = Boolean(
        target
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as HTMLElement).isContentEditable),
      )

      if (!isTypingTarget && (event.key === '?' || (event.key === '/' && event.shiftKey))) {
        event.preventDefault()
        setShowHotkeyHelp((prev) => !prev)
        return
      }

      if (showHotkeyHelp && event.key === 'Escape') {
        event.preventDefault()
        setShowHotkeyHelp(false)
        return
      }

      if (!event.ctrlKey || event.altKey || event.metaKey) return
      if (isTypingTarget) return

      if (event.key.toLowerCase() === 'u') {
        event.preventDefault()
        const container = entryListRef.current
        if (!container) return
        const userEntries = container.querySelectorAll<HTMLElement>('[data-role="user"]')
        const last = userEntries[userEntries.length - 1]
        if (last) {
          last.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const container = entryListRef.current
        if (!container) return
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
        return
      }

      const showToast = (message: string) => {
        setShortcutToast({ id: Date.now(), message })
      }

      if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        setThinkingExpandedByDefault((prev) => {
          const next = !prev
          showToast(`Thinking auto-expand: ${next ? 'ON' : 'OFF'}`)
          return next
        })
        return
      }

      if (event.key.toLowerCase() === 'o') {
        event.preventDefault()
        setToolOutputsExpandedByDefault((prev) => {
          const next = !prev
          showToast(`Tool output auto-expand: ${next ? 'ON' : 'OFF'}`)
          return next
        })
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showHotkeyHelp])

  useEffect(() => {
    if (!shortcutToast) return
    const timer = window.setTimeout(() => setShortcutToast(null), 1200)
    return () => window.clearTimeout(timer)
  }, [shortcutToast?.id])

  const availableThinkingLevelsForSelection = useMemo<ThinkingLevel[]>(() => {
    if (!selectedModel) return THINKING_LEVELS
    return selectedModel.reasoning ? THINKING_LEVELS : (['off'] as ThinkingLevel[])
  }, [selectedModel])

  useEffect(() => {
    if (!selectedModel) return

    if (!selectedModel.reasoning && selectedThinkingLevel !== 'off') {
      setSelectedThinkingLevel('off')
      return
    }

    if (selectedModel.reasoning && !availableThinkingLevelsForSelection.includes(selectedThinkingLevel)) {
      setSelectedThinkingLevel(DEFAULT_THINKING_LEVEL)
    }
  }, [selectedModel, selectedThinkingLevel, availableThinkingLevelsForSelection])

  useEffect(() => {
    // Apply global default thinking level for *new* sessions, without overriding user choices.
    if (runtime) return
    if (viewerId) return
    if (selectionTouchedRef.current) return

    const defaultThinking = settings?.defaultThinkingLevel
    if (!defaultThinking) return

    if (!availableThinkingLevelsForSelection.includes(defaultThinking)) return

    if (selectedThinkingLevel === DEFAULT_THINKING_LEVEL) {
      setSelectedThinkingLevel(defaultThinking)
    }
  }, [runtime, viewerId, settings?.defaultThinkingLevel, availableThinkingLevelsForSelection, selectedThinkingLevel])

  const renderComposer = (emptyState = false) => (
    <div className="session-composer card">
      {(runtime?.isStreaming || composerActionLoading) && (
        <div className="session-working-banner" aria-live="polite">
          <span className="session-working-spinner" aria-hidden />
          <strong>Working…</strong>
        </div>
      )}

      {runtime?.isStreaming && queueSummary && (
        <div className="session-queue-banner">
          <strong>{queueSummary.pendingCount} queued</strong>
          {queueSummary.steeringMessages.length > 0 && (
            <div className="session-queue-group">
              <span className="session-queue-label">Steer</span>
              {queueSummary.steeringMessages.map((queuedMessage, index) => (
                <span className="session-queue-pill" key={`steer-${index}-${queuedMessage.slice(0, 24)}`}>
                  {queuedMessage}
                </span>
              ))}
            </div>
          )}
          {queueSummary.followUpMessages.length > 0 && (
            <div className="session-queue-group">
              <span className="session-queue-label">Follow-up</span>
              {queueSummary.followUpMessages.map((queuedMessage, index) => (
                <span className="session-queue-pill" key={`follow-${index}-${queuedMessage.slice(0, 24)}`}>
                  {queuedMessage}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="session-composer-input-wrap">
        <textarea
          className="session-composer-input"
          value={composerText}
          ref={composerTextareaRef}
          style={composerHeight ? { height: `${composerHeight}px` } : undefined}
        onChange={(event) => {
          const history = composerHistoryRef.current
          if (history.index !== -1) {
            history.index = -1
            history.draftBeforeHistory = ''
          }
          setComposerText(event.target.value)
        }}
        onKeyDown={(event) => {
          handleComposerArrowHistory(event)

          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            if (runtime?.isStreaming && viewerId) {
              void handleQueueMessage('followUp')
            } else {
              void handleSendMessage()
            }
          }
        }}
        placeholder={runtime?.isStreaming ? 'Queue a steer or follow-up message…' : 'Send a new message…'}
          rows={3}
          disabled={composerActionLoading}
        />
        <div
          className="session-composer-resize-handle"
          role="separator"
          aria-label="Resize composer"
          title="Drag to resize"
          onPointerDown={(event) => {
            const textarea = composerTextareaRef.current
            if (!textarea) return

            event.preventDefault()

            const startY = event.clientY
            const startHeight = textarea.getBoundingClientRect().height
            const minHeight = 72
            const maxHeight = 520

            const move = (moveEvent: PointerEvent) => {
              const next = startHeight - (moveEvent.clientY - startY)
              setComposerHeight(Math.max(minHeight, Math.min(maxHeight, Math.round(next))))
            }

            const up = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
              window.removeEventListener('pointercancel', up)
            }

            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
            window.addEventListener('pointercancel', up)
          }}
        />
      </div>

      <div className="session-composer-footer">
        <div className="session-meta-bar">
          <span>Session: <strong>{sessionStatus}</strong></span>
          <span>|</span>
          <button
            className="session-meta-trigger"
            onClick={() => {
              setShowModelMenu((value) => !value)
              setShowThinkingMenu(false)
            }}
            disabled={composerActionLoading || runtime?.isStreaming}
          >
            Model: {selectedModel?.name ?? 'Select'}
          </button>
          <span>(</span>
          <button
            className="session-meta-trigger"
            onClick={() => {
              setShowThinkingMenu((value) => !value)
              setShowModelMenu(false)
            }}
            disabled={composerActionLoading || runtime?.isStreaming || (selectedModel ? !selectedModel.reasoning : false)}
          >
            {selectedThinkingLevel}
          </button>
          <span>)</span>

          <span>|</span>
          <button
            className="session-meta-trigger"
            onClick={() => void handleSaveDefaults()}
            disabled={composerActionLoading || runtime?.isStreaming || !selectedModelKey || !settings}
            title="Save current model + thinking level as defaults"
          >
            Save defaults
          </button>

          {showModelMenu && (
            <div className="session-meta-menu session-meta-menu-model">
              {modelOptions.map((option) => (
                <button
                  className={`session-meta-option ${option.key === selectedModelKey ? 'session-meta-option-active' : ''}`}
                  key={option.key}
                  onClick={() => {
                    selectionTouchedRef.current = true
                    setSelectedModelKey(option.key)
                    setSelectedThinkingLevel((current) => {
                      if (!option.reasoning) return 'off' as ThinkingLevel
                      if (current === 'off') return DEFAULT_THINKING_LEVEL
                      return current
                    })
                    setShowModelMenu(false)
                  }}
                >
                  {option.name}
                </button>
              ))}
            </div>
          )}

          {showThinkingMenu && (
            <div className="session-meta-menu session-meta-menu-thinking">
              {availableThinkingLevelsForSelection.map((level) => (
                <button
                  className={`session-meta-option ${level === selectedThinkingLevel ? 'session-meta-option-active' : ''}`}
                  key={level}
                  onClick={() => {
                    selectionTouchedRef.current = true
                    setSelectedThinkingLevel(level)
                    setShowThinkingMenu(false)
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="session-composer-button-row">
          {runtime?.isStreaming && viewerId ? (
            <>
              <button className="button button-secondary" disabled={composerActionLoading || !composerText.trim()} onClick={() => void handleQueueMessage('steer')}>
                Queue steer
              </button>
              <button className="button button-primary" disabled={composerActionLoading || !composerText.trim()} onClick={() => void handleQueueMessage('followUp')}>
                Queue follow-up
              </button>
            </>
          ) : (
            <button className="button button-primary" disabled={composerActionLoading || !composerText.trim()} onClick={() => void handleSendMessage()}>
              <span>Send</span>
              <ArrowRightIcon className="icon" />
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <main className="workspace-shell workspace-shell-loading">
        <WorkspaceRail />
        <div className="loading-card card">Loading workspace…</div>
      </main>
    )
  }

  return (
    <main className="workspace-shell">
      <WorkspaceRail />

      <section className="workspace-main">
        <header className="workspace-summary-bar">
          <div className="workspace-summary-main">
            <h1>{workspace?.name ?? 'Unknown workspace'}</h1>
            <span className="workspace-summary-separator">|</span>
            <p className="workspace-summary-meta">
              Sessions: <span className="workspace-session-count">{sessions.length}</span>
            </p>
          </div>

          <div className="workspace-summary-actions">
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
        </header>

        {error && <div className="error-banner global-error">{error}</div>}

        <div className="workspace-content">
          <aside className="session-list-panel card">
            <div className="section-header sticky-header">
              <div>
                <div className="eyebrow">Workspace sessions</div>
              </div>
            </div>

            <div className="session-list">
              {sessions.length === 0 ? (
                <div className="empty-state empty-state-large">
                  No saved sessions were found for this workspace yet.
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    className={`session-card ${session.viewerId === viewerId ? 'session-card-active' : ''}`}
                    key={session.viewerId}
                    onClick={() => navigate(`/workspace/${workspaceId}/sessions/${session.viewerId}`)}
                  >
                    <div className="session-card-topline">
                      <strong>{session.title}</strong>
                      {(() => {
                        const liveSummary = liveSummaryMap.get(session.viewerId)
                        if (!liveSummary?.active) return null
                        return (
                          <span
                            className={`session-live-indicator ${liveSummary.isStreaming ? 'session-live-indicator-working' : 'session-live-indicator-ready'}`}
                            title={liveSummary.isStreaming ? 'Working' : 'Ready'}
                          >
                            {liveSummary.isStreaming ? (
                              <SpinnerIcon className="icon icon-spin" />
                            ) : (
                              <DoneIcon className="icon" />
                            )}
                          </span>
                        )
                      })()}
                    </div>
                    <p className="muted session-preview">
                      {(() => {
                        const liveSummary = liveSummaryMap.get(session.viewerId)
                        const isWorking = Boolean(liveSummary?.isStreaming) || (session.userMessageCount > 0 && session.assistantMessageCount === 0)

                        if (isWorking) {
                          const lastUser = session.lastUserPreview
                            || (session.previewRole === 'user' ? session.preview : '')

                          return (
                            <span className="session-preview-working">
                              {lastUser ? (
                                <span className="session-preview-line">
                                  <UserIcon className="icon icon-inline" />
                                  <span>{lastUser}</span>
                                </span>
                              ) : null}
                              <span className="session-preview-line">
                                <AgentIcon className="icon icon-inline" />
                                <span>working...</span>
                              </span>
                            </span>
                          )
                        }

                        if (session.previewRole === 'user') {
                          return (
                            <>
                              <UserIcon className="icon icon-inline" />
                              <span>{session.preview}</span>
                            </>
                          )
                        }

                        if (session.previewRole === 'assistant') {
                          return (
                            <>
                              <AgentIcon className="icon icon-inline" />
                              <span>{session.preview}</span>
                            </>
                          )
                        }

                        return <span>{session.preview}</span>
                      })()}
                    </p>
                    <div className="session-meta-row muted">
                      <span>{formatDate(session.updatedAt)}</span>
                      <span>{session.messageCount} msgs</span>
                      {session.hasBranches && <span>branched</span>}
                    </div>
                  </button>
                ))
              )}

              <button
                className="session-add-card"
                onClick={() => {
                  setSelectedSession(null)
                  setRuntime(null)
                  navigate(`/workspace/${workspaceId}`)
                }}
                title="Start a new session"
                aria-label="Start a new session"
              >
                <span className="session-add-icon">+</span>
              </button>
            </div>
          </aside>

          <section className="session-viewer-panel card">
            {detailLoading ? (
              <div className="empty-state empty-state-large">Loading session…</div>
            ) : selectedSession ? (
              <>
                <div className="section-header viewer-header">
                  <div>
                    <div className="eyebrow">Session</div>
                    {renamingSession ? (
                      <div className="session-title-edit">
                        <button
                          className="session-title-ai"
                          type="button"
                          title="Generate short title"
                          aria-label="Generate short title"
                          onMouseDown={(event) => {
                            // Prevent the input blur handler from firing before we can generate.
                            event.preventDefault()
                          }}
                          onClick={() => void generateTitle()}
                          disabled={renameLoading}
                        >
                          <AgentIcon className={renameLoading ? 'icon icon-spin' : 'icon'} />
                        </button>
                        <input
                          className="session-title-input session-title-input-ai"
                          value={renameValue}
                          maxLength={MAX_SESSION_TITLE_LENGTH}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onBlur={() => void commitRename()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void commitRename()
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            setRenamingSession(false)
                            setRenameValue(selectedSession.title)
                          }
                        }}
                        autoFocus
                        disabled={renameLoading}
                        aria-label="Rename session"
                      />
                      </div>
                    ) : (
                      <button
                        className="session-title-button"
                        onClick={() => setRenamingSession(true)}
                        type="button"
                      >
                        {selectedSession.title}
                      </button>
                    )}
                    <div className="muted session-meta-stack">
                      <span>Started {formatDate(selectedSession.startedAt)}</span>
                      <span>Updated {formatDate(selectedSession.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="session-header-actions">
                    <button
                      className="button button-secondary session-archive-button"
                      onClick={() => void commitArchive()}
                      disabled={archiveLoading || runtime?.isStreaming}
                      type="button"
                      title={runtime?.isStreaming ? 'Wait for the session to finish before archiving.' : 'Archive this session'}
                    >
                      <ArchiveIcon className="icon" />
                      {archiveLoading ? 'Archiving…' : 'Archive'}
                    </button>
                  </div>
                </div>

                <div className="session-stats-toolbar">
                  {selectedSessionStats && showStats && (
                    <div className="session-stats-strip">
                      <div className="session-stats-primary">
                        <strong>{formatCount(selectedSessionStats.promptResponseTokens)} tok</strong>
                        <span className="session-stats-separator">·</span>
                        <strong>{formatCost(selectedSessionStats.totalCost)}</strong>
                      </div>
                      <div className="session-stats-secondary muted">
                        <span title="Messages">
                          <UserIcon className="icon icon-inline" /> {formatCount(selectedSessionStats.userMessages)}
                          {' · '}
                          <AgentIcon className="icon icon-inline" /> {formatCount(selectedSessionStats.assistantMessages)}
                          {' · '}
                          <SystemIcon className="icon icon-inline" /> {formatCount(selectedSessionStats.systemMessages)}
                        </span>
                        <span className="session-stats-separator">|</span>
                        <span title="Tool results">
                          <ToolOkIcon className="icon icon-inline" /> {formatCount(selectedSessionStats.toolSuccesses)}
                          {' / '}
                          <ToolErrIcon className="icon icon-inline" /> {formatCount(selectedSessionStats.toolFailures)}
                        </span>
                        <span className="session-stats-separator">|</span>
                        <span title="Tokens in/out">
                          <TokenInIcon className="icon icon-inline" /> {formatCount(selectedSessionStats.inputTokens)}
                          {' / '}
                          <TokenOutIcon className="icon icon-inline" /> {formatCount(selectedSessionStats.outputTokens)}
                        </span>
                        <span className="session-stats-separator">|</span>
                        <span title="Cache read/write">
                          <CacheReadIcon className="icon icon-inline" /> {formatCount(selectedSessionStats.cacheReadTokens)}
                          {' / '}
                          <CacheWriteIcon className="icon icon-inline" /> {formatCount(selectedSessionStats.cacheWriteTokens)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button className="session-stats-toggle" onClick={() => setShowStats((value) => !value)}>
                    {showStats ? 'Hide stats' : 'Show stats'}
                  </button>
                </div>

                <div className="session-entry-list-wrap">
                  <div className="session-entry-list" ref={entryListRef}>
                    {selectedSession.entries.length === 0 ? (
                      <div className="empty-state">No entries in this session.</div>
                    ) : (
                      selectedSession.entries.map((entry, index) => {
                        const defaultExpanded = entry.role === 'thinking'
                          ? thinkingExpandedByDefault
                          : entry.role === 'toolResult'
                            ? toolOutputsExpandedByDefault
                            : index >= selectedSession.entries.length - 2

                        return (
                          <SessionEntry
                            key={`${entry.id ?? entry.timestamp ?? index}-${index}`}
                            entry={entry}
                            defaultExpanded={defaultExpanded}
                          />
                        )
                      })
                    )}

                    {runtime?.isStreaming && liveThinkingText && (
                      <div aria-live="polite">
                        <SessionEntry
                          entry={{
                            id: '__live-thinking__',
                            entryType: 'thinking',
                            role: 'thinking',
                            text: liveThinkingText,
                          }}
                          defaultExpanded={thinkingExpandedByDefault}
                        />
                      </div>
                    )}

                    {runtime?.isStreaming && liveToolCalls.length > 0 && (
                      <div className="session-live-tools" aria-live="polite">
                        {liveToolCalls.map((toolCall) => (
                          <article className={`session-entry entry-tool session-live-tool`} key={toolCall.toolCallId}>
                            <div className="session-entry-header">
                              <span className="session-entry-role">tool</span>
                              <span className="session-entry-time">{toolCall.toolName}{toolCall.isComplete ? '' : ' (running)'}</span>
                            </div>
                            <SessionEntryBody text={toolCall.output || ''} defaultExpanded={toolOutputsExpandedByDefault} />
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  {showScrollToBottom && (
                    <div className="session-scroll-cta-wrap">
                      <button
                        className="session-scroll-cta"
                        onClick={() => {
                          const element = entryListRef.current
                          if (!element) return
                          element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
                        }}
                      >
                        Scroll to bottom
                      </button>
                    </div>
                  )}
                </div>

                {renderComposer()}
              </>
            ) : (
              <div className="session-empty-state">
                <div className="empty-state empty-state-large">
                  {selectedSummary ? 'Select a session to inspect it.' : 'Pick a workspace session from the left, or type a message to start a new one.'}
                </div>

                {renderComposer(true)}
              </div>
            )}
          </section>
        </div>
      </section>

      {shortcutToast && (
        <div className="shortcut-toast" role="status" aria-live="polite">
          {shortcutToast.message}
        </div>
      )}

      {showHotkeyHelp && (
        <div
          className="hotkey-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowHotkeyHelp(false)
            }
          }}
        >
          <div className="hotkey-modal card">
            <div className="hotkey-header">
              <strong>Keyboard shortcuts</strong>
              <button className="button button-secondary hotkey-close" type="button" onClick={() => setShowHotkeyHelp(false)}>
                Close (Esc)
              </button>
            </div>

            <div className="hotkey-meta muted">
              Current mode: <strong>{runtime?.isStreaming ? 'Streaming' : 'Idle'}</strong>
            </div>

            <div className="hotkey-section">
              <div className="hotkey-section-title">Global</div>
              <div className="hotkey-row"><kbd>?</kbd><span>Show / hide this help</span></div>
              <div className="hotkey-row">
                <span className="hotkey-chord"><kbd>Ctrl</kbd><span className="hotkey-plus">+</span><kbd>U</kbd></span>
                <span>Center last User message</span>
              </div>
              <div className="hotkey-row">
                <span className="hotkey-chord"><kbd>Ctrl</kbd><span className="hotkey-plus">+</span><kbd>↓</kbd></span>
                <span>Scroll to bottom</span>
              </div>
              <div className="hotkey-row">
                <span className="hotkey-chord"><kbd>Ctrl</kbd><span className="hotkey-plus">+</span><kbd>T</kbd></span>
                <span>Toggle thinking auto-expand ({thinkingExpandedByDefault ? 'ON' : 'OFF'})</span>
              </div>
              <div className="hotkey-row">
                <span className="hotkey-chord"><kbd>Ctrl</kbd><span className="hotkey-plus">+</span><kbd>o</kbd></span>
                <span>Toggle tool output auto-expand ({toolOutputsExpandedByDefault ? 'ON' : 'OFF'})</span>
              </div>
            </div>

            <div className="hotkey-section">
              <div className="hotkey-section-title">
                Composer — idle
              </div>
              <div className="hotkey-row">
                <span className="hotkey-chord"><kbd>Ctrl</kbd><span className="hotkey-plus">+</span><kbd>Enter</kbd></span>
                <span>Send message (when composer is focused)</span>
              </div>
              <div className="hotkey-row">
                <span className="hotkey-chord"><kbd>↑</kbd><span className="hotkey-plus">/</span><kbd>↓</kbd></span>
                <span>Browse message history (caret at start/end)</span>
              </div>
            </div>

            <div className="hotkey-section">
              <div className="hotkey-section-title">
                Composer — streaming
              </div>
              <div className="hotkey-row">
                <span className="hotkey-chord"><kbd>Ctrl</kbd><span className="hotkey-plus">+</span><kbd>Enter</kbd></span>
                <span>Queue follow-up (when composer is focused)</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </main>
  )
}
