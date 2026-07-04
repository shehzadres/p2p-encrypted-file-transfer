/**
 * transferEngine.js — Full streaming pipeline with ACKs, resume, and retry
 *
 * Sender flow per file:
 *   1. Derive per-file subkey (crypto_kdf)
 *   2. Encrypt metadata with AEAD, send FILE_META control frame
 *   3. Await FILE_META_ACK
 *   4. Init secretstream, send HEADER binary frame
 *   5. Stream chunks with sliding-window ACKs:
 *        - Send up to WINDOW_SIZE chunks in-flight
 *        - Await ACK per chunk; NACK → retransmit (up to MAX_CHUNK_RETRIES)
 *        - Pause: stop advancing; drain outstanding ACKs
 *        - Cancel: abort, send TRANSFER_CANCEL control
 *   6. Send FILE_COMPLETE with BLAKE2b-256 hash
 *   7. Zero file key
 *
 * Receiver flow per file:
 *   1. Receive FILE_META → decrypt AEAD metadata → send FILE_META_ACK
 *   2. Receive HEADER binary frame → init decrypt stream
 *   3. Per chunk: decrypt → verify MAC (secretstream) → ACK or NACK
 *   4. Streaming hash accumulation (BLAKE2b-256)
 *   5. Receive FILE_COMPLETE → verify hash → trigger download
 *   6. Zero file key
 *
 * Resume (future extension hook — infrastructure in place):
 *   Pause captures { offset, seq } checkpoint. On resume, sender re-inits
 *   secretstream from that checkpoint and sends a new HEADER. Receiver calls
 *   RESUME_ACK and resets its decrypt stream. Full secretstream replay is
 *   unnecessary because the DataChannel is reliable and ordered — pausing
 *   simply stops the sender loop; resuming continues from where it paused
 *   with the same stream state still in memory.
 */

import { nanoid } from 'nanoid';
import { TRANSFER_EVENTS } from '@shared/constants';
import {
  generateKeyPair,
  deriveSharedKeySender,
  deriveSharedKeyReceiver,
  exportPublicKey,
  importPublicKey,
  deriveFileKey,
  encryptMetadata,
  decryptMetadata,
  computeSessionFingerprint,
  zeroKey,
} from './crypto';
import {
  streamFileEncrypted,
  ReceiveBuffer,
  parseBinaryMessage,
  encodeControl,
  encodeAck,
  encodeNack,
  CancelledError,
  IntegrityError,
  NACK_REASON_DECRYPT_FAIL,
  NACK_REASON_SEQ_MISMATCH,
  MSG_TYPE_HEADER,
  MSG_TYPE_CHUNK,
  MSG_TYPE_ACK,
  MSG_TYPE_NACK,
  MSG_TYPE_CONTROL,
  adaptiveChunkSize,
} from './fileChunker';

export class TransferEngine extends EventTarget {
  constructor(peerConn, role) {
    super();
    this._pc   = peerConn;
    this._role = role;

    // Key material
    this._keyPair        = null;
    this._sessionKey     = null;
    this._theirPublicKey = null;
    this._theirRole      = null;
    this._fileKeyIndex   = 0;

    this.sessionFingerprint = null;
    this._keyExchangeDone   = false;

    // Outbound
    this._transfers = new Map(); // id → OutboundState

    // Inbound
    this._receiveBuffers = new Map(); // id → ReceiveBuffer

    // ACK/NACK routing: seq → handler registered by the sender pipeline
    this._ackHandlers = new Set(); // Set<Function>

    // Inbound file index counter (must mirror sender's _fileKeyIndex)
    this._nextInboundFileIndex = 0;

    this._pcUnsubs = [
      peerConn.on('message',       (d) => this._onMessage(d)),
      peerConn.on('channel-open',  ()  => this._onChannelOpen()),
      peerConn.on('channel-close', ()  => this._onChannelClose()),
    ];
  }

  // ── Key exchange ───────────────────────────────────────────────────────

  async _onChannelOpen() {
    try {
      this._keyPair = await generateKeyPair();
      this._sendControl(TRANSFER_EVENTS.KEY_EXCHANGE, {
        publicKey: exportPublicKey(this._keyPair.publicKey),
        role:      this._role,
      });
      if (this._theirPublicKey !== null) {
        await this._finaliseKeyExchange(this._theirPublicKey, this._theirRole);
      }
    } catch (err) {
      this._emit('error', { phase: 'key-exchange-init', message: err.message });
    }
  }

  async _handleKeyExchange(data) {
    const theirPubKey = importPublicKey(data.publicKey);
    this._theirRole   = data.role;
    if (!this._keyPair) { this._theirPublicKey = theirPubKey; return; }
    await this._finaliseKeyExchange(theirPubKey, data.role);
  }

  async _finaliseKeyExchange(theirPubKey, _theirRole) {
    try {
      if (this._role === 'sender') {
        // crypto_kx_client_session_keys returns { sharedRx, sharedTx }
        const k = await deriveSharedKeySender(this._keyPair.privateKey, theirPubKey);
        this._sessionKey = k.sharedTx; // sender encrypts with sharedTx
      } else {
        // crypto_kx_server_session_keys returns { sharedRx, sharedTx }
        const k = await deriveSharedKeyReceiver(this._keyPair.privateKey, theirPubKey);
        this._sessionKey = k.sharedRx; // receiver decrypts with sharedRx
      }
      this.sessionFingerprint = await computeSessionFingerprint(
        this._keyPair.publicKey, theirPubKey,
      );
      this._theirPublicKey  = null;
      this._keyExchangeDone = true;
      this._sendControl(TRANSFER_EVENTS.KEY_EXCHANGE_ACK, { fingerprint: this.sessionFingerprint });
      this._emit('key-exchange-complete', { fingerprint: this.sessionFingerprint });
    } catch (err) {
      this._emit('error', { phase: 'key-exchange-finalise', message: err.message });
    }
  }

  _onChannelClose() {
    for (const s of this._transfers.values()) {
      if (s.status === 'transferring' || s.status === 'paused') s.signal.cancelled = true;
    }
  }

  // ── Outbound API ───────────────────────────────────────────────────────

  async sendFiles(files) {
    if (!this._keyExchangeDone) throw new Error('Key exchange not complete');
    const ids = [];
    for (const file of files) {
      const id     = nanoid(10);
      const signal = { paused: false, cancelled: false, _error: null };
      const state  = {
        id, file, signal,
        status:    'queued',
        sent:      0,
        startedAt: null,
        _speedEMA: null,
        speed:     0,
        eta:       Infinity,
        fileKey:   null,
        // Resume checkpoint
        _resumeOffset: 0,
        _resumeSeq:    0,
      };
      this._transfers.set(id, state);
      ids.push(id);
      this._emitUpdate(state);
    }
    for (const id of ids) {
      const s = this._transfers.get(id);
      if (s && !s.signal.cancelled) await this._sendOne(s);
    }
    return ids;
  }

  async _sendOne(state) {
    const { id, file, signal } = state;
    const fileIndex = this._fileKeyIndex++;
    const fileKey   = await deriveFileKey(this._sessionKey, fileIndex);
    state.fileKey   = fileKey;

    // Encrypt and send metadata
    const metaPlain = {
      name: file.name, size: file.size,
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified, fileIndex,
      chunkSize: adaptiveChunkSize(file.size),
    };
    const encMeta = await encryptMetadata(this._sessionKey, metaPlain, id);
    this._sendControl(TRANSFER_EVENTS.FILE_META, {
      id, encryptedMeta: encMeta, size: file.size,
    });

    try {
      await this._waitForEvent(`meta-ack:${id}`, 15_000);
    } catch {
      state.status = 'error';
      this._emitUpdate(state);
      zeroKey(fileKey); state.fileKey = null;
      return;
    }

    state.status    = 'transferring';
    state.startedAt = Date.now();
    this._emitUpdate(state);

    let lastSampleTime  = Date.now();
    let lastSampleBytes = 0;

    // ACK/NACK router for this transfer
    const ackRouter = (msg) => {
      for (const h of this._ackHandlers) h(msg);
    };

    // Register this transfer's ACK handler subscription
    const registerAckHandler = (handler) => {
      this._ackHandlers.add(handler);
      return () => this._ackHandlers.delete(handler);
    };

    try {
      const { hash } = await streamFileEncrypted(
        file,
        fileKey,
        (frame) => this._pc.send(frame),
        registerAckHandler,
        ({ sent, total }) => {
          state.sent   = sent;
          state.status = signal.paused ? 'paused' : 'transferring';
          // Save resume checkpoint
          state._resumeOffset = sent;

          const now   = Date.now();
          const dtSec = (now - lastSampleTime) / 1000;
          if (dtSec >= 0.4) {
            const raw      = (sent - lastSampleBytes) / dtSec;
            state._speedEMA = state._speedEMA == null ? raw : 0.3 * raw + 0.7 * state._speedEMA;
            state.speed    = state._speedEMA;
            state.eta      = state.speed > 0 ? (total - sent) / state.speed : Infinity;
            lastSampleTime  = now;
            lastSampleBytes = sent;
          }
          this._emitUpdate(state);
        },
        signal,
        () => this._pc.waitForBufferDrain(),
        state._resumeOffset,
        state._resumeSeq,
      );

      this._sendControl(TRANSFER_EVENTS.FILE_COMPLETE, { id, hash });
      state.status = 'complete';
      state.speed  = 0;
      state.eta    = 0;
      this._emitUpdate(state);

    } catch (err) {
      if (err instanceof CancelledError) {
        this._sendControl(TRANSFER_EVENTS.TRANSFER_CANCEL, { id });
        state.status = 'cancelled';
      } else {
        this._sendControl(TRANSFER_EVENTS.FILE_ERROR, { id, message: err.message });
        state.status = 'error';
      }
      this._emitUpdate(state);
    } finally {
      zeroKey(fileKey);
      state.fileKey = null;
    }
  }

  // ── Transfer controls ──────────────────────────────────────────────────

  pause(id) {
    const s = this._transfers.get(id);
    if (s?.status === 'transferring') {
      s.signal.paused = true;
      s.status = 'paused';
      this._sendControl(TRANSFER_EVENTS.TRANSFER_PAUSE, { id });
      this._emitUpdate(s);
    }
  }

  resume(id) {
    const s = this._transfers.get(id);
    if (s?.status === 'paused') {
      s.signal.paused = false;
      s.status = 'transferring';
      this._sendControl(TRANSFER_EVENTS.TRANSFER_RESUME, { id });
      this._emitUpdate(s);
    }
  }

  cancel(id) {
    const s = this._transfers.get(id);
    if (s) {
      s.signal.cancelled = true;
      // status will update via the streaming loop's CancelledError path
    }
  }

  // ── Inbound ────────────────────────────────────────────────────────────

  async _handleFileMeta(data) {
    const { id, encryptedMeta, size } = data;
    const fileIndex = this._nextInboundFileIndex++;
    const fileKey   = await deriveFileKey(this._sessionKey, fileIndex);

    let meta;
    try {
      meta = await decryptMetadata(this._sessionKey, encryptedMeta.nonce, encryptedMeta.ciphertext, id);
    } catch (err) {
      this._emit('transfer-error', { id, message: err.message });
      zeroKey(fileKey);
      return;
    }

    const buf = new ReceiveBuffer(meta, fileKey, (frame) => this._pc.send(frame));
    this._receiveBuffers.set(id, buf);

    this._sendControl(TRANSFER_EVENTS.FILE_META_ACK, { id });
    this._emit('transfer-incoming', {
      id, name: meta.name, size: meta.size, type: meta.type,
      status: 'transferring', percent: 0, direction: 'receive',
    });
  }

  _handleStreamHeader(id, header) {
    const buf = this._receiveBuffers.get(id);
    if (!buf) return;
    try {
      buf.initDecryptStream(header);
    } catch (err) {
      this._emit('transfer-error', { id, message: 'Invalid stream header: ' + err.message });
      this._cleanupReceive(id);
    }
  }

  async _handleStreamChunk(id, seq, ciphertext) {
    const buf = this._receiveBuffers.get(id);
    if (!buf || !buf.decryptState) return;

    const { ok, isFinal, errorMsg } = await buf.processChunk(seq, ciphertext);

    if (!ok) {
      // NACK — sender will retransmit
      const reason = errorMsg?.includes('Expected seq')
        ? NACK_REASON_SEQ_MISMATCH
        : NACK_REASON_DECRYPT_FAIL;
      this._pc.send(encodeNack(seq, reason));
      // On seq mismatch, abort — the stream is unrecoverable with secretstream
      if (reason === NACK_REASON_SEQ_MISMATCH) {
        this._emit('transfer-error', { id, message: errorMsg });
        this._cleanupReceive(id);
      }
      return;
    }

    // ACK
    this._pc.send(encodeAck(seq));

    // Emit progress
    this._emit('transfer-progress', {
      id,
      received: buf.received,
      total:    buf.meta.size,
      percent:  buf.meta.size > 0 ? (buf.received / buf.meta.size) * 100 : 0,
      speed:    buf.speed,
      eta:      buf.eta,
      status:   'transferring',
    });
  }

  async _handleFileComplete(data) {
    const { id, hash } = data;
    const buf = this._receiveBuffers.get(id);
    if (!buf) return;

    try {
      await buf.finalise(hash);
      this._cleanupReceive(id);
      this._emit('transfer-complete', { id, name: buf.meta.name, size: buf.meta.size });
    } catch (err) {
      this._emit('transfer-error', { id, message: err.message });
      this._cleanupReceive(id);
    }
  }

  _cleanupReceive(id) {
    const buf = this._receiveBuffers.get(id);
    if (buf) { buf.dispose(); zeroKey(buf.fileKey); this._receiveBuffers.delete(id); }
  }

  // ── Message routing ────────────────────────────────────────────────────

  _onMessage(data) {
    // All messages are binary-framed (see fileChunker.js encodeControl/encodeHeader/
    // encodeChunk). A non-binary payload here is either a misbehaving peer or a
    // protocol mismatch — drop it rather than attempting to parse it as JSON.
    const isBinary = data instanceof ArrayBuffer || ArrayBuffer.isView(data);
    if (!isBinary) return;

    const raw    = data instanceof ArrayBuffer ? data : data.buffer;
    const parsed = parseBinaryMessage(raw);
    if (!parsed) return;

    switch (parsed.type) {
      case MSG_TYPE_CONTROL:
        this._dispatchControl(parsed.data);
        break;

      case MSG_TYPE_HEADER: {
        const id = this._getActiveInboundId();
        if (id) this._handleStreamHeader(id, parsed.data);
        break;
      }

      case MSG_TYPE_CHUNK: {
        const id = this._getActiveInboundId();
        if (id) this._handleStreamChunk(id, parsed.data.seq, parsed.data.ciphertext);
        break;
      }

      // ACK / NACK — route to sender's registered handlers
      case MSG_TYPE_ACK:
        for (const h of this._ackHandlers) h({ type: 'ack', seq: parsed.data.seq });
        break;

      case MSG_TYPE_NACK:
        for (const h of this._ackHandlers) h({ type: 'nack', seq: parsed.data.seq, reason: parsed.data.reason });
        break;
    }
  }

  _getActiveInboundId() {
    for (const [id, buf] of this._receiveBuffers) {
      if (!buf._streamFinalReceived) return id;
    }
    const keys = [...this._receiveBuffers.keys()];
    return keys[keys.length - 1] ?? null;
  }

  _dispatchControl(msg) {
    const { event, payload } = msg ?? {};
    switch (event) {
      case TRANSFER_EVENTS.KEY_EXCHANGE:
        this._handleKeyExchange(payload); break;
      case TRANSFER_EVENTS.KEY_EXCHANGE_ACK:
        if (payload?.fingerprint) this.sessionFingerprint = payload.fingerprint;
        break;
      case TRANSFER_EVENTS.FILE_META:
        this._handleFileMeta(payload); break;
      case TRANSFER_EVENTS.FILE_META_ACK:
        this.dispatchEvent(new CustomEvent(`meta-ack:${payload?.id}`, { detail: payload }));
        break;
      case TRANSFER_EVENTS.FILE_COMPLETE:
        this._handleFileComplete(payload); break;
      case TRANSFER_EVENTS.FILE_ERROR:
        this._emit('transfer-error', payload); break;
      case TRANSFER_EVENTS.TRANSFER_CANCEL:
        this._emit('transfer-cancelled', payload); break;
      case TRANSFER_EVENTS.TRANSFER_PAUSE:
        this._emit('transfer-paused', payload); break;
      case TRANSFER_EVENTS.TRANSFER_RESUME:
        this._emit('transfer-resumed', payload); break;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  _sendControl(event, payload) {
    this._pc.send(encodeControl({ event, payload }));
  }

  _emitUpdate(state) {
    this._emit('transfer-update', {
      id:        state.id,
      name:      state.file.name,
      size:      state.file.size,
      type:      state.file.type,
      status:    state.status,
      sent:      state.sent,
      speed:     state.speed,
      eta:       state.eta,
      percent:   state.file.size > 0 ? (state.sent / state.file.size) * 100 : 0,
      direction: 'send',
    });
  }

  _waitForEvent(type, ms) {
    return new Promise((resolve, reject) => {
      const cb    = () => { clearTimeout(t); this.removeEventListener(type, cb); resolve(); };
      const t     = setTimeout(() => { this.removeEventListener(type, cb); reject(new Error(`Timeout: ${type}`)); }, ms);
      this.addEventListener(type, cb);
    });
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on(type, handler) {
    const cb = (e) => handler(e.detail);
    this.addEventListener(type, cb);
    return () => this.removeEventListener(type, cb);
  }

  destroy() {
    this._pcUnsubs.forEach((u) => u());
    for (const s of this._transfers.values()) { s.signal.cancelled = true; zeroKey(s.fileKey); }
    for (const b of this._receiveBuffers.values()) { b.dispose(); zeroKey(b.fileKey); }
    this._transfers.clear();
    this._receiveBuffers.clear();
    this._ackHandlers.clear();
    zeroKey(this._sessionKey);
    this._keyExchangeDone = false;
  }
}
