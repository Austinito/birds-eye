# Development

This doc covers local development workflows for Bird's Eye.

Related docs:

- [README](../README.md)
- [Architecture overview](architecture.md)
- [API reference](api.md)
- [Deployment](deployment.md)
- [Security notes](security.md)

## Repo layout

- [`apps/server`](../apps/server) — Express API server
- [`apps/web`](../apps/web) — Vite + React UI
- [`reference/task-factory`](../reference/task-factory) — reference implementation, not part of the Bird's Eye build
- [`skills/`](../skills) — prompt and skill resources used by the server, including session title generation

## Requirements

- Node.js (latest LTS recommended)
- npm

## Install

From the repo root:

```bash
npm install
```

Use `npm ci` if you want a clean install from the lockfile.

## Run in dev

Run server and web together:

```bash
npm run dev
```

Default URLs:

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3100`

Notes:

- the server uses `tsx watch` to reload on changes
- the web app uses Vite HMR

The root scripts live in [`package.json`](../package.json).

## Typecheck

Typecheck everything:

```bash
npm run typecheck
```

Or run package-specific checks:

```bash
npm run typecheck -w @birds-eye/server
npm run typecheck -w @birds-eye/web
```

## Build and run

Build the web app and run the server serving static assets:

```bash
npm run build
npm run start
```

Then open:

- `http://127.0.0.1:3100`

See [deployment.md](deployment.md) for service and reverse-proxy setup.

## Useful local reset points

### Workspaces

Workspaces are stored at:

- `~/.birdseye/workspaces.json`

Delete that file to reset the workspace list during development.

### Bird's Eye settings

Settings are stored at:

- `~/.birdseye/settings.json`

Delete it to reset saved defaults.

### Session storage and discovery

Sessions are discovered from:

- `~/.birdseye/sessions`
- `~/.pi/agent/sessions`

A session belongs to a workspace when the session header `cwd` matches the workspace path.

See also:

- [Architecture: data model and storage](architecture.md#data-model-and-storage)
- [API: session discovery](api.md#session-discovery)

### Migration state

Migration prompt state is stored at:

- `~/.birdseye/pi-migration.json`

Delete it to trigger the migration prompt again.

## Debugging tips

### Live session streaming

The streaming endpoint is:

- `POST /api/workspaces/:workspaceId/sessions/:viewerId/live/message/stream`

It returns NDJSON. You can hit it with `curl` to inspect the raw event stream.

### UI drafts

Session drafts are stored in browser localStorage under keys like:

- `birds-eye:session-draft:<workspaceId>:<viewerId>`

### Theme

Theme is stored in localStorage under:

- `birds-eye-theme`

On first run, if no theme key is set, Bird's Eye adopts the browser or system preference and persists it.

## Code navigation

### Server hotspots

- [`apps/server/src/index.ts`](../apps/server/src/index.ts) — route wiring
- [`apps/server/src/session-discovery.ts`](../apps/server/src/session-discovery.ts) — JSONL parsing and normalization
- [`apps/server/src/pi-live-session.ts`](../apps/server/src/pi-live-session.ts) — Pi SDK integration and streaming
- [`apps/server/src/birdseye-settings.ts`](../apps/server/src/birdseye-settings.ts) — settings persistence and validation

### Web hotspots

- [`apps/web/src/pages/HomePage.tsx`](../apps/web/src/pages/HomePage.tsx) — workspace selection
- [`apps/web/src/pages/WorkspacePage.tsx`](../apps/web/src/pages/WorkspacePage.tsx) — session list, viewer, and composer
- [`apps/web/src/pages/SettingsPage.tsx`](../apps/web/src/pages/SettingsPage.tsx) — app preferences
- [`apps/web/src/api.ts`](../apps/web/src/api.ts) — client API wrapper
- [`apps/web/src/index.css`](../apps/web/src/index.css) — most styles
