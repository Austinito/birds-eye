# Contributing

Thanks for helping improve Bird's Eye.

Bird's Eye is intentionally minimal: it is a workspace and session viewer for Pi agent sessions, with a small amount of live-session interaction.

Start here:

- [README](README.md)
- [Development guide](docs/development.md)
- [Architecture overview](docs/architecture.md)
- [API reference](docs/api.md)
- [Security docs](SECURITY.md) and [docs/security.md](docs/security.md)

## Getting started

Install dependencies:

```bash
npm install
```

Run the dev servers:

```bash
npm run dev
```

See [docs/development.md](docs/development.md) for deeper notes on the local workflow.

## Development workflow

### Code style

- Prefer small, targeted changes.
- Keep the UI minimal and consistent with the existing visual direction.
- Prefer TypeScript types over `any`.
- When behavior changes, update the relevant docs in [README](README.md), [docs/api.md](docs/api.md), [docs/architecture.md](docs/architecture.md), or [docs/security.md](docs/security.md).

### Suggested checks before submitting

```bash
npm run typecheck
npm run build
```

### Files to know

Server:

- [`apps/server/src/index.ts`](apps/server/src/index.ts) — API routes
- [`apps/server/src/session-discovery.ts`](apps/server/src/session-discovery.ts) — JSONL parsing and normalization
- [`apps/server/src/pi-live-session.ts`](apps/server/src/pi-live-session.ts) — live Pi session lifecycle and streaming

Web:

- [`apps/web/src/pages/HomePage.tsx`](apps/web/src/pages/HomePage.tsx)
- [`apps/web/src/pages/WorkspacePage.tsx`](apps/web/src/pages/WorkspacePage.tsx)
- [`apps/web/src/pages/SettingsPage.tsx`](apps/web/src/pages/SettingsPage.tsx)
- [`apps/web/src/index.css`](apps/web/src/index.css)

## Reporting bugs

When filing an issue, include:

- what you expected vs. what happened
- browser and OS
- whether you are using Pi migration
- any relevant server logs

If the bug is session-related, include:

- workspace path
- whether the session is from `~/.pi/agent/sessions` or `~/.birdseye/sessions`
- whether the issue happens with a new session or an existing one

## Making changes

### API changes

- Document new endpoints or behavior changes in [docs/api.md](docs/api.md).
- Keep backwards compatibility when possible; the UI expects stable response shapes.

### UI changes

- Keep changes accessible: labels, titles, and focus states matter.
- Prefer updating [`apps/web/src/index.css`](apps/web/src/index.css) rather than scattering inline styles.

## Commit guidance

This repo does not enforce a strict commit format, but these patterns work well:

- concise subject line
- include the area touched (`web`, `server`, `docs`)

Examples:

- `web: improve session composer layout`
- `server: add settings endpoint`
- `docs: update API documentation`
