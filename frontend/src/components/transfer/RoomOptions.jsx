import { useState } from 'react';
import { Clock, Users, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * RoomOptions — collapsible panel for configuring room properties
 * before creation (expiry, max recipients, self-destruct).
 */
export function RoomOptions({ value, onChange }) {
  const [open, setOpen] = useState(false);

  const { expiryTier, maxPeers, selfDestruct } = value;

  const set = (patch) => onChange({ ...value, ...patch });

  const EXPIRY_OPTS = [
    { id: 'hour',  label: '1 hour'   },
    { id: 'day',   label: '24 hours' },
    { id: 'week',  label: '7 days'   },
    { id: 'never', label: 'Never'    },
  ];

  const PEER_OPTS = [
    { id: 1,  label: '1 recipient'  },
    { id: 5,  label: '5 recipients' },
    { id: 9,  label: '9 recipients' },
  ];

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted hover:text-text hover:bg-surface/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock size={13} className="text-accent" />
          Advanced options
          {selfDestruct && (
            <span className="ml-1 text-xs text-danger font-medium">· Self-destruct on</span>
          )}
          {!selfDestruct && expiryTier !== 'day' && (
            <span className="ml-1 text-xs text-muted">· {EXPIRY_OPTS.find(o => o.id === expiryTier)?.label}</span>
          )}
        </span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-surface/30 animate-fade-in">

          {/* Expiry */}
          <div>
            <p className="text-xs text-muted font-medium mb-2 flex items-center gap-1.5">
              <Clock size={11} /> Link expires after
            </p>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_OPTS.map((o) => (
                <OptionChip
                  key={o.id}
                  label={o.label}
                  active={!selfDestruct && expiryTier === o.id}
                  disabled={selfDestruct}
                  onClick={() => set({ expiryTier: o.id, selfDestruct: false })}
                />
              ))}
            </div>
          </div>

          {/* Max recipients */}
          <div>
            <p className="text-xs text-muted font-medium mb-2 flex items-center gap-1.5">
              <Users size={11} /> Max recipients
            </p>
            <div className="flex flex-wrap gap-2">
              {PEER_OPTS.map((o) => (
                <OptionChip
                  key={o.id}
                  label={o.label}
                  active={!selfDestruct && maxPeers === o.id}
                  disabled={selfDestruct}
                  onClick={() => set({ maxPeers: o.id, selfDestruct: false })}
                />
              ))}
            </div>
          </div>

          {/* Self-destruct */}
          <div>
            <p className="text-xs text-muted font-medium mb-2 flex items-center gap-1.5">
              <Flame size={11} className="text-danger" /> Self-destruct
            </p>
            <button
              type="button"
              onClick={() => set({
                selfDestruct: !selfDestruct,
                expiryTier:   !selfDestruct ? 'hour' : 'day',
                maxPeers:     !selfDestruct ? 1      : maxPeers,
              })}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                selfDestruct
                  ? 'bg-danger/15 border-danger/40 text-danger'
                  : 'bg-surface border-border text-muted hover:border-border-bright hover:text-text',
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                selfDestruct ? 'border-danger bg-danger' : 'border-border',
              )}>
                {selfDestruct && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              {selfDestruct ? 'On — link expires after first transfer' : 'Off — link stays active'}
            </button>
            {selfDestruct && (
              <p className="text-xs text-muted mt-2 leading-relaxed">
                Room closes permanently after the recipient receives all files.
                Link expires in 1 hour if unused.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionChip({ label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
        active
          ? 'bg-accent/15 border-accent/40 text-accent'
          : 'bg-surface border-border text-muted hover:border-border-bright hover:text-text',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {label}
    </button>
  );
}
