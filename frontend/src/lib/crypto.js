/**
 * crypto.js — Nexus Transfer cryptographic primitives
 *
 * Primitives used (all from libsodium):
 *
 *  Key exchange:
 *    X25519 (crypto_kx) — ephemeral ECDH per session
 *    Produces separate tx/rx keys so each direction has a unique key.
 *
 *  Metadata encryption:
 *    XChaCha20-Poly1305-IETF (crypto_aead_xchacha20poly1305_ietf)
 *    — 192-bit nonce, 128-bit authentication tag
 *    — Additional data = transfer ID (binds ciphertext to this transfer)
 *
 *  Chunk encryption:
 *    crypto_secretstream_xchacha20poly1305
 *    — Designed for streaming: built-in sequence numbers, replay protection,
 *      truncation detection, and a TAG_FINAL sentinel on the last chunk.
 *    — Each file gets a fresh subkey derived via crypto_kdf so the session
 *      key is never used directly.
 *
 *  File integrity:
 *    BLAKE2b-256 (crypto_generichash) over plaintext
 *    — Hash computed before encryption, sent encrypted with metadata.
 *    — Receiver verifies hash after decryption as end-to-end integrity check.
 *
 *  Session fingerprint:
 *    BLAKE2b-256 over (myPublicKey ∥ theirPublicKey)
 *    — Displayed to users as a short hex code to detect MITM.
 */

import sodium from 'libsodium-wrappers';

// ── Initialisation ─────────────────────────────────────────────────────────

let _ready = false;
let _readyPromise = null;

/**
 * Initialise libsodium. Safe to call multiple times; subsequent calls are no-ops.
 * Must be awaited before any other crypto function.
 */
export async function initCrypto() {
  if (_ready) return;
  if (!_readyPromise) _readyPromise = sodium.ready;
  await _readyPromise;
  _ready = true;
}

function assertReady() {
  if (!_ready) throw new Error('initCrypto() must be awaited before using crypto primitives');
}

// ── Key exchange ───────────────────────────────────────────────────────────

/**
 * Generate an ephemeral X25519 keypair.
 * A new keypair MUST be generated for every session.
 * @returns {{ publicKey: Uint8Array, privateKey: Uint8Array }}
 */
export async function generateKeyPair() {
  await initCrypto();
  const kp = sodium.crypto_kx_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

/**
 * Derive session keys — sender (client) side.
 * Returns { sharedRx, sharedTx }: sharedTx for encrypting outbound, sharedRx for decrypting inbound.
 */
export async function deriveSharedKeySender(myPrivateKey, theirPublicKey) {
  await initCrypto();
  const myPublicKey = sodium.crypto_scalarmult_base(myPrivateKey);
  return sodium.crypto_kx_client_session_keys(myPublicKey, myPrivateKey, theirPublicKey);
}

/**
 * Derive session keys — receiver (server) side.
 */
export async function deriveSharedKeyReceiver(myPrivateKey, theirPublicKey) {
  await initCrypto();
  const myPublicKey = sodium.crypto_scalarmult_base(myPrivateKey);
  return sodium.crypto_kx_server_session_keys(myPublicKey, myPrivateKey, theirPublicKey);
}

/**
 * Compute a session fingerprint: BLAKE2b-256(pubA ∥ pubB) where A < B
 * (lexicographic ordering ensures both sides produce the same fingerprint).
 * Returns a 8-character hex string for display.
 */
export async function computeSessionFingerprint(myPublicKey, theirPublicKey) {
  await initCrypto();
  // Stable ordering regardless of who is sender/receiver
  const [first, second] = bufferLt(myPublicKey, theirPublicKey)
    ? [myPublicKey, theirPublicKey]
    : [theirPublicKey, myPublicKey];

  const combined = new Uint8Array(first.length + second.length);
  combined.set(first, 0);
  combined.set(second, first.length);

  const hash = sodium.crypto_generichash(32, combined);
  return toHex(hash).slice(0, 16); // 8 bytes = 16 hex chars
}

// ── Per-file subkey derivation ─────────────────────────────────────────────

// crypto_kdf_derive_from_key requires the context to be a plain string of
// exactly 8 characters — NOT a Uint8Array. Passing a Uint8Array throws
// "TypeError: ctx must be a string".
const KDF_CONTEXT = 'NexusTfr'; // exactly 8 ASCII chars

/**
 * Derive a unique 32-byte subkey for one file transfer from the session key.
 * Using crypto_kdf prevents reuse of the session key as a streaming key.
 *
 * @param {Uint8Array} sessionKey  32-byte session key
 * @param {number}     fileIndex   Monotonically increasing counter (prevents subkey reuse)
 * @returns {Uint8Array}           32-byte subkey
 */
export async function deriveFileKey(sessionKey, fileIndex) {
  assertReady();
  // crypto_kdf_derive_from_key(subkeyLen, subkeyId, ctx, masterKey)
  return sodium.crypto_kdf_derive_from_key(32, fileIndex + 1, KDF_CONTEXT, sessionKey);
}

// ── Metadata encryption ────────────────────────────────────────────────────

/**
 * Encrypt file metadata (name, size, type, integrity hash, etc.) with AEAD.
 * The transfer ID is used as additional data — the ciphertext is bound to
 * this specific transfer and cannot be replayed in another.
 *
 * @param {Uint8Array} key       32-byte key (session tx key)
 * @param {object}     metadata  Plain JS object
 * @param {string}     transferId Used as AEAD additional data
 * @returns {{ nonce: string, ciphertext: string }}  base64-encoded
 */
export async function encryptMetadata(key, metadata, transferId) {
  assertReady();
  const plain  = new TextEncoder().encode(JSON.stringify(metadata));
  const ad     = new TextEncoder().encode(transferId);
  const nonce  = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const cipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plain, ad, null, nonce, key);
  return { nonce: toBase64(nonce), ciphertext: toBase64(cipher) };
}

/**
 * Decrypt file metadata.
 * @throws If authentication fails or JSON is invalid.
 */
export async function decryptMetadata(key, nonce, ciphertext, transferId) {
  assertReady();
  const n    = fromBase64(nonce);
  const c    = fromBase64(ciphertext);
  const ad   = new TextEncoder().encode(transferId);
  let plain;
  try {
    plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, c, ad, n, key);
  } catch {
    throw new Error('Metadata authentication failed — possible tampering detected');
  }
  if (!plain) throw new Error('Metadata decryption returned null');
  return JSON.parse(new TextDecoder().decode(plain));
}

// ── Streaming chunk encryption (secretstream) ──────────────────────────────

/**
 * Initialise an encryption stream for one file.
 * Returns { state, header } — header must be sent to the receiver before any chunks.
 *
 * @param {Uint8Array} fileKey  32-byte per-file subkey
 */
export function initEncryptStream(fileKey) {
  assertReady();
  const result = sodium.crypto_secretstream_xchacha20poly1305_init_push(fileKey);
  return { state: result.state, header: result.header };
}

/**
 * Encrypt one chunk.
 * @param {object}     state    Stream state from initEncryptStream
 * @param {Uint8Array} chunk    Plaintext bytes
 * @param {boolean}    isFinal  True for the last chunk — embeds TAG_FINAL
 * @returns {Uint8Array}        Ciphertext (includes 17-byte MAC + tag)
 */
export function encryptStreamChunk(state, chunk, isFinal) {
  assertReady();
  const tag = isFinal
    ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
    : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
  return sodium.crypto_secretstream_xchacha20poly1305_push(state, chunk, null, tag);
}

/**
 * Initialise a decryption stream for one file.
 * @param {Uint8Array} fileKey  32-byte per-file subkey
 * @param {Uint8Array} header   24-byte header received from sender
 */
export function initDecryptStream(fileKey, header) {
  assertReady();
  return sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, fileKey);
}

/**
 * Decrypt one chunk.
 * @param {object}     state      Stream state from initDecryptStream
 * @param {Uint8Array} ciphertext Encrypted chunk bytes
 * @returns {{ plaintext: Uint8Array, isFinal: boolean }}
 * @throws On authentication failure (tag mismatch, reorder, replay, truncation)
 */
export function decryptStreamChunk(state, ciphertext) {
  assertReady();
  const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, ciphertext, null);
  if (!result) throw new Error('Chunk authentication failed — stream may be corrupted or replayed');
  const isFinal = result.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL;
  return { plaintext: result.message, isFinal };
}

// ── File integrity hash ────────────────────────────────────────────────────

/**
 * Compute BLAKE2b-256 over an array of plaintext Uint8Array chunks.
 * Call before encrypting (sender) or after decrypting (receiver).
 * @returns {string} hex-encoded 32-byte hash
 */
export async function computeFileHash(chunks) {
  assertReady();
  const state = sodium.crypto_generichash_init(null, 32);
  for (const chunk of chunks) {
    sodium.crypto_generichash_update(state, chunk);
  }
  const hash = sodium.crypto_generichash_final(state, 32);
  return toHex(hash);
}

/**
 * Streaming hash update — call once per plaintext chunk during transfer.
 * Returns a hash state object (opaque; pass back to subsequent calls).
 */
export function createHashState() {
  assertReady();
  return sodium.crypto_generichash_init(null, 32);
}

export function updateHashState(state, chunk) {
  sodium.crypto_generichash_update(state, chunk);
  return state;
}

export function finaliseHash(state) {
  const hash = sodium.crypto_generichash_final(state, 32);
  return toHex(hash);
}

// ── Key material zeroing ───────────────────────────────────────────────────

/**
 * Zero a key Uint8Array in place.
 * Call when a session or file key is no longer needed.
 */
export function zeroKey(key) {
  if (key instanceof Uint8Array) key.fill(0);
}

// ── Encoding helpers ───────────────────────────────────────────────────────

export function toBase64(bytes) {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

export function fromBase64(str) {
  return sodium.from_base64(str, sodium.base64_variants.ORIGINAL);
}

export function toHex(bytes) {
  return sodium.to_hex(bytes);
}

export function fromHex(str) {
  return sodium.from_hex(str);
}

export function exportPublicKey(publicKey) {
  return toBase64(publicKey);
}

export function importPublicKey(b64) {
  return fromBase64(b64);
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** True if a < b lexicographically */
function bufferLt(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return a.length < b.length;
}
