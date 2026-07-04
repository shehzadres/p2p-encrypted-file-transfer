# Nexus Transfer

**Production-grade peer-to-peer encrypted file transfer. No uploads. No file storage. No compromise.**

Files travel directly from one browser to another over a WebRTC DataChannel, encrypted end-to-end with libsodium. The server's only job is introducing two browsers to each other — it never sees, stores, or has the ability to decrypt a single byte of transferred data.

```
Browser A ──────────── WebRTC DataChannel ──────────── Browser B
   │            (encrypted, peer-to-peer, direct)            │
   │                                                          │
   └──────────────── Signaling Server ───────────────────────┘
              (room bookkeeping + SDP/ICE relay only)
```

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [API reference](#api-reference)
- [Deployment](#deployment)
- [Browser support](#browser-support)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Direct browser-to-browser transfer** over WebRTC DataChannels — no file ever touches a server
- **End-to-end encryption**: X25519 key exchange, XChaCha20-Poly1305 (via `crypto_secretstream`) for chunk encryption, AEAD for metadata, BLAKE2b-256 for integrity verification
- **Session fingerprint** displayed to both parties for out-of-band MITM detection
- **Drag-and-drop** file and folder uploads, multi-file queueing
- **Chunked streaming pipeline** with sliding-window ACKs, automatic retry on dropped chunks, and adaptive chunk sizing (16 KB–512 KB based on file size)
- **Pause / resume / cancel** any transfer mid-flight
- **Large-file optimization**: files over 500 MB stream directly to disk via the File System Access API instead of accumulating in memory
- **QR code pairing** with a full-screen modal, Web Share API integration, and live expiry countdown
- **Multi-recipient broadcast** — send to up to 9 simultaneous recipients in one room
- **Self-destructing links** — single-use rooms that expire after the first completed transfer
- **TURN fallback** for restrictive NATs, with HMAC time-limited credentials served from the backend (never bundled in client code)
- **Automatic ICE recovery**: exponential-backoff restarts, relay escalation after repeated STUN failures, and reconnection on tab re-focus
- **Live connection diagnostics**: RTT, packet loss, jitter, bandwidth, candidate type, and a derived quality score
- **Transfer history**, browser notifications, and toast feedback
- **Dark and light themes** with system-preference detection and no flash-of-wrong-theme
- **Full accessibility**: skip-nav link, ARIA roles throughout, keyboard navigation, `prefers-reduced-motion` support

## Architecture

The system has three independent layers:

1. **Signaling** (`backend/`) — a Node.js/Express + `ws` server that does *only* three things: track which peers are in which room, relay WebRTC offer/answer/ICE messages between them, and serve TURN credentials. It has no concept of files and physically cannot decrypt transferred data, since it never receives any.

2. **WebRTC transport** (`frontend/src/lib/peerConnection.js`) — establishes a direct DataChannel between browsers using the Perfect Negotiation pattern (collision-safe offer/answer exchange), with automatic ICE restart and TURN relay escalation if the direct path fails.

3. **Encrypted transfer pipeline** (`frontend/src/lib/transferEngine.js`, `fileChunker.js`, `crypto.js`) — runs entirely client-side. Splits files into encrypted chunks, streams them with flow control and acknowledgements, verifies integrity end-to-end, and writes the result to disk.

```
frontend/src/lib/
├── crypto.js          libsodium wrappers: key exchange, AEAD, secretstream, BLAKE2b
├── signalingClient.js WebSocket client with reconnect + keepalive
├── peerConnection.js  WebRTC peer wrapper: negotiation, ICE, diagnostics, backpressure
├── fileChunker.js     Binary wire protocol, sliding window, adaptive chunk sizing
├── transferEngine.js  Orchestrates the above into a full encrypted transfer
└── browserCompat.js   Feature detection, ICE config fetch, quality scoring
```

## Security model

| Concern | Implementation |
|---|---|
| Key exchange | X25519 (Curve25519) via `crypto_kx`, ephemeral per session |
| Chunk encryption | XChaCha20-Poly1305 via `crypto_secretstream` — built-in sequence numbers, replay protection, and a `TAG_FINAL` sentinel on the last chunk |
| Per-file keys | Derived from the session key via `crypto_kdf` — no key reuse across files within one session |
| Metadata encryption | XChaCha20-Poly1305-IETF AEAD, with the transfer ID as additional authenticated data (binds ciphertext to one specific transfer, preventing replay across transfers) |
| Integrity | Streaming BLAKE2b-256 over the plaintext, computed during encryption (sender) and decryption (receiver), compared after the final chunk |
| MITM detection | Session fingerprint = BLAKE2b-256 of both public keys (stable ordering), shown to both parties for manual verification |
| Server visibility | Room ID, peer count, and opaque SDP/ICE blobs only — the signaling server cannot read SDP content meaningfully (it's not file data) and never sees encryption keys, file names, or file contents |
| Key hygiene | Session and per-file keys are zeroed (`zeroKey()`) immediately after use and on connection teardown |
| Transport | DLTS-SRTP via WebRTC's mandatory encryption, on top of the application-layer encryption above (defense in depth) |

**What the server *can* see:** room IDs, connection timing, peer IP addresses (standard for any WebRTC signaling server), and the size of SDP/ICE messages it relays.

**What the server can never see:** file names, file contents, file sizes, encryption keys, or the session fingerprint.

## Tech stack

**Frontend** — React 18, Vite, Tailwind CSS, React Router, libsodium-wrappers, `qrcode`

**Backend** — Node.js (ES modules), Express, `ws`, `nanoid`, `express-rate-limit`, `helmet`

**Monorepo** — npm workspaces

## Project structure

```
p2p-transfer/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/       AppShell, header, footer
│   │   │   ├── transfer/     DropZone, TransferItem, diagnostics, security panel
│   │   │   ├── qr/           QR code display + pairing modal
│   │   │   └── ui/           Button, Badge, Toast, Skeleton, EmptyState, ThemeToggle…
│   │   ├── hooks/            useRoom, useDropZone, useTheme, useNotifications…
│   │   ├── lib/               crypto, peerConnection, transferEngine, fileChunker…
│   │   ├── pages/             HomePage, TransferPage, ReceivePage, NotFoundPage
│   │   ├── store/             appStore.jsx — reducer + selectors
│   │   └── styles/            globals.css — theme tokens, glassmorphism, animations
│   ├── vite.config.js
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   ├── signaling/         RoomManager, signalingServer (WS handler)
│   │   ├── middleware/        CORS, helmet, rate limiting
│   │   ├── utils/             logger
│   │   ├── routes.js          REST API (rooms, ICE config, health)
│   │   └── index.js           Entry point
│   └── config/                Environment config loader
└── shared/
    └── constants.js           Event names, chunk sizes, timeouts — imported by both sides
```

## Getting started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Two browser windows/devices for testing (sender + receiver)

### Install

```bash
npm install
```

This installs dependencies for the root, `frontend/`, and `backend/` workspaces in one pass.

### Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

The defaults work out of the box for local development. See [Configuration](#configuration) for production values, especially TURN credentials.

### Run in development

```bash
npm run dev
```

This starts both servers concurrently:
- Frontend: **http://localhost:5173**
- Backend: **http://localhost:3001**

Open the frontend URL in two browser windows (or one normal + one incognito) to test a transfer between two "peers" on the same machine.

### Build for production

```bash
npm run build      # builds the frontend into frontend/dist
npm start           # starts the backend (serves the API + WebSocket only)
```

The backend does **not** serve the frontend's static files — see [Deployment](#deployment) for how to host them.

## Configuration

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP/WebSocket port |
| `NODE_ENV` | `development` | `development` or `production` |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `ROOM_CLEANUP_INTERVAL_MS` | `60000` | How often expired rooms are pruned |
| `LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug` |
| `TURN_URL` | _(empty)_ | e.g. `turn:turn.example.com:3478` — leave empty to run STUN-only |
| `TURN_USERNAME` / `TURN_CREDENTIAL` | _(empty)_ | Static TURN credentials (use **either** this pair **or** `TURN_SECRET`) |
| `TURN_SECRET` | _(empty)_ | Shared secret for HMAC time-limited TURN credentials (coturn-compatible, RFC 5766) — preferred over static credentials |
| `TURN_TTL_SECONDS` | `86400` | How long HMAC TURN credentials remain valid |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_WS_URL` | `ws://localhost:3001/ws` | Signaling WebSocket endpoint |
| `VITE_API_URL` | `http://localhost:3001/api` | Signaling REST endpoint |
| `VITE_APP_NAME` | `Nexus Transfer` | Display name |

In production, point both at your deployed backend's public URL (`wss://` and `https://` respectively).

### TURN servers

STUN alone is sufficient for most networks, but symmetric NATs and some corporate firewalls require a TURN relay. Without TURN configured, transfers between peers on such networks will fail to connect. You can use any RFC 5766-compatible TURN server (coturn is a common self-hosted option, or a managed service). Configure either static or HMAC credentials — HMAC is recommended since credentials rotate automatically and are never stored long-term.

## Scripts

Run from the repo root:

| Command | Effect |
|---|---|
| `npm run dev` | Start both frontend and backend in watch mode |
| `npm run build` | Production build of the frontend |
| `npm start` | Start the backend in production mode |
| `npm run lint` | Lint both workspaces |
| `npm run format` | Format all files with Prettier |

## API reference

All endpoints are under `${VITE_API_URL}` (default `http://localhost:3001/api`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server status, room/peer counts, TURN availability |
| `GET` | `/ice-config` | RTCConfiguration `iceServers` array (STUN + TURN if configured) |
| `POST` | `/rooms` | Create a room. Body: `{ selfDestruct?, expiryTier?, maxPeers? }` |
| `GET` | `/rooms/:roomId` | Room metadata (peer count, expiry, self-destruct status) |
| `POST` | `/rooms/:roomId/done` | Mark a self-destruct room's transfer complete |

WebSocket signaling (`${VITE_WS_URL}`) uses a JSON envelope `{ event, data }` — see `shared/constants.js` for the full event list and `backend/src/signaling/signalingServer.js` for the handler implementation.

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for platform-specific guides (Docker, a VPS with systemd, Vercel + Railway, and a managed TURN setup).

## Browser support

Requires WebRTC DataChannels, WebAssembly (for libsodium), Web Crypto, and `Blob`/`URL.createObjectURL`. Verified on:

- Chrome / Edge 80+
- Firefox 75+
- Safari 15+

The app runs a capability check (`frontend/src/lib/browserCompat.js`) on startup and shows a clear error screen listing exactly which API is missing if the browser doesn't qualify, rather than failing silently or partially.

Large-file disk streaming (files >500 MB) additionally uses the File System Access API (`showSaveFilePicker`), currently Chromium-only; other browsers automatically fall back to in-memory assembly for those files.

## Known limitations

- **No resumable transfers across page reloads.** Pause/resume works within a session, but closing the tab loses transfer state — there's no persisted chunk log to resume from on reload.
- **Multi-recipient mode sends sequentially per peer, not as a true broadcast.** Each connected peer gets an independent encrypted stream; bandwidth scales linearly with recipient count rather than using a multicast tree.
- **Self-destruct rooms are time-windowed (1 hour) in addition to single-use.** If the recipient never joins, the room still expires on the timer even though no transfer occurred.
- **No persistent server-side audit log.** This is intentional (privacy-by-design — the server is meant to know as little as possible) but means there's no way to investigate abuse after a room has expired.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, testing expectations, and where things live in the codebase.

## License

MIT
