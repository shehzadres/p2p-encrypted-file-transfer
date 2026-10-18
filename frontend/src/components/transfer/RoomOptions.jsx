import { useState, useId } from 'react';
import { Clock, Users, Flame, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';

const EXPIRY_OPTS = [
  { id: 'hour',  label: '1 hour'   },
  { id: 'day',   label: '24 hours' },
  { id: 'week',  label: '7 days'   },
  { id: 'never', label: 'Never'    },
];

const PEER_OPTS = [
  { id: 1, label: '1'  },
  { id: 5, label: '5'  },
  { id: 9, label: '9'  },
];

/**
 * RoomOptions — collapsible panel for configuring room properties
 * before creation (expiry, max recipients, self-destruct).
 */
export function RoomOptions({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const { expiryTier, maxPeers, selfDestruct } = value;
  const set = (patch) => onChange({ ...value, ...patch });

  const expiryLabel = EXPIRY_OPTS.find((o) => o.id === expiryTier)?.label;
  const summary = selfDestruct
    ? 'Self-destruct on'
    : `${expiryLabel} · ${maxPeers} recipient${maxPeers > 1 ? 's' : ''}`;

  return (
    <div className="well overflow-hidden text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-subtle
                   hover:text-bright hover:bg-[var(--fill-1)] transition-colors"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <SlidersHorizontal size={14} className="text-accent-light shrink-0" aria-hidden />
          <span className="font-medium whitespace-nowrap">Advanced options</span>
          <span className={cn(
            'text-xs truncate',
            selfDestruct ? 'text-danger font-medium' : 'text-muted',
          )}>
            · {summary}
          </span>
        </span>
        <ChevronDown
          size={15}
          aria-hidden
          className={cn('shrink-0 transition-transform duration-300 ease-spring', open && 'rotate-180')}
        />
      </button>

      {/* Animated expand: grid-rows 0fr → 1fr */}
      <div
        id={panelId}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-500 ease-spring',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="divider px-4 py-4 space-y-5" inert={open ? undefined : ''}>

            {/* Expiry */}
            <div>
              <p className="text-xs text-muted font-medium mb-2 flex items-center gap-1.5">
                <Clock size={12} aria-hidden /> Link expires after
              </p>
              <Segmented
                size="sm"
                label="Link expiry"
                value={selfDestruct ? null : expiryTier}
                options={EXPIRY_OPTS.map((o) => ({ ...o, disabled: selfDestruct }))}
                onChange={(id) => set({ expiryTier: id, selfDestruct: false })}
                className={cn(selfDestruct && 'opacity-50')}
              />
            </div>

            {/* Max recipients */}
            <div>
              <p className="text-xs text-muted font-medium mb-2 flex items-center gap-1.5">
                <Users size={12} aria-hidden /> Max recipients
              </p>
              <Segmented
                size="sm"
                label="Maximum recipients"
                value={selfDestruct ? null : maxPeers}
                options={PEER_OPTS.map((o) => ({ ...o, disabled: selfDestruct }))}
                onChange={(id) => set({ maxPeers: id, selfDestruct: false })}
                className={cn(selfDestruct && 'opacity-50')}
              />
            </div>

            {/* Self-destruct */}
            <div className={cn(
              'flex items-center justify-between gap-4 rounded-xl px-3.5 py-3 border transition-colors duration-300',
              selfDestruct
                ? 'bg-danger/10 border-danger/30'
                : 'bg-[var(--fill-1)] border-[var(--line)]',
            )}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text flex items-center gap-2">
                  <Flame size={14} className="text-danger" aria-hidden />
                  Self-destruct
                </p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  {selfDestruct
                    ? 'Room closes after the recipient receives all files. Expires in 1 hour if unused.'
                    : 'One-time link that closes after the first transfer.'}
                </p>
              </div>
              <Switch
                tone="danger"
                label="Self-destruct"
                checked={selfDestruct}
                onChange={(on) => set({
                  selfDestruct: on,
                  expiryTier:   on ? 'hour' : 'day',
                  maxPeers:     on ? 1      : maxPeers,
                })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
