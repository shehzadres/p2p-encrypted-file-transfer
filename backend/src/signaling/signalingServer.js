import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';
import { SIGNALING_EVENTS, SIGNALING_CONFIG } from '../../../shared/constants.js';
import { RoomManager } from './RoomManager.js';
import { logger } from '../utils/logger.js';

/**
 * Creates and wires the WebSocket signaling server.
 *
 * Security model:
 *  - Server NEVER reads SDP/ICE content; it's an opaque relay.
 *  - Rate-limiting prevents a single peer from flooding others.
 *  - Ping/pong detects dead connections and reclaims room slots.
 */
export function createSignalingServer(httpServer, config) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const rooms = new RoomManager();

  // Periodic room expiry sweep
  const cleanupTimer = setInterval(
    () => rooms.cleanup(),
    config.roomCleanupInterval
  );

  wss.on('connection', (ws, req) => {
    const peerId = nanoid(16);
    ws.peerId         = peerId;
    ws.isAlive        = true;
    ws._messageCount  = 0;           // for per-second rate limiting
    ws._rateLimitedAt = 0;

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim()
      ?? req.socket.remoteAddress;

    logger.info('WS connection opened', { peerId, ip: clientIp });

    // Immediately tell the client its server-assigned peerId
    send(ws, { event: SIGNALING_EVENTS.ROOM_INFO, data: { peerId } });

    // ── Message handler ────────────────────────────────────────────────
    ws.on('message', (raw) => {
      // Rate limit: drop messages beyond MAX_MESSAGES_PER_SECOND
      const now = Date.now();
      if (now - ws._rateLimitedAt >= 1000) {
        ws._messageCount  = 0;
        ws._rateLimitedAt = now;
      }
      ws._messageCount++;
      if (ws._messageCount > SIGNALING_CONFIG.MAX_MESSAGES_PER_SECOND) {
        logger.warn('Rate limit exceeded', { peerId });
        send(ws, { event: SIGNALING_EVENTS.ERROR, data: { message: 'Rate limit exceeded', code: 429 } });
        return;
      }

      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, { event: SIGNALING_EVENTS.ERROR, data: { message: 'Invalid JSON', code: 400 } });
        return;
      }
      handleMessage(ws, msg, rooms);
    });

    // ── Keepalive ──────────────────────────────────────────────────────
    ws.on('pong', () => { ws.isAlive = true; });

    // ── Teardown ───────────────────────────────────────────────────────
    ws.on('close', (code, reason) => {
      handleDisconnect(ws, rooms);
      logger.info('WS connection closed', { peerId, code, reason: reason.toString() });
    });

    ws.on('error', (err) => {
      logger.error('WS error', { peerId, error: err.message });
    });
  });

  // Heartbeat — terminates zombies, frees their room slots
  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        logger.warn('Terminating zombie WS', { peerId: ws.peerId });
        handleDisconnect(ws, rooms);
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, SIGNALING_CONFIG.PING_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(cleanupTimer);
    clearInterval(heartbeatTimer);
  });

  logger.info('Signaling server listening', { path: '/ws' });
  return { wss, rooms };
}

// ── Message dispatch ─────────────────────────────────────────────────────

function handleMessage(ws, msg, rooms) {
  const { event, data } = msg ?? {};
  const peerId = ws.peerId;

  switch (event) {

    // ── Room join ────────────────────────────────────────────────────────
    case SIGNALING_EVENTS.JOIN_ROOM: {
      const roomId = data?.roomId;
      if (!roomId || typeof roomId !== 'string' || roomId.length > 64) {
        return send(ws, { event: SIGNALING_EVENTS.ERROR, data: { message: 'Invalid roomId', code: 400 } });
      }

      // Prevent double-join
      if (rooms.findPeerRooms(peerId).some((r) => r.id === roomId)) {
        return send(ws, { event: SIGNALING_EVENTS.ERROR, data: { message: 'Already in room', code: 409 } });
      }

      const result = rooms.joinRoom(roomId, peerId, ws);

      if (result.error === 'ROOM_NOT_FOUND') {
        return send(ws, { event: SIGNALING_EVENTS.ROOM_NOT_FOUND, data: { roomId } });
      }
      if (result.error === 'ROOM_FULL') {
        return send(ws, { event: SIGNALING_EVENTS.ROOM_FULL, data: { roomId } });
      }
      if (result.error === 'ROOM_EXPIRED') {
        return send(ws, { event: SIGNALING_EVENTS.ROOM_EXPIRED, data: { roomId } });
      }

      const { room, isHost } = result;
      // Exclude self from peer list sent to joining client
      const existingPeers = [...room.peers.keys()].filter((id) => id !== peerId);

      // Tell the joining peer who is already in the room
      send(ws, {
        event: SIGNALING_EVENTS.ROOM_JOINED,
        data:  { roomId, peerId, isHost, peers: existingPeers, peerCount: room.peers.size },
      });

      // Tell every existing peer about the new arrival
      rooms.broadcast(roomId, peerId, {
        event: SIGNALING_EVENTS.PEER_JOINED,
        data:  { peerId, peerCount: room.peers.size },
      });

      logger.info('Peer joined', { roomId, peerId, isHost, existingPeers: existingPeers.length });
      break;
    }

    // ── Room leave ───────────────────────────────────────────────────────
    case SIGNALING_EVENTS.LEAVE_ROOM: {
      const roomId = data?.roomId;
      if (!roomId) break;
      rooms.broadcast(roomId, peerId, {
        event: SIGNALING_EVENTS.PEER_LEFT,
        data:  { peerId },
      });
      rooms.leaveRoom(roomId, peerId);
      break;
    }

    // ── WebRTC relay (SDP + ICE) ─────────────────────────────────────────
    // The server is a blind relay — it never inspects or stores SDP/ICE content.
    case SIGNALING_EVENTS.OFFER:
    case SIGNALING_EVENTS.ANSWER:
    case SIGNALING_EVENTS.ICE_CANDIDATE: {
      const { roomId, targetId } = data ?? {};
      if (!roomId || !targetId) {
        return send(ws, { event: SIGNALING_EVENTS.ERROR, data: { message: 'roomId and targetId required', code: 400 } });
      }
      // Verify sender is actually in the room (prevent cross-room injection)
      const room = rooms.getRoom(roomId);
      if (!room?.peers.has(peerId)) {
        return send(ws, { event: SIGNALING_EVENTS.ERROR, data: { message: 'Not in room', code: 403 } });
      }

      const delivered = rooms.sendToPeer(roomId, targetId, {
        event,
        data: { ...data, fromId: peerId },
      });

      if (!delivered) {
        send(ws, { event: SIGNALING_EVENTS.ERROR, data: { message: 'Target peer unavailable', code: 410 } });
      }
      break;
    }

    // ── Keepalive ─────────────────────────────────────────────────────────
    case SIGNALING_EVENTS.PING: {
      send(ws, { event: SIGNALING_EVENTS.PONG, data: { ts: Date.now() } });
      break;
    }

    default:
      logger.debug('Unknown signaling event', { event, peerId });
  }
}

// ── Disconnect handler ───────────────────────────────────────────────────

function handleDisconnect(ws, rooms) {
  const peerId = ws.peerId;
  if (!peerId) return;

  const peerRooms = rooms.findPeerRooms(peerId);
  for (const room of peerRooms) {
    rooms.broadcast(room.id, peerId, {
      event: SIGNALING_EVENTS.PEER_LEFT,
      data:  { peerId },
    });
    rooms.leaveRoom(room.id, peerId);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function send(ws, msg) {
  if (ws.readyState === 1 /* OPEN */) {
    try {
      ws.send(JSON.stringify(msg));
    } catch (err) {
      logger.error('WS send failed', { peerId: ws.peerId, error: err.message });
    }
  }
}
