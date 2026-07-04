# Contributing to Nexus Transfer

Thanks for considering a contribution. This is a small, focused project — the guidelines below are deliberately short.

## Getting set up

```bash
git clone <repo-url>
cd p2p-transfer
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev
```

Open `http://localhost:5173` in two browser windows (or one normal + one incognito) to test a transfer between two peers locally.

## Before opening a PR

- Run `npm run build` from the root and confirm it completes with no errors or warnings.
- If you touched anything in `frontend/src/lib/` (crypto, peerConnection, transferEngine, fileChunker) or `backend/src/signaling/`, **test a real transfer end-to-end** — two tabs, a small file and a large one (>10 MB to exercise chunking), pause/resume, and cancel. These are the highest-risk files in the codebase; a change that looks correct can silently break the binary wire protocol or the encryption pipeline.
- Don't leave `console.log` debug statements in committed code. `console.warn`/`console.error` for genuine error paths are fine.
- Match the existing code style — see `.prettierrc`. Run `npm run format` before committing.

## Where things live

See the **Project structure** section in [README.md](./README.md) for a full map. A few orientation notes:

- `shared/constants.js` is imported by both the frontend (via a Vite alias) and the backend (as a relative path) — changes here affect both sides. Keep frontend and backend in sync if you change wire-protocol constants.
- The binary wire protocol (header/chunk/ack/nack framing) lives in `frontend/src/lib/fileChunker.js`. If you change the frame format, both the sender and receiver code paths in that same file need to agree — there's no version negotiation, so a format change is a breaking change for anyone with the old build still open in another tab.
- `backend/src/signaling/` never touches file content — if you find yourself adding file-related logic there, it almost certainly belongs in `frontend/src/lib/transferEngine.js` instead. Keeping the server blind to file data is a core design constraint, not an implementation detail.

## Reporting bugs

Use the bug report issue template. Connection/transfer issues are much easier to debug with the in-app diagnostics panel output (RTT, connection type, packet loss) from both the sender and receiver side, plus browser + OS + network context (same LAN vs. different networks vs. behind a corporate firewall matters a lot for WebRTC issues).

## Security issues

If you find a vulnerability in the encryption pipeline, key exchange, or signaling server, please don't open a public issue. Open a private security advisory on GitHub instead, or contact the maintainer directly.

## Code of conduct

Be respectful. Disagreements about implementation are fine and expected; personal attacks are not.
