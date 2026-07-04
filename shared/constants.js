// Shared constants — Nexus Transfer
// Used by both frontend (via Vite alias) and backend (Node ESM)

export const SIGNALING_EVENTS = {
  JOIN_ROOM:      'join-room',
  LEAVE_ROOM:     'leave-room',
  ROOM_CREATED:   'room-created',
  ROOM_JOINED:    'room-joined',
  ROOM_FULL:      'room-full',
  ROOM_NOT_FOUND: 'room-not-found',
  ROOM_EXPIRED:   'room-expired',
  PEER_JOINED:    'peer-joined',
  PEER_LEFT:      'peer-left',
  PEER_COUNT:     'peer-count',
  OFFER:          'offer',
  ANSWER:         'answer',
  ICE_CANDIDATE:  'ice-candidate',
  ROOM_INFO:      'room-info',
  PING:           'ping',
  PONG:           'pong',
  ERROR:          'error',
};

export const TRANSFER_EVENTS = {
  // Key exchange
  KEY_EXCHANGE:     'key-exchange',
  KEY_EXCHANGE_ACK: 'key-exchange-ack',

  // File-level handshake
  FILE_META:        'file-meta',
  FILE_META_ACK:    'file-meta-ack',
  FILE_COMPLETE:    'file-complete',
  FILE_ERROR:       'file-error',

  // Transfer control (sender ↔ receiver)
  TRANSFER_PAUSE:   'transfer-pause',
  TRANSFER_RESUME:  'transfer-resume',
  TRANSFER_CANCEL:  'transfer-cancel',
};
// Note: chunk-level ACK/NACK use binary wire tags (MSG_TYPE_ACK / MSG_TYPE_NACK
// in frontend/src/lib/fileChunker.js), not these JSON event strings — chunk
// acknowledgement is on the hot path and binary framing avoids JSON overhead.

// ── Chunk / buffer configuration ───────────────────────────────────────────

export const CHUNK_CONFIG = {
  // Adaptive chunk sizes based on file size
  SMALL_FILE_THRESHOLD:  10 * 1024 * 1024,   //  10 MB — use small chunks
  LARGE_FILE_THRESHOLD:  500 * 1024 * 1024,  // 500 MB — use large chunks
  CHUNK_SIZE_SMALL:      16 * 1024,           //  16 KB — low-latency for small files
  CHUNK_SIZE_DEFAULT:    64 * 1024,           //  64 KB — balanced
  CHUNK_SIZE_LARGE:      256 * 1024,          // 256 KB — throughput for large files
  CHUNK_SIZE_HUGE:       512 * 1024,          // 512 KB — >1 GB files

  // DataChannel backpressure
  BUFFER_HIGH_THRESHOLD: 4 * 1024 * 1024,    //   4 MB — stop sending
  BUFFER_LOW_THRESHOLD:  256 * 1024,          // 256 KB — resume sending

  // Sliding window (unacknowledged chunks in flight)
  WINDOW_SIZE_DEFAULT:   32,  // number of chunks in flight before waiting for ACKs
  WINDOW_SIZE_LARGE:     16,  // smaller window for huge chunks to limit memory use

  // Retry
  MAX_CHUNK_RETRIES:     3,
  CHUNK_ACK_TIMEOUT_MS:  8_000,  // wait this long for a chunk ACK before NACK/retry
};

export const ROOM_CONFIG = {
  MAX_PEERS_PER_ROOM: 10,
  ROOM_ID_LENGTH:     12,
  ROOM_EXPIRY_MS:     24 * 60 * 60 * 1000,
};

export const SIGNALING_CONFIG = {
  PING_INTERVAL_MS:        25_000,
  PING_TIMEOUT_MS:         10_000,
  RECONNECT_BASE_MS:        1_000,
  RECONNECT_MAX_MS:        30_000,
  RECONNECT_JITTER_MS:       500,
  MAX_MESSAGES_PER_SECOND:    50,
};

export const APP_CONFIG = {
  APP_NAME:      'Nexus Transfer',
  APP_VERSION:   '1.0.0',
  MAX_FILE_SIZE: 10 * 1024 * 1024 * 1024,
};
