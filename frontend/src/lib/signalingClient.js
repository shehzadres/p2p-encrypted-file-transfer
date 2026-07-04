import { WS_URL } from './config.js';
import { SIGNALING_EVENTS, SIGNALING_CONFIG } from '@shared/constants';

/**
 * WebSocket signaling client.
 *
 * Responsibilities:
 *  - Connect / auto-reconnect with exponential back-off + jitter
 *  - Re-join the current room after reconnect
 *  - Application-level PING/PONG keepalive (complements the server's WS ping)
 *  - Typed send helpers for every signaling message
 *  - EventTarget-based event bus (no external deps)
 *
 * The client is intentionally unaware of WebRTC — it only moves JSON envelopes.
 */
export class SignalingClient extends EventTarget {
  constructor() {
    super();
    this._ws            = null;
    this._destroyed     = false;
    this._reconnectTimer= null;
    this._reconnectDelay= SIGNALING_CONFIG.RECONNECT_BASE_MS;
    this._pingTimer     = null;
    this._pongTimer     = null;

    /** The room we're currently in (restored on reconnect) */
    this.roomId = null;
    /** Server-assigned peer ID (reset on each new connection) */
    this.peerId = null;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  connect() {
    if (this._ws || this._destroyed) return;
    this._open();
  }

  destroy() {
    this._destroyed = true;
    this._clearTimers();
    this._ws?.close(1000, 'Client destroyed');
    this._ws = null;
  }

  // ── Signaling helpers ──────────────────────────────────────────────────

  joinRoom(roomId) {
    this.roomId = roomId;
    return this._send(SIGNALING_EVENTS.JOIN_ROOM, { roomId });
  }

  leaveRoom() {
    if (!this.roomId) return;
    this._send(SIGNALING_EVENTS.LEAVE_ROOM, { roomId: this.roomId });
    this.roomId = null;
  }

  sendOffer(roomId, targetId, sdp) {
    return this._send(SIGNALING_EVENTS.OFFER, { roomId, targetId, sdp });
  }

  sendAnswer(roomId, targetId, sdp) {
    return this._send(SIGNALING_EVENTS.ANSWER, { roomId, targetId, sdp });
  }

  sendIceCandidate(roomId, targetId, candidate) {
    return this._send(SIGNALING_EVENTS.ICE_CANDIDATE, { roomId, targetId, candidate });
  }

  // ── EventTarget helpers ────────────────────────────────────────────────

  /**
   * Subscribe to a signaling event.
   * Returns an unsubscribe function.
   */
  on(type, handler) {
    // Wrap so we can remove by the wrapper reference
    const cb = (e) => handler(e.detail);
    this.addEventListener(type, cb);
    return () => this.removeEventListener(type, cb);
  }

  // ── Internal ───────────────────────────────────────────────────────────

  _open() {
    const ws = new WebSocket(WS_URL);
    this._ws = ws;

    ws.onopen = () => {
      this._reconnectDelay = SIGNALING_CONFIG.RECONNECT_BASE_MS;
      this._startPing();
      this._emit('open');

      // Re-join the room if we were in one before disconnecting
      if (this.roomId) {
        this._send(SIGNALING_EVENTS.JOIN_ROOM, { roomId: this.roomId });
      }
    };

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      // Handle application-level PONG (server's response to our PING)
      if (msg.event === SIGNALING_EVENTS.PONG) {
        this._onPong();
        return;
      }

      // Dispatch to specific event listeners
      if (msg.event) this._emit(msg.event, msg.data);
    };

    ws.onclose = (e) => {
      this._ws = null;
      this._stopPing();
      this._emit('disconnected', { code: e.code, reason: e.reason });

      if (!this._destroyed) this._scheduleReconnect();
    };

    ws.onerror = () => {
      // onerror always fires before onclose; let onclose drive the reconnect
      this._emit('error');
    };
  }

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer);
    const jitter  = Math.random() * SIGNALING_CONFIG.RECONNECT_JITTER_MS;
    const delay   = this._reconnectDelay + jitter;
    this._reconnectDelay = Math.min(
      this._reconnectDelay * 2,
      SIGNALING_CONFIG.RECONNECT_MAX_MS
    );
    this._emit('reconnecting', { delay });
    this._reconnectTimer = setTimeout(() => {
      if (!this._destroyed) this._open();
    }, delay);
  }

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      if (this._ws?.readyState !== WebSocket.OPEN) return;
      this._send(SIGNALING_EVENTS.PING, { ts: Date.now() });
      // If PONG doesn't arrive within timeout, consider connection dead
      this._pongTimer = setTimeout(() => {
        if (this._ws) {
          this._ws.close(4000, 'Ping timeout');
        }
      }, SIGNALING_CONFIG.PING_TIMEOUT_MS);
    }, SIGNALING_CONFIG.PING_INTERVAL_MS);
  }

  _stopPing() {
    clearInterval(this._pingTimer);
    clearTimeout(this._pongTimer);
    this._pingTimer = null;
    this._pongTimer = null;
  }

  _onPong() {
    clearTimeout(this._pongTimer);
    this._pongTimer = null;
  }

  _clearTimers() {
    clearTimeout(this._reconnectTimer);
    this._stopPing();
  }

  _send(event, data) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ event, data }));
      return true;
    }
    return false;
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
