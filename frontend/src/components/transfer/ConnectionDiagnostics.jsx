import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Wifi, Clock, Shield, AlertTriangle, RotateCcw } from 'lucide-react';
import { useConnectionDiagnostics } from '@/hooks/useConnectionDiagnostics';
import { formatBytes, formatSpeed, cn } from '@/lib/utils';
import { classifyRTT, classifyLoss } from '@/lib/browserCompat';

export function ConnectionDiagnostics({ pc, connectionStatus, hasTurn }) {
  const [expanded, setExpanded] = useState(false);
  const isConnected = connectionStatus === 'connected';

  const { stats, history, diagEvents } = useConnectionDiagnostics(pc, {
    enabled: !!pc && isConnected,
  });

  const qualityScore = stats?.qualityScore ?? null;
  const rttClass     = classifyRTT(stats?.roundTripTimeMs);
  const lossClass    = classifyLoss(stats?.packetLossPct);
  const isRelay      = stats?.connectionType?.includes('relay');
  const isDegraded   = qualityScore != null && qualityScore < 50;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className={cn(
            'transition-colors',
            isDegraded   ? 'text-warning' :
            isConnected  ? 'text-success'  : 'text-muted',
          )} />
          <span className="text-sm font-medium text-text">Diagnostics</span>
          {isRelay && (
            <span className="text-xs text-warning font-medium">TURN</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {qualityScore != null && (
            <QualityBadge score={qualityScore} />
          )}
          {stats?.roundTripTimeMs != null && (
            <span className={cn('text-xs font-mono', rttColor(rttClass))}>
              {stats.roundTripTimeMs}ms
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-muted" />
                    : <ChevronDown size={14} className="text-muted" />}
        </div>
      </button>

      {/* Summary row */}
      {isConnected && stats && (
        <div className="mt-3 flex items-center gap-3 flex-wrap text-xs">
          <StatPill icon={<Wifi size={10} />}
            label={stats.connectionType ?? 'detecting…'}
            color={connTypeColor(stats.connectionType)} />
          {stats.roundTripTimeMs != null && (
            <StatPill icon={<Clock size={10} />}
              label={`${stats.roundTripTimeMs}ms RTT`}
              color={rttColor(rttClass)} />
          )}
          {stats.packetLossPct != null && stats.packetLossPct > 0 && (
            <StatPill icon={<AlertTriangle size={10} />}
              label={`${stats.packetLossPct}% loss`}
              color={lossColor(lossClass)} />
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {!stats && (
            <p className="text-muted text-xs">
              {isConnected ? 'Collecting stats…' : 'Connect a peer to see diagnostics.'}
            </p>
          )}

          {stats && (
            <>
              {/* Core metrics */}
              <div className="grid grid-cols-2 gap-2">
                <DiagRow label="Type"     value={stats.connectionType ?? '—'} />
                <DiagRow label="RTT"      value={stats.roundTripTimeMs != null ? `${stats.roundTripTimeMs} ms` : '—'} />
                <DiagRow label="Loss"     value={stats.packetLossPct  != null ? `${stats.packetLossPct}%`      : '—'} />
                <DiagRow label="Jitter"   value={stats.jitterMs       != null ? `${stats.jitterMs} ms`         : '—'} />
                <DiagRow label="Local"    value={stats.localCandidateType  ?? '—'} />
                <DiagRow label="Remote"   value={stats.remoteCandidateType ?? '—'} />
                {stats.networkType && (
                  <DiagRow label="Network" value={stats.networkType} />
                )}
                <DiagRow label="DTLS"     value={stats.transport.dtlsState ?? '—'} />
                {stats.availableOutboundBandwidthBps != null && (
                  <DiagRow label="Bandwidth"
                    value={formatSpeed(stats.availableOutboundBandwidthBps)} />
                )}
                {stats.localCandidateAddress && (
                  <DiagRow label="Local IP"  value={stats.localCandidateAddress} />
                )}
              </div>

              {/* DataChannel */}
              <div>
                <p className="text-xs text-muted uppercase tracking-wider mb-2 font-medium">
                  DataChannel
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <DiagRow label="Sent"     value={formatBytes(stats.dataChannel.bytesSent)}     />
                  <DiagRow label="Received" value={formatBytes(stats.dataChannel.bytesReceived)} />
                  {stats.dataChannel.sendRateBps != null && (
                    <DiagRow label="↑ Rate" value={formatSpeed(stats.dataChannel.sendRateBps)} />
                  )}
                  {stats.dataChannel.recvRateBps != null && (
                    <DiagRow label="↓ Rate" value={formatSpeed(stats.dataChannel.recvRateBps)} />
                  )}
                </div>
              </div>

              {/* TURN info */}
              {hasTurn !== undefined && (
                <div className="flex items-center gap-2 text-xs">
                  <Shield size={11} className={hasTurn ? 'text-success' : 'text-muted'} />
                  <span className="text-muted">
                    TURN: {hasTurn ? 'available' : 'not configured'}
                  </span>
                  {isRelay && (
                    <span className="text-warning font-medium ml-1">· currently in use</span>
                  )}
                </div>
              )}

              {/* RTT sparkline */}
              {history.length >= 2 && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider mb-2 font-medium">
                    RTT History
                  </p>
                  <RTTSparkline history={history} />
                </div>
              )}
            </>
          )}

          {/* Recent events */}
          {diagEvents.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-2 font-medium">Events</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {diagEvents.slice(0, 10).map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted font-mono w-[52px] shrink-0 tabular-nums">
                      {new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={cn(
                      'truncate',
                      e.type?.includes('restart') ? 'text-warning' :
                      e.type?.includes('relay')   ? 'text-danger'  : 'text-subtle',
                    )}>
                      {formatDiagEvent(e)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function QualityBadge({ score }) {
  const { label, color } = score >= 80 ? { label: 'Excellent', color: 'text-success' }
    : score >= 60 ? { label: 'Good',    color: 'text-accent'  }
    : score >= 40 ? { label: 'Fair',    color: 'text-warning' }
    :               { label: 'Poor',    color: 'text-danger'  };
  return <span className={cn('text-xs font-medium', color)}>{label}</span>;
}

function StatPill({ icon, label, color = 'text-muted' }) {
  return (
    <span className={cn('flex items-center gap-1', color)}>{icon}{label}</span>
  );
}

function DiagRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted text-xs">{label}</span>
      <span className="text-subtle text-xs font-mono font-medium truncate" title={value}>{value}</span>
    </div>
  );
}

function RTTSparkline({ history }) {
  const W = 200, H = 40, PAD = 4;
  const vals = history.map((p) => p.rtt);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals, 1);
  const rng  = max - min || 1;
  const pts  = history.map((p, i) => {
    const x = PAD + (i / (history.length - 1)) * (W - PAD * 2);
    const y = PAD + ((max - p.rtt) / rng) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" aria-hidden>
      <polyline points={pts} fill="none" stroke="#6c63ff"
        strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDiagEvent(e) {
  if (e.type === 'ice-restart')          return `ICE restart #${e.attempt}`;
  if (e.type === 'ice-restart-scheduled')return `ICE restart in ${(e.delay/1000).toFixed(1)}s`;
  if (e.type === 'relay-escalation')     return 'Escalating to TURN relay';
  if (e.type === 'visibility-recovery')  return 'Tab refocused — checking connection';
  if (e.type === 'ice-gather-timeout')   return 'ICE gather timed out';
  if (e.state)                           return `${e.type}: ${e.state}`;
  return e.type;
}

function connTypeColor(t) {
  if (!t) return 'text-muted';
  if (t.includes('LAN') || t.includes('direct')) return 'text-success';
  if (t.includes('STUN'))  return 'text-accent';
  if (t.includes('relay')) return 'text-warning';
  return 'text-muted';
}

function rttColor(cls) {
  return cls === 'excellent' ? 'text-success'
       : cls === 'good'      ? 'text-accent'
       : cls === 'fair'      ? 'text-warning'
       : cls === 'poor'      ? 'text-danger'
       : 'text-muted';
}

function lossColor(cls) {
  return cls === 'excellent' ? 'text-success'
       : cls === 'good'      ? 'text-accent'
       : cls === 'fair'      ? 'text-warning'
       : 'text-danger';
}
