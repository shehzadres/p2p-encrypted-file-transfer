import { Zap, Files, CheckCircle, Clock } from 'lucide-react';
import { formatBytes, formatSpeed, formatETA } from '@/lib/utils';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  useAppStore,
  selectActiveTransfers,
  selectTotalProgress,
  selectAggregateSpeed,
} from '@/store/appStore';

/**
 * TransferSummary — aggregate stats bar shown above the transfer list
 * when multiple transfers are in progress.
 */
export function TransferSummary() {
  const { state } = useAppStore();
  const active    = selectActiveTransfers(state);
  const totalPct  = selectTotalProgress(state);
  const aggSpeed  = selectAggregateSpeed(state);

  if (state.transfers.length === 0) return null;

  const done   = state.transfers.filter((t) => t.status === 'complete').length;
  const failed = state.transfers.filter((t) => ['error', 'cancelled'].includes(t.status)).length;
  const total  = state.transfers.length;

  const totalBytes    = state.transfers.reduce((a, t) => a + (t.size || 0), 0);
  const transferredBytes = state.transfers.reduce((a, t) => a + (t.sent || 0), 0);

  const eta = aggSpeed > 0
    ? (totalBytes - transferredBytes) / aggSpeed
    : Infinity;

  return (
    <div className="card mb-2">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Files size={14} className="text-accent" />
          <span className="text-sm font-medium text-text">
            {active.length > 0
              ? `${active.length} active · ${done} done`
              : `${done} of ${total} complete${failed > 0 ? ` · ${failed} failed` : ''}`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {aggSpeed > 0 && (
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-accent" />
              {formatSpeed(aggSpeed)}
            </span>
          )}
          {aggSpeed > 0 && isFinite(eta) && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatETA(eta)}
            </span>
          )}
          {totalBytes > 0 && (
            <span>
              {formatBytes(transferredBytes)} / {formatBytes(totalBytes)}
            </span>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      {active.length > 0 && (
        <div className="space-y-1">
          <ProgressBar value={totalPct} variant="accent" className="h-2" />
          <p className="text-xs text-muted text-right">{totalPct.toFixed(1)}%</p>
        </div>
      )}

      {/* Session stats */}
      {active.length === 0 && (
        <div className="flex items-center gap-4 text-xs text-muted pt-1 border-t border-border">
          <span className="flex items-center gap-1">
            <CheckCircle size={10} className="text-success" />
            {state.sessionStats.filesCompleted} completed
          </span>
          {state.sessionStats.totalBytesSent > 0 && (
            <span>↑ {formatBytes(state.sessionStats.totalBytesSent)} sent</span>
          )}
          {state.sessionStats.totalBytesReceived > 0 && (
            <span>↓ {formatBytes(state.sessionStats.totalBytesReceived)} received</span>
          )}
        </div>
      )}
    </div>
  );
}
