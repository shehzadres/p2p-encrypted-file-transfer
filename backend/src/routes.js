import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { ROOM_CONFIG } from '../../shared/constants.js';

const EXPIRY_PRESETS = {
  hour:  60 * 60 * 1000,
  day:   24 * 60 * 60 * 1000,
  week:  7  * 24 * 60 * 60 * 1000,
  never: 0,
};

const VALID_EXPIRY_TIERS = new Set(Object.keys(EXPIRY_PRESETS));

// nanoid default alphabet: A-Za-z0-9_-
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

// ── ICE config builder ─────────────────────────────────────────────────────

/**
 * Build RTCConfiguration iceServers array.
 * If TURN is configured, includes TURN with either:
 *   - Static credentials (TURN_USERNAME + TURN_CREDENTIAL), or
 *   - HMAC time-limited credentials (TURN_SECRET, coturn compatible)
 *
 * Always includes public STUN servers as fallback.
 */
function buildIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302'  },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const { url, username, credential, secret, ttlSeconds } = config.turn;
  if (!url) return servers;

  if (secret) {
    // HMAC-SHA1 time-limited credentials (coturn / RFC 5766)
    const expiry   = Math.floor(Date.now() / 1000) + ttlSeconds;
    const turnUser = `${expiry}:nexus`;
    const hmac     = crypto.createHmac('sha1', secret);
    hmac.update(turnUser);
    const turnCred = hmac.digest('base64');

    servers.push(
      { urls: url,                            username: turnUser, credential: turnCred },
      { urls: url.replace('turn:', 'turns:'), username: turnUser, credential: turnCred },
    );
  } else if (username && credential) {
    // Static credentials
    servers.push(
      { urls: url,                            username, credential },
      { urls: url.replace('turn:', 'turns:'), username, credential },
    );
  }

  return servers;
}

// ── Input validation helpers ────────────────────────────────────────────────

function isValidRoomId(id) {
  return typeof id === 'string' && ROOM_ID_PATTERN.test(id);
}

function sanitizeCreateRoomBody(body) {
  const selfDestruct = body?.selfDestruct === true;

  const expiryTier = VALID_EXPIRY_TIERS.has(body?.expiryTier)
    ? body.expiryTier
    : 'day';

  // maxPeers must be a finite integer within [2, ROOM_CONFIG.MAX_PEERS_PER_ROOM].
  // Anything else (including malicious huge numbers, NaN, strings) falls back
  // to the default. RoomManager also clamps server-side as defense-in-depth.
  const rawMaxPeers = Number(body?.maxPeers);
  const maxPeers = Number.isInteger(rawMaxPeers) && rawMaxPeers >= 2
    ? Math.min(rawMaxPeers, ROOM_CONFIG.MAX_PEERS_PER_ROOM)
    : 10;

  return { selfDestruct, expiryTier, maxPeers };
}

export function createRoutes(rooms) {
  const router = Router();

  // ── Health ──────────────────────────────────────────────────────────────
  router.get('/health', (_req, res) => {
    res.json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      turn:      Boolean(config.turn.url),
      ...rooms.stats(),
    });
  });

  // ── ICE config (served to clients so credentials never ship in frontend) ──
  router.get('/ice-config', (_req, res) => {
    const iceServers = buildIceServers();
    const hasTurn    = iceServers.some((s) => s.urls?.toString().startsWith('turn'));

    res.json({
      iceServers,
      hasTurn,
      expiresIn: config.turn.secret ? config.turn.ttlSeconds : null,
    });
  });

  // ── Rooms ───────────────────────────────────────────────────────────────
  router.post('/rooms', (req, res) => {
    const { selfDestruct, expiryTier, maxPeers } = sanitizeCreateRoomBody(req.body);

    const resolvedMaxPeers = selfDestruct ? 2 : maxPeers;
    const expiryMs = selfDestruct
      ? EXPIRY_PRESETS.hour
      : EXPIRY_PRESETS[expiryTier];

    const room = rooms.createRoom({
      selfDestruct,
      expiryMs,
      maxPeers:   resolvedMaxPeers,
      expiryTier: selfDestruct ? 'hour' : expiryTier,
    });

    res.status(201).json({
      roomId:       room.id,
      selfDestruct: room.selfDestruct,
      maxPeers:     room.maxPeers,
      expiryTier:   room.expiryTier,
      expiresAt:    room.expiresAt,
      createdAt:    room.createdAt,
    });
  });

  router.get('/rooms/:roomId', (req, res) => {
    if (!isValidRoomId(req.params.roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    const room = rooms.getRoom(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({
      roomId:       room.id,
      peerCount:    room.peers.size,
      maxPeers:     room.maxPeers,
      selfDestruct: room.selfDestruct,
      transferDone: room.transferDone,
      expiryTier:   room.expiryTier,
      expiresAt:    room.expiresAt,
      createdAt:    room.createdAt,
    });
  });

  router.post('/rooms/:roomId/done', (req, res) => {
    if (!isValidRoomId(req.params.roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    const room = rooms.getRoom(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    rooms.markTransferDone(req.params.roomId);
    res.json({ ok: true });
  });

  return router;
}
