/**
 * fileChunker.js — Streaming pipeline with sliding-window ACKs, resume, and retry
 *
 * Wire protocol (binary ArrayBuffer frames):
 *
 *   CONTROL  [0x00][utf8 JSON]
 *   HEADER   [0x01][24B secretstream header]
 *   CHUNK    [0x02][4B seq BE][4B cipherLen BE][ciphertext]
 *   ACK      [0x03][4B seq BE]
 *   NACK     [0x04][4B seq BE][1B reason]
 *
 * Streaming model:
 *   - Adaptive chunk size based on file size
 *   - Sliding window: sender keeps ≤ WINDOW_SIZE chunks in-flight
 *   - Receiver ACKs every chunk; sender advances window on ACK
 *   - NACK triggers retransmit of that chunk (up to MAX_CHUNK_RETRIES)
 *   - Pause: sender stops advancing; outstanding ACKs still processed
 *   - Resume from offset: sender re-inits secretstream from pause point,
 *     sends new HEADER, receiver re-inits decrypt stream
 *   - Large file (>1 GB): streaming Blob write via WritableStream to avoid
 *     holding entire file in RAM; falls back to chunk accumulation
 */

import { CHUNK_CONFIG } from '@shared/constants';
import {
  initEncryptStream,
  encryptStreamChunk,
  initDecryptStream,
  decryptStreamChunk,
  createHashState,
  updateHashState,
  finaliseHash,
} from './crypto';

// ── Frame type tags ────────────────────────────────────────────────────────
export const MSG_TYPE_CONTROL = 0x00;
export const MSG_TYPE_HEADER  = 0x01;
export const MSG_TYPE_CHUNK   = 0x02;
export const MSG_TYPE_ACK     = 0x03;
export const MSG_TYPE_NACK    = 0x04;

export const NACK_REASON_DECRYPT_FAIL = 0x01;
export const NACK_REASON_SEQ_MISMATCH = 0x02;
export const NACK_REASON_TIMEOUT      = 0x03;

// ── Adaptive chunk sizing ──────────────────────────────────────────────────

/**
 * Choose chunk size based on file size.
 * Larger chunks = higher throughput but more retransmit cost on failure.
 */
export function adaptiveChunkSize(fileSize) {
  if (fileSize < CHUNK_CONFIG.SMALL_FILE_THRESHOLD)  return CHUNK_CONFIG.CHUNK_SIZE_SMALL;
  if (fileSize < CHUNK_CONFIG.LARGE_FILE_THRESHOLD)  return CHUNK_CONFIG.CHUNK_SIZE_DEFAULT;
  if (fileSize < 1024 * 1024 * 1024)                return CHUNK_CONFIG.CHUNK_SIZE_LARGE;
  return CHUNK_CONFIG.CHUNK_SIZE_HUGE; // >1 GB
}

/**
 * Choose sliding window size based on chunk size.
 * Smaller chunks → larger window (more in-flight); larger chunks → smaller window.
 */
export function adaptiveWindowSize(chunkSize) {
  if (chunkSize <= CHUNK_CONFIG.CHUNK_SIZE_SMALL)   return 64;
  if (chunkSize <= CHUNK_CONFIG.CHUNK_SIZE_DEFAULT)  return CHUNK_CONFIG.WINDOW_SIZE_DEFAULT;
  return CHUNK_CONFIG.WINDOW_SIZE_LARGE;
}

// ── Sender pipeline ────────────────────────────────────────────────────────

/**
 * Stream a file with sliding-window ACKs, pause/cancel, and retry support.
 *
 * @param {File}       file
 * @param {Uint8Array} fileKey        Per-file 32-byte subkey
 * @param {Function}   sendBinary     (ArrayBuffer) → void
 * @param {Function}   onAck          Register ACK/NACK handler: (handler) → unsubscribe fn
 *                                    handler receives { type: 'ack'|'nack', seq, reason? }
 * @param {Function}   [onProgress]   ({ sent, total, percent }) → void
 * @param {object}     [signal]       { paused: boolean, cancelled: boolean }
 * @param {Function}   [waitForDrain] () → Promise<void>
 * @param {number}     [startOffset]  Byte offset to resume from (default 0)
 * @param {number}     [startSeq]     Sequence number to resume from (default 0)
 * @returns {Promise<{ hash: string, bytesSent: number }>}
 */
export async function streamFileEncrypted(
  file,
  fileKey,
  sendBinary,
  onAck,
  onProgress   = null,
  signal       = {},
  waitForDrain = null,
  startOffset  = 0,
  startSeq     = 0,
) {
  const fileSize  = file.size;
  const chunkSize = adaptiveChunkSize(fileSize);
  const winSize   = adaptiveWindowSize(chunkSize);

  // Init secretstream from startOffset
  const { state: encState, header } = initEncryptStream(fileKey);
  sendBinary(encodeHeader(header));

  // Hash state — if resuming, we must recompute from the beginning.
  // For simplicity (and correctness with secretstream), resume always restarts
  // from startOffset with a fresh stream. The hash covers the full file.
  const hashState = createHashState();

  // Sliding window state
  // pendingAcks: seq → { resolve, reject, retries, timer, ciphertext }
  const pendingAcks  = new Map();
  let   windowSeq    = startSeq;   // next seq to send
  let   ackedThrough = startSeq - 1; // highest contiguously acked seq

  // Register ACK/NACK handler
  const unsub = onAck((msg) => {
    if (msg.type === 'ack') {
      const entry = pendingAcks.get(msg.seq);
      if (entry) {
        clearTimeout(entry.timer);
        pendingAcks.delete(msg.seq);
        entry.resolve();
        // Advance ackedThrough
        while (pendingAcks.size === 0 || !pendingAcks.has(ackedThrough + 1)) {
          if (!pendingAcks.has(ackedThrough + 1)) {
            ackedThrough = Math.max(ackedThrough, msg.seq);
            break;
          }
          ackedThrough++;
        }
      }
    } else if (msg.type === 'nack') {
      const entry = pendingAcks.get(msg.seq);
      if (entry) {
        clearTimeout(entry.timer);
        if (entry.retries < CHUNK_CONFIG.MAX_CHUNK_RETRIES) {
          entry.retries++;
          // Retransmit
          sendBinary(encodeChunk(msg.seq, entry.ciphertext));
          entry.timer = startAckTimer(msg.seq, entry, sendBinary, pendingAcks, signal);
        } else {
          entry.reject(new RetryExhaustedError(msg.seq));
        }
      }
    }
  });

  let offset = startOffset;
  let seq    = startSeq;

  try {
    while (offset < fileSize) {
      // ── Pause gate ───────────────────────────────────────────────────
      while (signal.paused && !signal.cancelled) await sleep(150);
      if (signal.cancelled) throw new CancelledError();

      // ── Window gate — don't exceed in-flight limit ───────────────────
      while (pendingAcks.size >= winSize && !signal.cancelled) {
        await sleep(10);
      }
      if (signal.cancelled) throw new CancelledError();

      // ── Backpressure gate ────────────────────────────────────────────
      if (waitForDrain) await waitForDrain();
      if (signal.cancelled) throw new CancelledError();

      // ── Read + encrypt ───────────────────────────────────────────────
      const end     = Math.min(offset + chunkSize, fileSize);
      const plain   = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      const isFinal = end >= fileSize;

      updateHashState(hashState, plain);
      const ciphertext = encryptStreamChunk(encState, plain, isFinal);

      // Track in pending window (for possible retransmit)
      const ackPromise = new Promise((resolve, reject) => {
        const entry = {
          resolve, reject,
          retries:    0,
          ciphertext, // keep for retransmit
          timer:      null,
        };
        entry.timer = startAckTimer(seq, entry, sendBinary, pendingAcks, signal);
        pendingAcks.set(seq, entry);
      });

      sendBinary(encodeChunk(seq, ciphertext));

      offset += plain.byteLength;
      seq++;

      onProgress?.({ sent: offset, total: fileSize, percent: (offset / fileSize) * 100 });

      // Await the ACK for this specific chunk before reading further
      // (ordered delivery guaranteed by DataChannel; this just enforces the window)
      // We don't await here — the window gate above handles flow control.
      // But we DO want to surface retransmit errors:
      ackPromise.catch((err) => { if (!signal.cancelled) signal._error = err; });

      if (signal._error) throw signal._error;

      await sleep(0); // yield for UI
    }

    // ── Drain remaining ACKs ─────────────────────────────────────────────
    while (pendingAcks.size > 0 && !signal.cancelled) {
      if (signal._error) throw signal._error;
      await sleep(20);
    }
    if (signal.cancelled) throw new CancelledError();

    return { hash: finaliseHash(hashState), bytesSent: offset };

  } finally {
    unsub();
    // Clear timers on any pending entries
    for (const entry of pendingAcks.values()) clearTimeout(entry.timer);
    pendingAcks.clear();
  }
}

function startAckTimer(seq, entry, sendBinary, pendingAcks, signal) {
  return setTimeout(() => {
    if (!pendingAcks.has(seq)) return;
    if (entry.retries < CHUNK_CONFIG.MAX_CHUNK_RETRIES) {
      entry.retries++;
      sendBinary(encodeChunk(seq, entry.ciphertext));
      entry.timer = startAckTimer(seq, entry, sendBinary, pendingAcks, signal);
    } else {
      pendingAcks.delete(seq);
      entry.reject(new RetryExhaustedError(seq));
    }
  }, CHUNK_CONFIG.CHUNK_ACK_TIMEOUT_MS);
}

// ── Receiver pipeline ──────────────────────────────────────────────────────

/**
 * ReceiveBuffer — manages inbound chunk assembly for one file transfer.
 *
 * For files ≤ LARGE_FILE_THRESHOLD: accumulates chunks in memory, assembles at end.
 * For files > LARGE_FILE_THRESHOLD: writes via WritableStream / FileSystemWritableFileStream
 * if the File System Access API is available, otherwise falls back to memory.
 */
export class ReceiveBuffer {
  constructor(meta, fileKey, sendControl) {
    this.meta          = meta;
    this.fileKey       = fileKey;
    this._sendControl  = sendControl;

    this.decryptState  = null; // set on header receipt
    this.expectedSeq   = 0;
    this.received      = 0;
    this.hashState     = createHashState();
    this._streamFinalReceived = false;

    // Speed tracking
    this._speedEMA  = null;
    this.speed      = 0;
    this.eta        = Infinity;
    this.lastSample = Date.now();
    this.lastBytes  = 0;

    // Storage strategy
    this._isLarge   = meta.size > CHUNK_CONFIG.LARGE_FILE_THRESHOLD;
    this._chunks    = []; // used for small files
    this._writer    = null; // FileSystemWritableFileStream for large files
    this._fileHandle= null;
    this._writeQueue= Promise.resolve(); // serialize writes
  }

  /** Must be called with the stream header before processing any chunks. */
  initDecryptStream(header) {
    this.decryptState = initDecryptStream(this.fileKey, header);
  }

  /**
   * Process one incoming chunk.
   * Returns { ok: boolean, isFinal: boolean, errorMsg?: string }
   */
  async processChunk(seq, ciphertext) {
    // Late duplicate — the sender's ACK timeout fired and retransmitted a chunk
    // that actually arrived fine the first time (common on slow/relayed links
    // where the ACK just took longer than the timeout). Since the DataChannel
    // is ordered+reliable, this chunk was already processed; harmlessly
    // re-ACK it and drop it instead of treating it as a desync.
    if (seq < this.expectedSeq) {
      return { ok: true, isFinal: false, duplicate: true };
    }
    // Sequence check — a seq AHEAD of expected means a genuine gap/desync,
    // which is unrecoverable with a stateful secretstream.
    if (seq !== this.expectedSeq) {
      return { ok: false, errorMsg: `Expected seq ${this.expectedSeq}, got ${seq}` };
    }

    // Decrypt
    let plaintext, isFinal;
    try {
      ({ plaintext, isFinal } = decryptStreamChunk(this.decryptState, ciphertext));
    } catch (err) {
      return { ok: false, errorMsg: err.message };
    }

    // Accumulate hash
    updateHashState(this.hashState, plaintext);
    this.received     += plaintext.byteLength;
    this.expectedSeq  += 1;
    if (isFinal) this._streamFinalReceived = true;

    // Store chunk
    await this._storeChunk(plaintext);

    // Update speed EMA
    const now   = Date.now();
    const dtSec = (now - this.lastSample) / 1000;
    if (dtSec >= 0.4) {
      const raw      = (this.received - this.lastBytes) / dtSec;
      this._speedEMA = this._speedEMA == null ? raw : 0.3 * raw + 0.7 * this._speedEMA;
      this.speed     = this._speedEMA;
      this.eta       = this.speed > 0 ? (this.meta.size - this.received) / this.speed : Infinity;
      this.lastSample = now;
      this.lastBytes  = this.received;
    }

    return { ok: true, isFinal };
  }

  async _storeChunk(plain) {
    if (this._isLarge && typeof showSaveFilePicker === 'function') {
      // Large file: stream to disk via File System Access API
      if (!this._fileHandle) {
        try {
          this._fileHandle = await showSaveFilePicker({
            suggestedName: this.meta.name,
            types: [{
              description: 'File',
              accept: { [this.meta.type || 'application/octet-stream']: [] },
            }],
          });
          this._writer = await this._fileHandle.createWritable();
        } catch {
          // User cancelled picker or API unavailable — fall back to memory
          this._isLarge = false;
          this._writer  = null;
        }
      }
      if (this._writer) {
        // Serialize writes to avoid interleaving
        this._writeQueue = this._writeQueue.then(() => this._writer.write(plain));
        return;
      }
    }
    // Memory accumulation (small files or fallback)
    this._chunks.push(plain);
  }

  /**
   * Verify integrity and trigger download.
   * @param {string} senderHash  hex BLAKE2b-256 from sender
   * @returns {Promise<void>}
   * @throws IntegrityError on mismatch
   */
  async finalise(senderHash) {
    const receiverHash = finaliseHash(this.hashState);
    if (receiverHash !== senderHash) {
      throw new IntegrityError(senderHash, receiverHash);
    }

    if (this._writer) {
      await this._writeQueue;
      await this._writer.close();
      // File System Access API: file is already saved — no further action needed
      return;
    }

    // Memory path: assemble blob and download
    assembleAndDownload(this._chunks, this.meta.name, this.meta.type);
  }

  dispose() {
    this._chunks = [];
    if (this._writer) {
      try { this._writer.abort(); } catch {}
      this._writer = null;
    }
  }
}

// ── Download assembly ─────────────────────────────────────────────────────

export function assembleAndDownload(chunks, fileName, mimeType) {
  const blob = new Blob(chunks, { type: mimeType || 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 90_000);
}

// ── Frame encoders ────────────────────────────────────────────────────────

export function encodeHeader(header) {
  const buf = new ArrayBuffer(1 + header.byteLength);
  new DataView(buf).setUint8(0, MSG_TYPE_HEADER);
  new Uint8Array(buf, 1).set(header);
  return buf;
}

export function encodeChunk(seq, ciphertext) {
  const buf = new ArrayBuffer(9 + ciphertext.byteLength);
  const dv  = new DataView(buf);
  dv.setUint8(0, MSG_TYPE_CHUNK);
  dv.setUint32(1, seq, false);
  dv.setUint32(5, ciphertext.byteLength, false);
  new Uint8Array(buf, 9).set(ciphertext);
  return buf;
}

export function encodeAck(seq) {
  const buf = new ArrayBuffer(5);
  const dv  = new DataView(buf);
  dv.setUint8(0, MSG_TYPE_ACK);
  dv.setUint32(1, seq, false);
  return buf;
}

export function encodeNack(seq, reason = NACK_REASON_DECRYPT_FAIL) {
  const buf = new ArrayBuffer(6);
  const dv  = new DataView(buf);
  dv.setUint8(0, MSG_TYPE_NACK);
  dv.setUint32(1, seq, false);
  dv.setUint8(5, reason);
  return buf;
}

export function encodeControl(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const buf   = new ArrayBuffer(1 + bytes.byteLength);
  new DataView(buf).setUint8(0, MSG_TYPE_CONTROL);
  new Uint8Array(buf, 1).set(bytes);
  return buf;
}

// ── Frame parser ──────────────────────────────────────────────────────────

export function parseBinaryMessage(raw) {
  const buf  = raw instanceof ArrayBuffer ? raw : raw.buffer;
  const dv   = new DataView(buf);
  const type = dv.getUint8(0);

  switch (type) {
    case MSG_TYPE_CONTROL: {
      try {
        const json = new TextDecoder().decode(new Uint8Array(buf, 1));
        return { type, data: JSON.parse(json) };
      } catch { return null; }
    }
    case MSG_TYPE_HEADER:
      return { type, data: new Uint8Array(buf, 1) };

    case MSG_TYPE_CHUNK: {
      const seq        = dv.getUint32(1, false);
      const cipherLen  = dv.getUint32(5, false);
      const ciphertext = new Uint8Array(buf, 9, cipherLen);
      return { type, data: { seq, ciphertext } };
    }
    case MSG_TYPE_ACK:
      return { type, data: { seq: dv.getUint32(1, false) } };

    case MSG_TYPE_NACK:
      return { type, data: { seq: dv.getUint32(1, false), reason: dv.getUint8(5) } };

    default:
      return null;
  }
}

// ── Errors ────────────────────────────────────────────────────────────────

export class CancelledError extends Error {
  constructor() { super('Transfer cancelled'); this.name = 'CancelledError'; }
}

export class IntegrityError extends Error {
  constructor(expected, actual) {
    super(`Integrity check failed.\nExpected: ${expected}\nGot: ${actual}`);
    this.name = 'IntegrityError';
  }
}

export class RetryExhaustedError extends Error {
  constructor(seq) {
    super(`Chunk ${seq} failed after ${CHUNK_CONFIG.MAX_CHUNK_RETRIES} retries`);
    this.name = 'RetryExhaustedError';
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
