# Deployment

Related docs:

- [README](../README.md)
- [Development](development.md)
- [Architecture](architecture.md)
- [API reference](api.md)
- [Security notes](security.md)

---

Bird's Eye is a small Node.js monorepo with two packages:

- [`apps/web`](../apps/web) — Vite + React frontend
- [`apps/server`](../apps/server) — Express API server that also serves the built web assets in production

In production mode, the flow is:

1. Build the web app into `apps/web/dist`
2. Start the API server from [`apps/server/src/index.ts`](../apps/server/src/index.ts)
3. Serve:
   - API routes under `/api/*`
   - static web assets from `apps/web/dist`

> Bird's Eye has no authentication and enables permissive CORS through `cors()`.
> Deploy it only on a trusted network or behind an authenticating reverse proxy.

## Requirements

- Node.js (latest LTS recommended)
- npm (the repo includes `package-lock.json`)
- access to the user home directory where Bird's Eye writes its state:
  - `~/.birdseye`

Common additions for a long-running install:

- a reverse proxy such as nginx or Caddy for TLS and auth
- a process manager such as systemd or pm2

## Data and state locations

Bird's Eye persists runtime state under:

- `~/.birdseye/workspaces.json` — registered workspaces
- `~/.birdseye/settings.json` — saved defaults
- `~/.birdseye/pi-migration.json` — migration UI state
- `~/.birdseye/pi-agent/` — migrated Pi config and resources

Session discovery reads `.jsonl` session files from:

- `~/.birdseye/sessions`
- `~/.pi/agent/sessions`

Sessions are matched to a workspace when the session header `cwd` matches the workspace path.

Backups:

- Back up `~/.birdseye/` if you care about workspace registrations and defaults.
- Back up your Pi session directories if you care about session history.

See also:

- [Architecture: data model and storage](architecture.md#data-model-and-storage)
- [Security: sensitive data and storage locations](security.md#sensitive-data-and-storage-locations)

## Build and run

From the repo root:

```bash
npm ci
npm run build
npm run start
```

Then open:

- `http://127.0.0.1:3100`

### Ports and binding

The API server listens on:

- `PORT` if set
- otherwise `3100`

Example:

```bash
PORT=8080 npm run start
```

The server code calls `app.listen(port)` without an explicit host, so bind or firewall the service appropriately at the deployment layer.

## Reverse proxy

### nginx example

This example terminates TLS and forwards all traffic to Bird's Eye:

```nginx
server {
  listen 443 ssl;
  server_name birds-eye.internal;

  # ssl_certificate ...
  # ssl_certificate_key ...

  location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Authentication

Because Bird's Eye does not implement auth, put one of these controls in front of it:

- HTTP Basic auth over TLS
- an OAuth/OIDC proxy
- VPN-only access

## Running as a service (systemd)

Create `/etc/systemd/system/birds-eye.service`:

```ini
[Unit]
Description=Bird's Eye
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/birds-eye
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=2
Environment=PORT=3100

# Run under a dedicated user so ~/.birdseye is stable and predictable.
User=birds-eye
Group=birds-eye

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now birds-eye
sudo systemctl status birds-eye
```

Notes:

- Use a dedicated user so `~/.birdseye` stays in the expected location.
- Ensure that user can read `~/.pi/agent/sessions` if you want Bird's Eye to discover Pi sessions.

## Updating

A simple update procedure:

```bash
sudo systemctl stop birds-eye
cd /opt/birds-eye
git pull
npm ci
npm run build
sudo systemctl start birds-eye
```

## Security considerations

Bird's Eye exposes:

- filesystem path browsing via [`GET /api/browse`](api.md#file-browser)
- workspace and session metadata via the [workspace](api.md#workspaces) and [session](api.md#sessions) endpoints
- live session actions via the [live session endpoints](api.md#live-sessions)

Do not expose Bird's Eye directly to the public internet.

If you deploy behind a reverse proxy, also do the following:

- restrict who can reach the upstream service
- restrict CORS to your trusted UI origin if you customize the server
- keep Bird's Eye on a private interface or loopback address behind the proxy

For the full security posture, see [security.md](security.md).

## Troubleshooting

### Web loads but API fails

- Verify the server is running and reachable on `PORT`.
- Check that the reverse proxy forwards `/api/*` to the same upstream.

### No sessions show up

- Confirm the workspace path matches the session `cwd`.
- Confirm session files exist in either:
  - `~/.birdseye/sessions`
  - `~/.pi/agent/sessions`

### Defaults do not persist

- Verify the service user can write `~/.birdseye/settings.json`.
