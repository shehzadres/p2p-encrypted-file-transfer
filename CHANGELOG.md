# Changelog

All notable changes to this project, organized by development phase.

## [1.0.0] — Production release

### Phase 10 — Production hardening
- Fixed a broken relative import path in `backend/src/routes.js` that prevented the server from booting in a real deployment
- Fixed malformed JSON requests returning `500` instead of `400`
- Fixed CORS only allowing `GET, OPTIONS` (blocked `POST /api/rooms` in production)
- Added REST API rate limiting (`express-rate-limit`) — previously only WebSocket messages were rate-limited
- Added input validation on all room routes (room ID pattern, `expiryTier` enum, `maxPeers` range)
- Added global Express error handler, `SIGINT` support, graceful WebSocket shutdown, `uncaughtException`/`unhandledRejection` safety nets
- Fixed a duplicate `getStats()` polling bug — the diagnostics panel was running its own independent poll on top of `PeerConnection`'s existing one
- Vite bundle splitting — isolated libsodium's WASM blob into its own cacheable chunk
- Removed dead code: unused constants, dead exports, an unused legacy plaintext-message fallback
- Full README, deployment guide, and this changelog

### Phase 9 — Production-quality UI + theming
- Glassmorphism design system, refined typography, animation library
- Empty states, loading skeletons, error states throughout
- Full accessibility pass: skip-nav link, ARIA roles, keyboard navigation, `prefers-reduced-motion`
- Light/dark theme with system-preference detection and no flash-of-wrong-theme

### Phase 8 — Networking improvements
- TURN server fallback with HMAC time-limited credentials, served from a backend endpoint
- ICE gather timeout, exponential-backoff restart, relay escalation after repeated failures
- Page visibility recovery (reconnects when a backgrounded tab regains focus)
- Extended RTCStats: packet loss, jitter, candidate addresses, derived quality score
- Browser capability check on startup with a clear error screen for unsupported browsers

### Phase 7 — Advanced features
- Full-screen QR pairing modal with Web Share API and live expiry countdown
- Multi-recipient broadcast (up to 9 simultaneous recipients per room)
- Self-destructing single-use room links
- Per-recipient transfer tracking in the UI

### Phase 6 — Transfer experience
- EMA-smoothed speed and ETA calculation, peak speed tracking
- Browser notifications + in-app toast system
- Transfer history (persists across room resets)
- Multi-transfer state management with aggregate progress

### Phase 5 — Streaming pipeline
- Adaptive chunk sizing (16 KB–512 KB based on file size)
- Sliding-window chunk acknowledgements with automatic retry on failure
- Pause / resume / cancel with checkpoint-based resume
- Large-file (>500 MB) streaming directly to disk via the File System Access API

### Phase 4 — Encrypted file transfer
- Replaced the wrong cipher primitive (`crypto_secretbox`) with the correct one (`crypto_secretstream_xchacha20poly1305`)
- Per-file subkey derivation via `crypto_kdf`
- AEAD-encrypted metadata (filename, size, type) bound to the transfer ID
- Streaming BLAKE2b-256 integrity verification
- Session fingerprint for manual MITM detection
- Binary wire protocol replacing base64-JSON (≈33% bandwidth savings)

### Phase 3 — WebRTC
- Perfect Negotiation pattern for collision-safe offer/answer exchange
- ICE candidate queuing, DataChannel backpressure via `bufferedamountlow`
- RTCStats-based connection diagnostics panel

### Phase 2 — Signaling
- Room lifecycle (create/join/leave), peer discovery, SDP/ICE relay
- WebSocket heartbeat, reconnection with exponential backoff, per-peer rate limiting

### Phase 1 — Foundation
- Monorepo scaffold (React/Vite frontend, Express/ws backend, npm workspaces)
- Landing page, room/transfer page skeletons, signaling server bootstrap
