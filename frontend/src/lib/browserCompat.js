/**
 * browserCompat.js — Browser capability detection and compatibility shims.
 *
 * Checked on app startup and before room join.
 * All gates are conservative: we fail closed, not open.
 */

// ── Required API surface ───────────────────────────────────────────────────

const REQUIRED = {
  'WebRTC (RTCPeerConnection)': () =>
    typeof RTCPeerConnection !== 'undefined',

  'DataChannel': () => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      const ok = typeof pc.createDataChannel === 'function';
      pc.close();
      return ok;
    } catch { return false; }
  },

  'WebSocket': () => typeof WebSocket !== 'undefined',

  'Web Crypto (SubtleCrypto)': () =>
    typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',

  'WebAssembly (for libsodium)': () =>
    typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function',

  'Blob + URL.createObjectURL': () =>
    typeof Blob !== 'undefined' && typeof URL.createObjectURL === 'function',
};

// ── Compatibility check ────────────────────────────────────────────────────

/**
 * Run all required capability checks.
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function checkBrowserCompat() {
  const missing = [];
  for (const [label, test] of Object.entries(REQUIRED)) {
    try {
      if (!test()) missing.push(label);
    } catch {
      missing.push(label);
    }
  }
  return { ok: missing.length === 0, missing };
}

// ── RTCPeerConnection config helpers ──────────────────────────────────────

/**
 * Fetch ICE server config from the backend.
 * Falls back to public STUN-only if the request fails.
 *
 * Credentials are served by the backend so they never appear in client bundles.
 */
export async function fetchIceConfig(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/ice-config`, { cache: 'no-store' });
    if (!res.ok) throw new Error('ice-config fetch failed');
    const { iceServers, hasTurn } = await res.json();
    return { iceServers, hasTurn };
  } catch {
    // Degrade gracefully to public STUN
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302'  },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      hasTurn: false,
    };
  }
}

/**
 * Build RTCConfiguration with iceServers and browser-appropriate policies.
 */
export function buildRTCConfig(iceServers) {
  return {
    iceServers,
    bundlePolicy:       'max-bundle',
    rtcpMuxPolicy:      'require',
    // Prefer UDP; TCP is the TURN fallback path
    iceTransportPolicy: 'all',
  };
}

// ── Network quality estimation ────────────────────────────────────────────

/**
 * Classify RTT into a quality tier.
 * @returns {'excellent'|'good'|'fair'|'poor'|'unknown'}
 */
export function classifyRTT(rttMs) {
  if (rttMs == null) return 'unknown';
  if (rttMs <   50) return 'excellent';
  if (rttMs <  150) return 'good';
  if (rttMs <  300) return 'fair';
  return 'poor';
}

/**
 * Classify packet loss percentage into a quality tier.
 */
export function classifyLoss(lossPct) {
  if (lossPct == null) return 'unknown';
  if (lossPct === 0)   return 'excellent';
  if (lossPct <   1)   return 'good';
  if (lossPct <   5)   return 'fair';
  return 'poor';
}

/**
 * Aggregate RTT + loss + connection type into a single quality score.
 * Returns 0 (worst) – 100 (best).
 */
export function computeQualityScore({ roundTripTimeMs, connectionType, dataChannel }) {
  let score = 100;

  // RTT penalty
  if (roundTripTimeMs != null) {
    if (roundTripTimeMs > 300) score -= 40;
    else if (roundTripTimeMs > 150) score -= 20;
    else if (roundTripTimeMs > 50)  score -= 10;
  } else {
    score -= 20; // unknown
  }

  // Connection type penalty (relay = more latency + overhead)
  if (connectionType?.includes('relay')) score -= 15;
  else if (connectionType?.includes('STUN')) score -= 5;

  // DataChannel send rate: if very low while active, penalise
  if (dataChannel?.sendRateBps != null && dataChannel.sendRateBps < 50_000) score -= 10;

  return Math.max(0, Math.min(100, score));
}
