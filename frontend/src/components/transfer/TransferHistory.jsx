import { Clock, Trash2, ArrowUp, ArrowDown, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { cn, formatBytes, formatSpeed } from '@/lib/utils';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';

const STATUS_ICON = {
  complete:  <CheckCircle  size={12} className="text-success" />,
  error:     <AlertCircle size={12} className="text-danger"  />,
  cancelled: <XCircle     size={12} className="text-muted"   />,
};

/**
 * TransferHistory — collapsible panel showing past completed transfers.
 * Populated from appStore.history (survives room resets).
 */
export function TransferHistory() {
  const { state, actions } = useAppStore();

  const allDone = [
    ...state.transfers.filter((t) => ['complete', 'error', 'cancelled'].includes(t.status)),
    ...state.history,
  ];

  if (allDone.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-muted" />
          <h3 className="text-xs text-muted uppercase tracking-wider font-medium">
            History ({allDone.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={actions.clearCompleted} className="text-xs h-7 px-2">
            Clear active
          </Button>
          {state.history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={actions.clearHistory} className="text-xs h-7 px-2">
              <Trash2 size={11} />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {allDone.map((t) => (
          <HistoryRow key={t.id} transfer={t} />
        ))}
      </div>
    </div>
  );
}

function HistoryRow({ transfer: t }) {
  const elapsed = t.startedAt && t.completedAt
    ? ((t.completedAt - t.startedAt) / 1000)
    : null;
  const avgSpeed = elapsed && t.sent > 0 ? t.sent / elapsed : null;

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface border border-border/60',
      'hover:border-border transition-colors text-xs',
    )}>
      <div className="w-7 h-7 rounded-md bg-panel border border-border flex items-center justify-center shrink-0">
        <FileTypeIcon mimeType={t.type} name={t.name} size={13} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-text font-medium truncate text-xs">{t.name}</p>
        <div className="flex items-center gap-2 text-muted mt-0.5">
          <span>{formatBytes(t.size)}</span>
          {t.direction === 'receive'
            ? <span className="flex items-center gap-0.5 text-teal"><ArrowDown size={9} />Received</span>
            : <span className="flex items-center gap-0.5 text-accent"><ArrowUp   size={9} />Sent</span>}
          {avgSpeed && <span>avg {formatSpeed(avgSpeed)}</span>}
          {t.completedAt > 0 && (
            <span>{timeAgo(t.completedAt)}</span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        {STATUS_ICON[t.status] ?? null}
      </div>
    </div>
  );
}

function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60)   return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
