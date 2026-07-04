import { nanoid } from 'nanoid';
import { ROOM_CONFIG, SIGNALING_EVENTS } from '../../../shared/constants.js';
import { logger } from '../utils/logger.js';

/**
 * RoomManager — in-memory room registry.
 *
 * Phase 7 additions:
 *  - maxPeers option (1+1 for self-destruct single-use links)
 *  - Multiple expiry tiers (1h, 24h, 7d, never)
 *  - markTransferDone triggers self-destruct shutdown
 *  - Room info includes selfDestruct, maxPeers, expiryTier for client UI
 */
export class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  /**
   * @param {object}  opts
   * @param {boolean} opts.selfDestruct   - Expire after first completed transfer
   * @param {number}  opts.expiryMs       - TTL from creation (0 = never)
   * @param {number}  opts.maxPeers       - Max simultaneous peers (default 10)
   * @param {string}  opts.expiryTier     - 'hour'|'day'|'week'|'never' (display only)
   */
  createRoom({
    selfDestruct = false,
    expiryMs     = ROOM_CONFIG.ROOM_EXPIRY_MS,
    maxPeers     = ROOM_CONFIG.MAX_PEERS_PER_ROOM,
    expiryTier   = 'day',
  } = {}) {
    const id = nanoid(ROOM_CONFIG.ROOM_ID_LENGTH);
    const room = {
      id,
      hostId:       null,
      peers:        new Map(),   // peerId → PeerInfo
      createdAt:    Date.now(),
      expiresAt:    expiryMs ? Date.now() + expiryMs : null,
      selfDestruct,
      transferDone: false,
      maxPeers:     Math.min(maxPeers, ROOM_CONFIG.MAX_PEERS_PER_ROOM),
      expiryTier,
    };
    this.rooms.set(id, room);
    logger.info('Room created', { roomId: id, selfDestruct, maxPeers, expiryTier });
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) ?? null;
  }

  joinRoom(roomId, peerId, ws) {
    const room = this.getRoom(roomId);
    if (!room)                              return { error: 'ROOM_NOT_FOUND' };
    if (this._isExpired(room))              { this._destroyRoom(roomId); return { error: 'ROOM_NOT_FOUND' }; }
    if (room.peers.size >= room.maxPeers)   return { error: 'ROOM_FULL' };
    if (room.selfDestruct && room.transferDone) return { error: 'ROOM_EXPIRED' };

    const isHost = room.peers.size === 0;
    if (isHost) room.hostId = peerId;
    room.peers.set(peerId, { id: peerId, ws, joinedAt: Date.now() });

    logger.info('Peer joined', { roomId, peerId, isHost, peerCount: room.peers.size });
    return { room, isHost };
  }

  leaveRoom(roomId, peerId) {
    const room = this.getRoom(roomId);
    if (!room) return;
    room.peers.delete(peerId);
    logger.info('Peer left', { roomId, peerId, remaining: room.peers.size });
    if (room.peers.size === 0) {
      this._destroyRoom(roomId);
    } else if (room.hostId === peerId) {
      room.hostId = room.peers.keys().next().value;
    }
  }

  /**
   * Mark transfer complete for self-destruct rooms.
   * Notifies all remaining peers and flags the room as done.
   */
  markTransferDone(roomId) {
    const room = this.getRoom(roomId);
    if (!room?.selfDestruct) return;
    room.transferDone = true;
    // Notify peers — they should close their connections
    this._broadcastAll(room, {
      event: SIGNALING_EVENTS.ROOM_EXPIRED,
      data:  { roomId, reason: 'self-destruct' },
    });
    logger.info('Self-destruct triggered', { roomId });
    // Destroy after short delay to allow the notification to be sent
    setTimeout(() => this._destroyRoom(roomId), 2000);
  }

  broadcast(roomId, senderId, message) {
    const room = this.getRoom(roomId);
    if (!room) return 0;
    const payload = this._ser(message);
    let sent = 0;
    for (const [pid, peer] of room.peers) {
      if (pid !== senderId && this._open(peer.ws)) { peer.ws.send(payload); sent++; }
    }
    return sent;
  }

  sendToPeer(roomId, targetId, message) {
    const room = this.getRoom(roomId);
    if (!room) return false;
    const peer = room.peers.get(targetId);
    if (!peer || !this._open(peer.ws)) return false;
    peer.ws.send(this._ser(message));
    return true;
  }

  findPeerRooms(peerId) {
    const found = [];
    for (const room of this.rooms.values()) {
      if (room.peers.has(peerId)) found.push(room);
    }
    return found;
  }

  cleanup() {
    let removed = 0;
    for (const [id, room] of this.rooms) {
      if (this._isExpired(room)) {
        this._notifyExpiry(room);
        this._destroyRoom(id);
        removed++;
      }
    }
    if (removed > 0) logger.info('Expired rooms pruned', { removed });
  }

  stats() {
    let totalPeers = 0;
    for (const r of this.rooms.values()) totalPeers += r.peers.size;
    return { totalRooms: this.rooms.size, totalPeers };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _isExpired(room) {
    return room.expiresAt !== null && Date.now() > room.expiresAt;
  }

  _destroyRoom(id) {
    this.rooms.delete(id);
    logger.info('Room destroyed', { roomId: id });
  }

  _broadcastAll(room, message) {
    const payload = this._ser(message);
    for (const peer of room.peers.values()) {
      if (this._open(peer.ws)) peer.ws.send(payload);
    }
  }

  _notifyExpiry(room) {
    this._broadcastAll(room, {
      event: SIGNALING_EVENTS.ROOM_EXPIRED,
      data:  { roomId: room.id, reason: 'expired' },
    });
  }

  _open(ws)     { return ws.readyState === 1; }
  _ser(msg)     { return typeof msg === 'string' ? msg : JSON.stringify(msg); }
}
