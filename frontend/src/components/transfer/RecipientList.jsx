import { Users, Wifi, WifiOff, ShieldCheck } from 'lucide-react';
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-accent" />
          <h2 className="font-medium text-text text-sm">Recipients</h2>
        </div>
        <span className="text-xs text-muted">
          {peerCount} / {recipientMax} connected
        </span>
      </div>

      {peerCount === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted py-2">
          <WifiOff size={12} />
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
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted">
            {recipientMax - peerCount} slot{recipientMax - peerCount !== 1 ? 's' : ''} remaining
          </p>
          <div className="flex gap-1.5 mt-2">
            {[...Array(recipientMax)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i < peerCount ? 'bg-success' : 'bg-border',
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
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-surface border border-border">
      <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent shrink-0">
        {index}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {peer.keyExchangeDone
            ? <StatusDot status="connected" />
            : <StatusDot status="connecting" />}
          <span className="text-xs text-text font-medium">
            {peer.keyExchangeDone ? 'Recipient ' + index : 'Connecting…'}
          </span>
          {peer.keyExchangeDone && (
            <ShieldCheck size={10} className="text-success" title="Encrypted" />
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
