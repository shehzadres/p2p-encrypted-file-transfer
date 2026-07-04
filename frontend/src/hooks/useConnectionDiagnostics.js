import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useConnectionDiagnostics — surfaces RTCStats-derived diagnostics for display.
 *
 * Performance note: this hook does NOT run its own getStats() polling loop.
 * PeerConnection already runs one internally (started via pc.startDiagnostics()
 * in useRoom.js) and emits a 'stats' event on each tick — this hook simply
 * subscribes to that existing stream. Running a second independent poll here
 * would call the expensive getStats() API twice per interval per peer for no
 * benefit, which matters on mobile where this adds up over a long transfer.
 *
 * @param {import('@/lib/peerConnection').PeerConnection|null} pc
 * @param {object}  opts
 * @param {boolean} opts.enabled  Whether to surface stats (default true)
 */
export function useConnectionDiagnostics(pc, { enabled = true } = {}) {
  const [stats,      setStats]      = useState(null);
  const [history,    setHistory]    = useState([]); // rolling 30-point RTT history
  const [diagEvents, setDiagEvents] = useState([]); // last 20 diagnostic events
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!pc || !enabled) return;

    // Reset view state when switching to a new peer connection so stale
    // data from a previous peer doesn't linger in the panel.
    setStats(null);
    setHistory([]);
    setDiagEvents([]);

    const unsubStats = pc.on('stats', (snap) => {
      if (!mountedRef.current) return;
      setStats(snap);
      if (snap.roundTripTimeMs != null) {
        setHistory((prev) => [...prev.slice(-29), { ts: snap.timestamp, rtt: snap.roundTripTimeMs }]);
      }
    });

    const unsubDiag = pc.on('diagnostic', (evt) => {
      if (!mountedRef.current) return;
      setDiagEvents((prev) => [{ ...evt, ts: Date.now() }, ...prev.slice(0, 19)]);
    });

    return () => {
      mountedRef.current = false;
      unsubStats();
      unsubDiag();
    };
  }, [pc, enabled]);

  /** Force a one-off stats snapshot (e.g. on manual refresh) without waiting for the next tick. */
  const refresh = useCallback(async () => {
    if (!pc) return;
    const snap = await pc.getDiagnostics();
    if (snap && mountedRef.current) setStats(snap);
  }, [pc]);

  return { stats, history, diagEvents, refresh };
}
