# Changelog

This file records notable user-facing changes in Bird's Eye.

Related docs:

- [README](README.md)
- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Deployment](docs/deployment.md)

This project does not enforce strict semantic versioning.

## Current

### Added
- Server-backed settings via `/api/settings`, persisted in `~/.birdseye/settings.json`
- Settings UI (`/settings`) for:
  - default workspace (`none`, `last`, or a specific workspace)
  - default model key
  - default thinking level
- Live session streaming (NDJSON) for:
  - assistant text deltas
  - thinking deltas
  - tool execution start, update, and end events
- Queue support for live sessions:
  - `steer`
  - `followUp`
- Per-session composer draft persistence in localStorage
- Arrow up/down history recall for previous user messages in the composer
- Session rename tools:
  - manual rename
  - AI-assisted short title generation
- Session archive support

### Changed
- Workspace home screen:
  - removed the existence status dot
  - missing workspaces are error-highlighted and non-navigable
- Theme toggle UI uses icon-based sun/moon controls
- Settings navigation uses a gear icon

### Fixed
- Stabilized the “start new session in existing workspace” flow so optimistic and streaming UI state do not get clobbered
