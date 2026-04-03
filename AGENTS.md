# Birds-eye repo guide

## What this repo is
Bird's Eye is a small workspace/session viewer for Pi sessions.

It has two apps:
- `apps/server` — Express API that reads workspace/session data and hosts Pi SDK-backed session actions
- `apps/web` — Vite + React UI for browsing workspaces, inspecting sessions, and interacting with them

## Docs

- Architecture: [`docs/architecture.md`](docs/architecture.md)
- API: [`docs/api.md`](docs/api.md)
- Development: [`docs/development.md`](docs/development.md)
- Deployment: [`docs/deployment.md`](docs/deployment.md)
- Security notes: [`docs/security.md`](docs/security.md)

## Important structure
- `apps/server/src/index.ts` — main API server and route wiring
- `apps/server/src/workspace-registry.ts` — create/list/delete/touch workspaces stored under Bird's Eye home
- `apps/server/src/session-discovery.ts` — reads session JSONL files from both `~/.birdseye/sessions` and `~/.pi/agent/sessions`, normalizes them for the UI
- `apps/server/src/pi-live-session.ts` — Pi SDK integration for resuming/creating live sessions and sending messages
- `apps/server/src/types.ts` — shared server-side API/view types
- `apps/web/src/pages/HomePage.tsx` — home/FTE-style workspace chooser
- `apps/web/src/pages/WorkspacePage.tsx` — workspace session list + session viewer + composer
- `apps/web/src/components/WorkspaceRail.tsx` — left rail / workspace switching
- `apps/web/src/components/ThemeToggle.tsx` and `apps/web/src/theme.ts` — light/dark theme support
- `apps/web/src/index.css` — almost all styling lives here
- `apps/web/public/birds-eye-sketch.png` — favicon / app mark asset copied from repo root sketch

## Dev commands
- `npm run dev` — runs server + web together
- `npm run typecheck` — typecheck all workspaces
- `npm run build -w @birds-eye/web` — build web app
- `npm run typecheck -w @birds-eye/server`
- `npm run typecheck -w @birds-eye/web`

## Current UX shape
### Home page
- Minimal title-only landing page
- Centered workspace list
- Add-workspace uses a dashed card at the bottom of the list
- Workspace delete affordance is a fading `×` in the top-right on hover

### Workspace page
- Left rail for switching workspaces
- Left column lists workspace sessions
- Right column shows selected session
- Session messages have independent expand/collapse for long entries
- Newest entries default expanded
- Session viewer scrolls independently and shows a scroll-to-bottom button when needed
- Composer lives below session messages
- Stats are hidden by default and can be toggled
- Theme toggle exists on home and workspace header

## Theme behavior
- Default theme is light
- Theme is stored in `localStorage` under `birds-eye-theme`
- `index.html` applies theme before React mounts to avoid flash
- CSS variables in `apps/web/src/index.css` drive light/dark styling

## Session data model notes
The UI does **not** read Pi SDK state directly from disk in the browser. Instead:
- server parses JSONL session files
- `session-discovery.ts` normalizes entries into `SessionDetail` / `SessionEntryView`
- usage metadata is extracted from message payloads and attached to entry metadata for stats

Session sources currently include:
- `~/.birdseye/sessions`
- `~/.pi/agent/sessions`

## Pi SDK integration notes
`apps/server/src/pi-live-session.ts` is the key integration point.

It currently manages live `AgentSession` instances in memory keyed by `viewerId` and supports:
- listing available models
- opening an existing session live
- creating a new live session
- sending a message to a live session

## Working conventions for future agents
- Prefer targeted edits over rewrites
- Run `npm run typecheck` after meaningful changes
- If touching live session behavior, inspect both:
  - `apps/server/src/pi-live-session.ts`
  - `apps/web/src/pages/WorkspacePage.tsx`
- If touching look/feel, check `apps/web/src/index.css` first; most UI styles are centralized there
- Preserve the repo's current simple/minimal visual direction unless the user asks otherwise
