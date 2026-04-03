# Security

## Purpose and scope

This document describes the security posture, trust boundaries, and operating guidance for Bird's Eye.

- Vulnerability disclosure and reporting live in [../SECURITY.md](../SECURITY.md).
- This document covers how Bird's Eye behaves and how to run it safely.

> Bird's Eye is best treated as a local, single-user developer tool. It exposes local filesystem metadata, session transcripts, and live Pi session controls.

## Security posture

Bird's Eye consists of:

- [`apps/web`](../apps/web): a React and Vite browser UI
- [`apps/server`](../apps/server): an Express API that
  - reads session data from local JSONL session files
  - manages a local workspace registry under `~/.birdseye`
  - can migrate Pi agent config into `~/.birdseye/pi-agent/`
  - can create or resume live Pi sessions and send messages to them

Security-relevant properties of the implementation:

- **No authentication or authorization.** Any client that can reach the server can call every API endpoint.
- **CORS is enabled with default settings** through `cors()` in [`apps/server/src/index.ts`](../apps/server/src/index.ts).
- **The server listens without an explicit host binding** by calling `app.listen(port)`, so network exposure depends on the environment and deployment layer.
- **Live sessions are control-plane actions.** Prompts sent through Bird's Eye can trigger tool calls depending on the underlying Pi runtime configuration.

## Trust boundaries and threat model

### Trust boundaries

Bird's Eye crosses these security boundaries:

1. **Browser to API server**
   - the browser can request session transcripts, browse folders, and send live-session actions
2. **API server to local filesystem**
   - the server reads and writes state under `~/.birdseye`
   - it reads session JSONL files from Bird's Eye and Pi session directories
   - it exposes a folder browser endpoint that reads directories on disk
3. **API server to Pi SDK and model providers**
   - live sessions may contact external model providers using credentials from Pi auth storage

### Primary threats

- **Unauthenticated access**
  - enumerate directories through `/api/browse`
  - read session transcripts that may contain secrets
  - start or resume live Pi sessions and send prompts
- **Cross-site request abuse**
  - with permissive CORS and no auth, a malicious page may be able to trigger requests to a reachable Bird's Eye server
- **Information disclosure**
  - session transcripts may contain proprietary code, credentials, file paths, and tool output
  - APIs return local absolute paths such as workspace paths and session file paths
- **Indirect code execution**
  - depending on Pi tool configuration, prompts may trigger commands or file modifications

## Sensitive data and storage locations

### Bird's Eye home directory

Bird's Eye stores state under:

- `~/.birdseye/`
  - `workspaces.json` — workspace registry
  - `settings.json` — saved defaults
  - `pi-migration.json` — migration decision state
  - `pi-agent/` — optional copied Pi config and resources

Treat `~/.birdseye` as sensitive. It contains local paths and may contain copied credentials.

### Session transcripts

The server reads session JSONL files from:

- `~/.birdseye/sessions/`
- `~/.pi/agent/sessions/`

It may also archive into:

- `~/.birdseye/archived-sessions/`
- `~/.pi/agent/archived-sessions/`

Session files commonly contain:

- full user prompts and assistant responses
- tool call arguments and results
- usage and cost metadata
- timestamps and local `cwd`

### Migrated Pi configuration (credentials)

Bird's Eye includes a migration helper that can copy selected Pi agent resources from:

- `~/.pi/agent/…` to `~/.birdseye/pi-agent/…`

One category is **auth**, which includes `auth.json`.

Treat `auth.json` and the migrated Pi directory as secrets. Keep filesystem permissions tight and do not copy or share them casually.

## API surface: security-relevant behaviors

This section highlights the most security-sensitive endpoints. For the full contract, see [api.md](api.md).

- [`GET /api/browse?path=…`](api.md#file-browser)
  - resolves and reads directories on disk
  - returns subfolder names and absolute paths
- [Workspace endpoints](api.md#workspaces)
  - persist absolute workspace paths and return them to the UI
- [Session endpoints](api.md#sessions)
  - return session summaries and full session transcripts
- [Live session endpoints](api.md#live-sessions)
  - start or resume sessions and send prompts
  - expose streaming responses over NDJSON

## Web UI security notes

Bird's Eye renders session entry content as plain text in the web UI, which avoids raw HTML injection in normal transcript rendering.

Any rich rendering path must continue to treat session content as untrusted input and sanitize before injecting HTML into the page.

## Running Bird's Eye safely

### Baseline deployment rules

Use these rules for any real deployment:

1. Keep Bird's Eye on a trusted network only.
2. Put it behind an authenticating reverse proxy if anyone accesses it remotely.
3. Restrict direct access to the upstream port with firewall rules, loopback-only binding, or private networking.
4. Treat the UI as a control plane for the local Pi runtime on that machine.

### Shared-network access

If you expose Bird's Eye beyond localhost:

- terminate TLS at the proxy
- require authentication before requests reach Bird's Eye
- restrict which users or networks can reach the service
- review whether `/api/browse` should be reachable at all

Bird's Eye does not implement multi-user isolation. Every authenticated user at the proxy layer reaches the same underlying filesystem and Pi credentials.

## Operational hardening checklist

### Network and HTTP

- Prefer loopback-only or private-network exposure for the Bird's Eye process.
- Add authentication and access control at the reverse proxy.
- Restrict allowed origins if you customize the server for cross-origin access.
- Add rate limiting and request-size limits at the proxy or application layer.
- Add standard HTTP security headers at the proxy, such as:
  - `Content-Security-Policy` where practical
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy`
  - `X-Frame-Options` or `frame-ancestors`

### Filesystem and secrets

- Keep `~/.birdseye` readable only by the service user.
- Avoid migrating `auth.json` unless you need it.
- Rotate or revoke copied credentials when they are no longer needed.
- Avoid logging secrets or full transcripts in production environments.

### Live sessions and tool execution

- Treat message-send and queue actions as privileged operations.
- Review the tool configuration available to the underlying Pi runtime.
- Use explicit UI or proxy-level access controls for machines that can modify source trees or run shell commands.

### Dependencies and supply chain

- Keep dependencies updated.
- Run dependency auditing in CI or as part of release hygiene.
- Use minimal-permission CI and deployment credentials.

## Related documents

- [README](../README.md)
- [Security policy / vulnerability reporting](../SECURITY.md)
- [Deployment](deployment.md)
- [Architecture](architecture.md)
- [API reference](api.md)
