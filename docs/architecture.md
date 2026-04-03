# Architecture

Related docs:

- [README](../README.md)
- [API reference](api.md)
- [Development](development.md)
- [Deployment](deployment.md)
- [Security notes](security.md)

---

Bird's Eye is a minimal workspace and session viewer for Pi agent sessions.
It is inspired by Task Factory, but focused on browsing and interacting with sessions rather than orchestrating task queues.

## High-level view

**Two apps, one repo:**

- **Web UI** ([`apps/web`](../apps/web))
  - Vite + React
  - browses workspaces and sessions
  - opens sessions live and sends messages with streaming updates

- **API server** ([`apps/server`](../apps/server))
  - Express
  - reads sessions from disk and normalizes them for the UI
  - manages live Pi SDK `AgentSession` instances in memory
  - serves the built web UI in production

The source of truth for session history is the JSONL session data on disk.
The browser never reads those files directly; it always goes through the server.

---

## Data model and storage

### Bird's Eye home directory

Bird's Eye stores its own state under:

- `~/.birdseye/`
  - `workspaces.json` — workspace registry
  - `settings.json` — Bird's Eye defaults
  - `pi-migration.json` — migration prompt state
  - `pi-agent/` — migrated Pi settings, auth, and resources

### Session sources

Session discovery reads JSONL session files from:

- `~/.birdseye/sessions`
- `~/.pi/agent/sessions`

Sessions are filtered by matching the session header `cwd` to the workspace path.

### Viewer IDs

A session is referenced by `viewerId`, which is a base64url encoding of the session file path.
This lets the UI refer to sessions without exposing raw paths in routes.

See also:

- [API conventions](api.md#conventions)
- [Development: session storage and discovery](development.md#session-storage-and-discovery)
- [Security: sensitive data and storage locations](security.md#sensitive-data-and-storage-locations)

---

## Server architecture (`apps/server`)

### Entry point and routing

- [`apps/server/src/index.ts`](../apps/server/src/index.ts)
  - Express app creation
  - route wiring
  - static serving of `apps/web/dist` in production

### Workspace registry

- [`apps/server/src/workspace-registry.ts`](../apps/server/src/workspace-registry.ts)
  - manages `~/.birdseye/workspaces.json`
  - computes `exists` so missing workspaces can be highlighted in the UI

### Session discovery

- [`apps/server/src/session-discovery.ts`](../apps/server/src/session-discovery.ts)
  - walks session roots and parses `*.jsonl`
  - normalizes entries into `SessionSummary` and `SessionDetail`
  - produces UI-friendly text summaries:
    - collapses multi-block message content
    - uses tool-call markers such as `[tool:name]`
    - excludes thinking blocks from normal text summaries

### Live session runtime (Pi SDK)

- [`apps/server/src/pi-live-session.ts`](../apps/server/src/pi-live-session.ts)

Responsibilities:

- lists models via Pi SDK `ModelRegistry`
- creates or opens live sessions via Pi SDK session APIs
- maintains in-memory runtimes keyed by `viewerId`
- sends messages:
  - non-streaming: prompt, then reload session from disk
  - streaming: translate Pi SDK events into NDJSON
- queues `steer` or `followUp` messages while streaming
- returns `LiveSessionState` to drive the UI:
  - `isStreaming`
  - current model and thinking level
  - queued steering and follow-up messages

The streaming endpoint returns **NDJSON** (`application/x-ndjson`), writing one JSON object per line.
See [api.md#live-sessions](api.md#live-sessions).

### Session title generation

- [`apps/server/src/session-title.ts`](../apps/server/src/session-title.ts)
  - builds a transcript excerpt from recent user and assistant messages
  - uses the title skill prompt in [`skills/session-title-ui/SKILL.md`](../skills/session-title-ui/SKILL.md)
  - writes the title into the session via `sessionManager.appendSessionInfo()`

---

## Web architecture (`apps/web`)

### Routing

- [`apps/web/src/App.tsx`](../apps/web/src/App.tsx)
  - `/` — home / workspace selection
  - `/settings` — settings
  - `/workspace/:workspaceId` — workspace view
  - `/workspace/:workspaceId/sessions/:viewerId` — session view

### API client

- [`apps/web/src/api.ts`](../apps/web/src/api.ts)
  - `fetch()` wrapper for all API endpoints
  - streaming helper that parses NDJSON into events

### Theme

- [`apps/web/src/theme.ts`](../apps/web/src/theme.ts)
  - stores theme in localStorage under `birds-eye-theme`
  - applies theme before or during React render so the UI stays in sync with browser preference and user choice

### Workspace UI

- [`apps/web/src/pages/HomePage.tsx`](../apps/web/src/pages/HomePage.tsx)
  - workspace list
  - add and delete workspace
  - auto-open default workspace based on settings

- [`apps/web/src/pages/WorkspacePage.tsx`](../apps/web/src/pages/WorkspacePage.tsx)
  - session list
  - session viewer
  - sticky composer
  - per-session draft persistence in localStorage
  - arrow-up and arrow-down recall of prior user messages
  - live runtime controls:
    - model selection
    - thinking selection
    - save defaults
    - queue steer or follow-up while streaming
  - live display blocks:
    - thinking deltas
    - tool streaming output
    - assistant text deltas

- [`apps/web/src/pages/SettingsPage.tsx`](../apps/web/src/pages/SettingsPage.tsx)
  - default workspace selection
  - default model selection
  - default thinking level selection

---

## Key runtime flows

### 1) Browse workspace sessions

1. UI calls `GET /api/workspaces/:id/sessions`
2. server walks JSONL sessions from both roots
3. server filters by `cwd` and returns summaries

### 2) Open a session detail

1. UI calls `GET /api/workspaces/:id/sessions/:viewerId`
2. server parses the JSONL and returns entries

### 3) Start a new live session and stream a message

1. UI creates a live session with `POST /api/workspaces/:id/sessions/live`
2. UI sends and streams a message with `POST /api/workspaces/:id/sessions/:viewerId/live/message/stream`
3. server translates Pi SDK events into NDJSON deltas:
   - thinking
   - tool
   - text
4. UI renders live blocks while streaming
5. on `done`, the UI reloads full session detail from disk

### 4) Queue while streaming

1. If a session is already streaming, the UI posts to `POST /api/workspaces/:id/sessions/:viewerId/live/queue`
2. server calls `session.steer()` or `session.followUp()`

See [api.md#live-sessions](api.md#live-sessions) for the endpoint contract.

---

## Limits and operating model

- Live sessions are held in **server memory** only.
  - Restarting the server drops live runtimes.
  - Session history remains on disk.

- There is **no authentication**.
  - Deploy only on trusted networks or behind an authenticating reverse proxy.

- Streaming is **request-scoped NDJSON** rather than a long-lived subscription.
  - Refreshing or navigating away mid-stream loses the active stream.

For operational guidance, see [deployment.md](deployment.md) and [security.md](security.md).

---

## Reference implementation

The repo includes a reference project at [`reference/task-factory`](../reference/task-factory).

Bird's Eye borrows UX and streaming ideas from it, but uses a smaller server and API surface.
