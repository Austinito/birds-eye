# Bird's Eye

Bird's Eye is a small web UI for browsing and interacting with **Pi agent sessions**, organized by **workspace**.

It is inspired by Task Factory, but focused on session viewing and live session interaction rather than task orchestration.

See also:

- [Architecture overview](docs/architecture.md#high-level-view)
- [API reference](docs/api.md)
- [Local development](docs/development.md#run-in-dev)
- [Deployment guide](docs/deployment.md#build-and-run)
- [Security notes](docs/security.md)

## Status / non-goals

Bird's Eye is currently a **v0.1**, **single-user**, **local-first** tool.

It is intended to be a **Pi session viewer with lightweight live-session interaction**, not a full hosted multi-user control plane.

Important expectations:

- **No built-in authentication or authorization**
- **Not safe to expose directly to the public internet**
- **No multi-user isolation**
- Designed primarily for local or trusted-network use

If you need remote access, put Bird's Eye behind an authenticated reverse proxy and review [docs/security.md](docs/security.md) before deploying it.

## Features

- Workspace registry stored in `~/.birdseye/workspaces.json`
- Add-workspace flow with a simple folder browser via [`GET /api/browse`](docs/api.md#file-browser)
- Session discovery by scanning `.jsonl` session files and matching session `cwd` to the workspace path
  - `~/.birdseye/sessions`
  - `~/.pi/agent/sessions`
- Workspace view:
  - left rail for switching workspaces
  - session list for the selected workspace
  - session viewer
  - sticky composer with per-session draft persistence
  - manual and AI-assisted session rename
  - session archive action
- Live sessions (Pi SDK integration):
  - open or create live sessions
  - **NDJSON streaming** with assistant text, thinking, and tool output
  - queue **steer** or **follow-up** messages while the agent is running
- Settings UI (`/settings`) for defaults:
  - default workspace
  - default model
  - default thinking level
- Light/dark theme toggle stored in browser localStorage

## Run locally

```bash
npm install
npm run dev
```

- Web UI: `http://127.0.0.1:5173`
- API server: `http://127.0.0.1:3100`

For more detail, see [docs/development.md](docs/development.md).

## Production-style local run

```bash
npm run build
npm start
```

Then open `http://127.0.0.1:3100`.

For deployment details, see [docs/deployment.md](docs/deployment.md).

## Data and state

Bird's Eye stores its own state in:

- `~/.birdseye/`
  - `workspaces.json`
  - `settings.json`
  - `pi-migration.json`
  - `pi-agent/` (optional migration output)

Session history is discovered from:

- `~/.birdseye/sessions`
- `~/.pi/agent/sessions`

More detail:

- [Architecture: data model and storage](docs/architecture.md#data-model-and-storage)
- [Development: session storage and discovery](docs/development.md#session-storage-and-discovery)
- [Security: sensitive data and storage locations](docs/security.md#sensitive-data-and-storage-locations)

## Docs

- [Development](docs/development.md)
- [Deployment](docs/deployment.md)
- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Security notes](docs/security.md)
- [Vulnerability reporting](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
