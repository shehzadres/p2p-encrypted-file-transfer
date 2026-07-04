# Deployment Guide

Nexus Transfer has two independently deployable pieces:

- **Frontend** — a static React build (`frontend/dist/`). Deploy it to any static host or CDN.
- **Backend** — a long-running Node.js process (signaling + REST API). Needs a host that supports persistent WebSocket connections — most serverless platforms do **not** support this well; use a VPS, container host, or a platform with explicit WebSocket support.

The two communicate over HTTPS/WSS, so they can live on entirely different domains as long as CORS and the frontend's `VITE_API_URL`/`VITE_WS_URL` are configured to match.

---

## Table of contents

- [Option A — Docker](#option-a--docker)
- [Option B — VPS with systemd](#option-b--vps-with-systemd)
- [Option C — Vercel (frontend) + Railway/Render (backend)](#option-c--vercel-frontend--railwayrender-backend)
- [TURN server setup](#turn-server-setup)
- [Production checklist](#production-checklist)
- [Reverse proxy notes (nginx)](#reverse-proxy-notes-nginx)
- [Monitoring](#monitoring)
- [Rollback](#rollback)

---

## Option A — Docker

No Dockerfiles ship by default (the project is plain Node/Vite), but both pieces containerize cleanly.

### Backend `Dockerfile`

Create `backend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install backend + shared workspace deps
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm install --workspace=backend --omit=dev

COPY shared ./shared
COPY backend ./backend

WORKDIR /app/backend
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
```

### Frontend `Dockerfile` (static build served by nginx)

Create `frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
RUN npm install --workspace=frontend
COPY shared ./shared
COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Add `frontend/nginx.conf`:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # SPA fallback — all routes serve index.html, React Router handles the rest
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache hashed assets aggressively; the vendor-crypto chunk in particular
  # never changes between deploys unless libsodium itself is upgraded
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

### docker-compose.yml (root)

```yaml
version: "3.8"
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - CORS_ORIGIN=https://your-frontend-domain.com
      - TURN_URL=turn:your-turn-server:3478
      - TURN_SECRET=${TURN_SECRET}
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "80:80"
    restart: unless-stopped
```

```bash
docker compose up -d --build
```

---

## Option B — VPS with systemd

For a single Linux server running both the backend process and an nginx reverse proxy serving the static frontend.

### 1. Build

```bash
git clone <your-repo> /opt/nexus-transfer
cd /opt/nexus-transfer
npm install
npm run build                  # produces frontend/dist
```

### 2. Backend systemd unit

`/etc/systemd/system/nexus-backend.service`:

```ini
[Unit]
Description=Nexus Transfer signaling server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/nexus-transfer/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production
EnvironmentFile=/opt/nexus-transfer/backend/.env
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nexus-backend
sudo systemctl status nexus-backend
```

### 3. nginx — serve frontend + proxy backend

See [Reverse proxy notes](#reverse-proxy-notes-nginx) below for the full config. Point nginx's static root at `/opt/nexus-transfer/frontend/dist` and proxy `/api` and `/ws` to `localhost:3001`.

### 4. TLS

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

WebRTC and the Web Crypto API both require a secure context (HTTPS) in production — this is not optional.

---

## Option C — Vercel (frontend) + Railway/Render (backend)

**Frontend on Vercel:**

1. Import the repo, set the project root to `frontend/`
2. Build command: `npm run build` (Vercel auto-detects Vite)
3. Output directory: `dist`
4. Environment variables: `VITE_API_URL`, `VITE_WS_URL` pointing at your backend's deployed URL

**Backend on Railway or Render:**

Both support long-running Node processes with WebSocket support (unlike most serverless platforms).

1. Root directory: `backend/`
2. Build command: `npm install`
3. Start command: `node src/index.js`
4. Set environment variables from the table in the main README — critically `CORS_ORIGIN` must exactly match your Vercel frontend's URL (including `https://`)
5. Both platforms provide a public URL automatically — use it as `VITE_API_URL` (with `/api` appended) and the `wss://` equivalent as `VITE_WS_URL` (with `/ws` appended) back in the frontend's environment variables

**Important:** these platforms auto-assign HTTPS, which the app requires — there is no extra TLS step needed for the backend in this configuration.

---

## TURN server setup

Without TURN, peers behind symmetric NATs or restrictive corporate firewalls cannot connect to each other at all — STUN alone is not sufficient for those network topologies. A TURN server is the single most impactful thing you can add to maximize successful connection rates in production.

### Self-hosted: coturn

```bash
sudo apt install coturn
```

`/etc/turnserver.conf`:

```
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=<generate a long random string>
realm=your-domain.com
total-quota=100
stale-nonce=600
cert=/etc/letsencrypt/live/your-domain.com/fullchain.pem
pkey=/etc/letsencrypt/live/your-domain.com/privkey.pem
no-stdout-log
```

Then set in `backend/.env`:

```
TURN_URL=turn:your-domain.com:3478
TURN_SECRET=<the same static-auth-secret from turnserver.conf>
TURN_TTL_SECONDS=86400
```

The backend's `/api/ice-config` endpoint generates fresh HMAC-SHA1 time-limited credentials per request using this shared secret — no long-lived TURN password is ever exposed to clients.

### Managed alternative

Any RFC 5766-compatible TURN provider works. Set `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` instead of `TURN_SECRET` if the provider gives you static credentials rather than a shared secret.

---

## Production checklist

- [ ] `NODE_ENV=production` set on the backend
- [ ] `CORS_ORIGIN` matches the exact frontend origin (scheme + host, no trailing slash)
- [ ] Both frontend and backend served over HTTPS/WSS — WebRTC and Web Crypto require a secure context
- [ ] TURN configured (`TURN_URL` + either `TURN_SECRET` or `TURN_USERNAME`/`TURN_CREDENTIAL`) for reliable connectivity across all network types
- [ ] `frontend/.env` points `VITE_API_URL`/`VITE_WS_URL` at the real backend domain, not localhost
- [ ] Backend process has a restart policy (systemd `Restart=on-failure`, Docker `restart: unless-stopped`, or platform-equivalent) — the app already handles `SIGTERM`/`SIGINT` gracefully and has `uncaughtException`/`unhandledRejection` safety nets, but a process manager should still restart it after a hard crash
- [ ] Reverse proxy (if used) passes through WebSocket upgrade headers correctly — see nginx config below
- [ ] `LOG_LEVEL=info` (not `debug`) in production to avoid log volume from verbose tracing

---

## Reverse proxy notes (nginx)

WebSocket connections require explicit `Upgrade`/`Connection` header forwarding — a default nginx proxy config will silently fail to establish the signaling connection without this:

```nginx
server {
  listen 443 ssl;
  server_name your-domain.com;

  ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  # Static frontend
  root /opt/nexus-transfer/frontend/dist;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # REST API
  location /api/ {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # WebSocket signaling — Upgrade headers are mandatory here
  location /ws {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;   # keep long-lived WS connections alive
  }
}
```

---

## Monitoring

The backend exposes `GET /api/health`, returning:

```json
{
  "status": "ok",
  "timestamp": "2026-06-30T12:00:00.000Z",
  "turn": true,
  "totalRooms": 3,
  "totalPeers": 5
}
```

Point an uptime monitor (UptimeRobot, Better Uptime, a cron + curl, etc.) at this endpoint. A `turn: false` response when you expect TURN to be configured indicates a misconfigured or unreachable `TURN_URL`.

Structured logs are written via `backend/src/utils/logger.js` with level-gating (`LOG_LEVEL`). In production, pipe stdout to your platform's log aggregator (Docker's logging driver, systemd's journal, or the hosting platform's built-in log viewer) — no separate log shipping is built in.

---

## Rollback

Since the backend holds all state in memory (by design — rooms and peer connections are intentionally ephemeral and never persisted), a rollback is just a redeploy of the previous build. There is no database migration or data loss risk: restarting the backend simply drops all currently active rooms, and connected clients will see a `room-expired` or connection-error state and can create a new room.
