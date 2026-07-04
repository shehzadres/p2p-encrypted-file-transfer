/**
 * peerConnection.js — Production WebRTC peer wrapper
 *
 * Phase 8 additions:
 *  - ICE config injected at construction time (from /api/ice-config)
 *  - Trickle-ICE gather timeout with forced end-of-candidates
 *  - Exponential back-off on ICE restart (capped at 30s)
 *  - Page visibility recovery (reconnect on tab re-focus after background)
 *  - Extended RTCStats: packet loss, jitter, candidate IP/type
 *  - Network quality score (0–100) computed per stats snapshot
 *  - Safe close guards on all async paths
 *  - `iceTransportPolicy: 'relay'` fallback after N consecutive STUN failures
 */

import { CHUNK_CONFIG } from '@shared/constants';
import { buildRTCConfig, computeQualityScore } from './browserCompat';

// ICE restart back-off: 1s, 2s, 4s, 8s, 16s, 30s (cap)
const ICE_RESTART_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const ICE_GATHER_TIMEOUT = 8000;   // ms to wait for ICE gathering to complete
const MAX_ICE_RESTARTS   = 5;

export class PeerConnection extends EventTarget {
  /**
   * @param {object}     opts
   * @param {string}     opts.peerId
   * @param {boolean}    opts.isInitiator
   * @param {Function}   opts.onSignal
   * @param {object[]}   opts.iceServers   From /api/ice-config
   * @param {boolean}    opts.hasTurn      Whether TURN is available
   */
  constructor({ peerId, isInitiator, onSignal, iceServers = [], hasTurn = false }) {
    super();
    this.peerId        = peerId;
    this.isInitiator   = isInitiator;
    this._onSignal     = onSignal;
    this._iceServers   = iceServers;
    this._hasTurn      = hasTurn;

    this._pc      = null;
    this._channel = null;
    this._state   = 'new';

    // ICE state
    this._iceCandidateQueue    = [];
    this._hasRemoteDescription = false;
    this._iceGatherTimer       = null;
    this._iceGatheringDone     = false;

    // Perfect negotiation
    this._makingOffer  = false;
    this._ignoreOffer  = false;

    // Restart tracking
    this._iceRestartCount   = 0;
    this._iceRestartTimer   = null;
    this._usingRelayOnly    = false; // escalated after repeated failures

    // Backpressure
    this._drainCallbacks = [];

    // Diagnostics
    this._statsTimer = null;
    this._lastStats  = null;

    // Visibility recovery
    this._visibilityHandler = null;

    this._createPC();
    this._watchVisibility();

    if (isInitiator) {
      this._createDataChannel();
      this._negotiate();
    }
  }

  // ── RTCPeerConnection setup ────────────────────────────────────────────

  _createPC(relayOnly = false) {
    if (this._pc) {
      try { this._pc.close(); } catch {}
    }

    const iceServers = relayOnly
      ? this._iceServers.filter((s) => s.urls?.toString().startsWith('turn'))
      : this._iceServers;

    this._pc = new RTCPeerConnection(buildRTCConfig(
      iceServers.length ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }]
    ));

    this._hasRemoteDescription = false;
    this._iceGatheringDone     = false;
    this._iceCandidateQueue    = [];
    this._wirePC();
  }

  _wirePC() {
    const pc = this._pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this._onSignal('ice-candidate', { candidate: candidate.toJSON() });
      } else {
        // End-of-candidates
        this._iceGatheringDone = true;
        clearTimeout(this._iceGatherTimer);
        this._onSignal('ice-candidate', { candidate: null });
      }
    };

    pc.onicegatheringstatechange = () => {
      this._emit('diagnostic', { type: 'ice-gathering', state: pc.iceGatheringState });
      if (pc.iceGatheringState === 'complete') {
        this._iceGatheringDone = true;
        clearTimeout(this._iceGatherTimer);
      }
    };

    pc.onicecandidateerror = (e) => {
      // 701 = STUN server unreachable — common on restricted networks, not fatal
      if (e.errorCode !== 701) {
        this._emit('diagnostic', { type: 'ice-candidate-error', code: e.errorCode, url: e.url });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      this._emit('diagnostic', { type: 'ice-state', state: s });

      if (s === 'failed') {
        this._handleIceFailure();
      } else if (s === 'disconnected') {
        // May self-recover; schedule a restart if it doesn't
        this._scheduleIceRestart(3000);
      } else if (s === 'connected' || s === 'completed') {
        clearTimeout(this._iceRestartTimer);
        this._iceRestartTimer  = null;
        this._iceRestartCount  = 0; // reset on success
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      this._emit('diagnostic', { type: 'connection-state', state: s });
      if      (s === 'failed')       this._setState('failed');
      else if (s === 'closed')       this._setState('closed');
      else if (s === 'connecting')   this._setState('connecting');
    };

    pc.onsignalingstatechange = () => {
      this._emit('diagnostic', { type: 'signaling-state', state: pc.signalingState });
    };

    // Perfect negotiation re-negotiation
    pc.onnegotiationneeded = async () => {
      try {
        this._makingOffer = true;
        await pc.setLocalDescription();
        this._startIceGatherTimeout();
        this._onSignal('offer', { sdp: pc.localDescription });
      } catch (err) {
        this._emit('error', { phase: 'negotiation', message: err.message });
      } finally {
        this._makingOffer = false;
      }
    };

    pc.ondatachannel = ({ channel }) => {
      if (!this.isInitiator) this._attachChannel(channel);
    };
  }

  _startIceGatherTimeout() {
    clearTimeout(this._iceGatherTimer);
    if (this._iceGatheringDone) return;
    this._iceGatherTimer = setTimeout(() => {
      if (!this._iceGatheringDone) {
        // Force end-of-candidates so the remote side can start connecting
        this._emit('diagnostic', { type: 'ice-gather-timeout' });
        this._onSignal('ice-candidate', { candidate: null });
        this._iceGatheringDone = true;
      }
    }, ICE_GATHER_TIMEOUT);
  }

  // ── DataChannel ────────────────────────────────────────────────────────

  _createDataChannel() {
    const ch = this._pc.createDataChannel('p2p-transfer', { ordered: true });
    this._attachChannel(ch);
  }

  _attachChannel(channel) {
    this._channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = CHUNK_CONFIG.BUFFER_LOW_THRESHOLD;

    channel.onopen  = () => { this._setState('connected');    this._emit('channel-open');  };
    channel.onclose = () => { this._setState('disconnected'); this._emit('channel-close'); };
    channel.onerror = (e) => this._emit('channel-error', e.error ?? new Error('DataChannel error'));
    channel.onmessage = ({ data }) => this._emit('message', data);

    channel.onbufferedamountlow = () => {
      const cbs = this._drainCallbacks.splice(0);
      for (const cb of cbs) cb();
    };
  }

  // ── Offer / Answer (Perfect Negotiation) ──────────────────────────────

  async _negotiate() {
    try {
      this._makingOffer = true;
      await this._pc.setLocalDescription();
      this._startIceGatherTimeout();
      this._onSignal('offer', { sdp: this._pc.localDescription });
    } catch (err) {
      this._emit('error', { phase: 'offer', message: err.message });
    } finally {
      this._makingOffer = false;
    }
  }

  async receiveOffer(sdp) {
    if (this._isClosedOrFailed()) return;
    const pc             = this._pc;
    const offerCollision = pc.signalingState !== 'stable' || this._makingOffer;
    const isPolite       = !this.isInitiator;

    this._ignoreOffer = !isPolite && offerCollision;
    if (this._ignoreOffer) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      this._hasRemoteDescription = true;
      await this._drainIceCandidateQueue();

      if (sdp.type === 'offer') {
        await pc.setLocalDescription();
        this._onSignal('answer', { sdp: pc.localDescription });
      }
    } catch (err) {
      this._emit('error', { phase: 'receive-offer', message: err.message });
    }
  }

  async receiveAnswer(sdp) {
    if (this._isClosedOrFailed() || this._ignoreOffer) return;
    try {
      await this._pc.setRemoteDescription(new RTCSessionDescription(sdp));
      this._hasRemoteDescription = true;
      await this._drainIceCandidateQueue();
    } catch (err) {
      this._emit('error', { phase: 'receive-answer', message: err.message });
    }
  }

  // ── ICE candidates ─────────────────────────────────────────────────────

  async receiveIceCandidate(candidateInit) {
    if (this._isClosedOrFailed()) return;

    if (candidateInit === null) {
      try { await this._pc.addIceCandidate(null); } catch {}
      return;
    }

    if (!this._hasRemoteDescription) {
      this._iceCandidateQueue.push(candidateInit);
      return;
    }
    await this._applyIceCandidate(candidateInit);
  }

  async _drainIceCandidateQueue() {
    const queue = this._iceCandidateQueue.splice(0);
    for (const init of queue) await this._applyIceCandidate(init);
  }

  async _applyIceCandidate(init) {
    try {
      await this._pc.addIceCandidate(new RTCIceCandidate(init));
    } catch {
      // Stale candidate — safe to discard
    }
  }

  // ── ICE restart & recovery ────────────────────────────────────────────

  _handleIceFailure() {
    if (this._iceRestartCount >= MAX_ICE_RESTARTS) {
      // Escalate: try relay-only if we have TURN
      if (this._hasTurn && !this._usingRelayOnly) {
        this._escalateToRelay();
      } else {
        this._emit('error', { phase: 'ice', message: 'ICE failed — all restart attempts exhausted' });
        this._setState('failed');
      }
      return;
    }
    const delay = ICE_RESTART_DELAYS[Math.min(this._iceRestartCount, ICE_RESTART_DELAYS.length - 1)];
    this._emit('diagnostic', { type: 'ice-restart-scheduled', attempt: this._iceRestartCount + 1, delay });
    this._scheduleIceRestart(delay);
  }

  _scheduleIceRestart(delayMs) {
    clearTimeout(this._iceRestartTimer);
    this._iceRestartTimer = setTimeout(() => {
      const s = this._pc?.iceConnectionState;
      if (s === 'failed' || s === 'disconnected') {
        this._attemptIceRestart();
      }
    }, delayMs);
  }

  async _attemptIceRestart() {
    if (this._isClosedOrFailed() || !this.isInitiator) return;
    this._iceRestartCount++;

    try {
      this._emit('diagnostic', { type: 'ice-restart', attempt: this._iceRestartCount });
      const offer = await this._pc.createOffer({ iceRestart: true });
      await this._pc.setLocalDescription(offer);
      this._startIceGatherTimeout();
      this._onSignal('offer', { sdp: this._pc.localDescription });
    } catch (err) {
      this._emit('error', { phase: 'ice-restart', message: err.message });
    }
  }

  /**
   * Last resort: recreate RTCPeerConnection with relay-only transport.
   * Requires re-negotiation from scratch.
   */
  _escalateToRelay() {
    this._usingRelayOnly = true;
    this._iceRestartCount = 0;
    this._emit('diagnostic', { type: 'relay-escalation' });
    this._createPC(true /* relayOnly */);

    if (this.isInitiator) {
      this._createDataChannel();
      this._negotiate();
    }
    this._emit('relay-escalated');
  }

  // ── Page visibility recovery ─────────────────────────────────────────

  _watchVisibility() {
    this._visibilityHandler = () => {
      if (document.visibilityState !== 'visible') return;
      const s = this._pc?.iceConnectionState;
      if (s === 'disconnected' || s === 'failed') {
        this._emit('diagnostic', { type: 'visibility-recovery' });
        if (s === 'failed') {
          this._iceRestartCount = 0; // give a fresh set of attempts after bg
          this._handleIceFailure();
        } else {
          this._scheduleIceRestart(500);
        }
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  // ── Backpressure / flow control ───────────────────────────────────────

  waitForBufferDrain() {
    if (this.canSend) return Promise.resolve();
    return new Promise((resolve) => {
      this._drainCallbacks.push(resolve);
    });
  }

  // ── Data sending ──────────────────────────────────────────────────────

  send(data) {
    if (this._channel?.readyState !== 'open') return false;
    try { this._channel.send(data); return true; }
    catch { return false; }
  }

  sendJSON(obj) { return this.send(JSON.stringify(obj)); }

  get canSend() {
    return (
      this._channel?.readyState === 'open' &&
      this._channel.bufferedAmount < CHUNK_CONFIG.BUFFER_HIGH_THRESHOLD
    );
  }

  get bufferedAmount() { return this._channel?.bufferedAmount ?? 0; }

  // ── Diagnostics ───────────────────────────────────────────────────────

  startDiagnostics(intervalMs = 2000) {
    this.stopDiagnostics();
    this._statsTimer = setInterval(() => this._collectStats(), intervalMs);
  }

  stopDiagnostics() {
    clearInterval(this._statsTimer);
    this._statsTimer = null;
  }

  async _collectStats() {
    if (!this._pc || this._isClosedOrFailed()) return;
    try {
      const report = await this._pc.getStats();
      const parsed = parseRTCStats(report, this._lastStats);
      this._lastStats = report;
      this._emit('stats', parsed);
    } catch { /* pc may have closed */ }
  }

  async getDiagnostics() {
    if (!this._pc || this._isClosedOrFailed()) return null;
    try {
      const report = await this._pc.getStats();
      return parseRTCStats(report, this._lastStats);
    } catch { return null; }
  }

  // ── Reconnect info ────────────────────────────────────────────────────

  getReconnectInfo() {
    return {
      peerId:          this.peerId,
      isInitiator:     this.isInitiator,
      state:           this._state,
      iceState:        this._pc?.iceConnectionState ?? 'unknown',
      signalingState:  this._pc?.signalingState     ?? 'unknown',
      iceRestartCount: this._iceRestartCount,
      usingRelayOnly:  this._usingRelayOnly,
      canRecover:      this._iceRestartCount < MAX_ICE_RESTARTS || (this._hasTurn && !this._usingRelayOnly),
    };
  }

  // ── State ─────────────────────────────────────────────────────────────

  get state()          { return this._state; }
  get isConnected()    { return this._state === 'connected'; }
  _isClosedOrFailed()  { return this._state === 'closed' || this._state === 'failed'; }

  _setState(next) {
    if (this._state === next) return;
    const prev  = this._state;
    this._state = next;
    this._emit('state-change', { state: next, prev });
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  destroy() {
    this.stopDiagnostics();
    clearTimeout(this._iceRestartTimer);
    clearTimeout(this._iceGatherTimer);

    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }

    const cbs = this._drainCallbacks.splice(0);
    cbs.forEach((cb) => cb());

    try { this._channel?.close(); } catch {}
    try { this._pc?.close();      } catch {}

    this._iceCandidateQueue = [];
    this._setState('closed');
  }

  // ── EventTarget helpers ───────────────────────────────────────────────

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on(type, handler) {
    const cb = (e) => handler(e.detail);
    this.addEventListener(type, cb);
    return () => this.removeEventListener(type, cb);
  }
}

// ── RTCStats parser ──────────────────────────────────────────────────────

function parseRTCStats(report, prev) {
  const out = {
    timestamp:                    Date.now(),
    candidatePairState:           null,
    localCandidateType:           null,
    remoteCandidateType:          null,
    localCandidateAddress:        null,
    remoteCandidateAddress:       null,
    networkType:                  null,  // wifi | cellular | ethernet | vpn | unknown
    roundTripTimeMs:              null,
    availableOutboundBandwidthBps:null,
    packetLossPct:                null,
    jitterMs:                     null,
    dataChannel: {
      bytesSent:    0, bytesReceived: 0,
      messagesSent: 0, messagesRecv:  0,
      sendRateBps:  null, recvRateBps: null,
    },
    transport: { bytesSent: 0, bytesReceived: 0, dtlsState: null },
    connectionType:  null,
    qualityScore:    null,
  };

  let prevDC = null;
  let prevInbound = null;
  if (prev) {
    for (const s of prev.values()) {
      if (s.type === 'data-channel')      prevDC = s;
      if (s.type === 'inbound-rtp')       prevInbound = s;
    }
  }

  for (const s of report.values()) {
    switch (s.type) {

      case 'candidate-pair': {
        if (!(s.nominated || s.selected || s.state === 'succeeded')) break;
        out.candidatePairState = s.state;

        if (s.currentRoundTripTime != null)
          out.roundTripTimeMs = Math.round(s.currentRoundTripTime * 1000);

        if (s.availableOutgoingBitrate != null)
          out.availableOutboundBandwidthBps = Math.round(s.availableOutgoingBitrate / 8);

        const local  = report.get(s.localCandidateId);
        const remote = report.get(s.remoteCandidateId);

        if (local) {
          out.localCandidateType    = local.candidateType;
          out.localCandidateAddress = local.address ?? local.ip ?? null;
          out.networkType           = local.networkType ?? null;
        }
        if (remote) {
          out.remoteCandidateType    = remote.candidateType;
          out.remoteCandidateAddress = remote.address ?? remote.ip ?? null;
        }

        if      (local?.candidateType === 'relay' || remote?.candidateType === 'relay')
          out.connectionType = 'relay (TURN)';
        else if (local?.candidateType === 'srflx' || remote?.candidateType === 'srflx')
          out.connectionType = 'STUN traversal';
        else if (local?.candidateType === 'host')
          out.connectionType = 'direct (LAN)';
        break;
      }

      case 'data-channel': {
        out.dataChannel.bytesSent     = s.bytesSent     ?? 0;
        out.dataChannel.bytesReceived = s.bytesReceived ?? 0;
        out.dataChannel.messagesSent  = s.messagesSent  ?? 0;
        out.dataChannel.messagesRecv  = s.messagesReceived ?? 0;

        if (prevDC && s.timestamp && prevDC.timestamp) {
          const dt = (s.timestamp - prevDC.timestamp) / 1000;
          if (dt > 0) {
            out.dataChannel.sendRateBps = Math.round((s.bytesSent     - (prevDC.bytesSent     ?? 0)) / dt);
            out.dataChannel.recvRateBps = Math.round((s.bytesReceived - (prevDC.bytesReceived ?? 0)) / dt);
          }
        }
        break;
      }

      case 'transport': {
        out.transport.bytesSent     = s.bytesSent     ?? 0;
        out.transport.bytesReceived = s.bytesReceived ?? 0;
        out.transport.dtlsState     = s.dtlsState     ?? null;
        break;
      }

      case 'inbound-rtp': {
        // Jitter (in seconds → ms)
        if (s.jitter != null) out.jitterMs = Math.round(s.jitter * 1000);

        // Packet loss
        if (s.packetsLost != null && s.packetsReceived != null) {
          const total = s.packetsReceived + s.packetsLost;
          out.packetLossPct = total > 0
            ? parseFloat(((s.packetsLost / total) * 100).toFixed(2))
            : 0;
        }
        break;
      }
    }
  }

  out.qualityScore = computeQualityScore(out);
  return out;
}
