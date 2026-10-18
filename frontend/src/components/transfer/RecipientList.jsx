import { Users, WifiOff, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusDot } from '@/components/ui/StatusDot';
import { formatSpeed } from '@/lib/utils';

/**
 * RecipientList — shows all connected peers with per-peer transfer state.
 * Used in the sidebar when maxPeers > 2 (multi-recipient mode).
 *
 * @param {Array}   peers         - Array of { peerId, keyExchangeDone }
 * @param {Array}   transfers     - All active transfers from store
 * @param {number}  peerCount     - Connected peer count
 * @param {number}  maxPeers      - Room max peers (- 1 for recipients)
 */
export function RecipientList({ peers, transfers, peerCount, maxPeers }) {
  const recipientMax = Math.max(1, maxPeers - 1);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent-muted border border-accent/30 flex items-center justify-center text-accent-light">
            <Users size={15} aria-hidden />
          </div>
          <h2 className="font-semibold text-bright text-sm tracking-tight">Recipients</h2>
        </div>
        <span className="badge badge-muted tabular">
          {peerCount} / {recipientMax}
          <span className="sr-only"> connected</span>
        </span>
      </div>

      {peerCount === 0 ? (
        <div className="well flex items-center gap-2.5 text-xs text-muted px-3.5 py-3">
          <WifiOff size={13} aria-hidden />
          Waiting for recipients to join…
        </div>
      ) : (
        <div className="space-y-2">
          {peers.map((peer, i) => (
            <PeerRow
              key={peer.peerId}
              index={i + 1}
              peer={peer}
              transfers={transfers.filter((t) =>
                t.peerId === peer.peerId && t.direction === 'send'
              )}
            />
          ))}
        </div>
      )}

      {/* Slot indicators for remaining capacity */}
      {peerCount < recipientMax && (
        <div className="mt-4 pt-4 divider">
          <p className="text-xs text-muted">
            {recipientMax - peerCount} slot{recipientMax - peerCount !== 1 ? 's' : ''} remaining
          </p>
          <div className="flex gap-1.5 mt-2.5" aria-hidden>
            {[...Array(recipientMax)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-all duration-500',
                  i < peerCount
                    ? 'bg-gradient-to-r from-success to-teal shadow-[0_0_10px_rgb(var(--c-success)/0.5)]'
                    : 'bg-[var(--fill-2)]',
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PeerRow({ index, peer, transfers }) {
  const active = transfers.filter((t) => t.status === 'transferring');
  const done   = transfers.filter((t) => t.status === 'complete');
  const aggSpeed = active.reduce((s, t) => s + (t.speed || 0), 0);

  return (
    <div className="well flex items-center gap-3 px-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-teal flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-glow-sm">
        {index}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {peer.keyExchangeDone
            ? <StatusDot status="connected" size="sm" />
            : <StatusDot status="connecting" size="sm" />}
          <span className="text-xs text-text font-medium">
            {peer.keyExchangeDone ? 'Recipient ' + index : 'Connecting…'}
          </span>
          {peer.keyExchangeDone && (
            <ShieldCheck size={12} className="text-success" title="Encrypted" />
          )}
        </div>
        {active.length > 0 && (
          <p className="text-xs text-muted mt-0.5">
            {active.length} transferring
            {aggSpeed > 0 && ` · ${formatSpeed(aggSpeed)}`}
          </p>
        )}
        {done.length > 0 && active.length === 0 && (
          <p className="text-xs text-success mt-0.5">{done.length} file{done.length > 1 ? 's' : ''} delivered</p>
        )}
      </div>
    </div>
  );
}
