import { Pause, Play, X, CheckCircle2, AlertCircle, Clock, Zap, RotateCcw,
         ArrowUp, ArrowDown, Trophy } from 'lucide-react';
import { cn, formatBytes, formatSpeed, formatETA } from '@/lib/utils';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';

const STATUS = {
  queued:       { label: 'Queued',        color: 'text-muted',          bar: 'accent',   ring: '' },
  transferring: { label: 'Transferring',  color: 'text-accent-light',   bar: 'accent',   ring: 'ring-accent/20' },
  paused:       { label: 'Paused',        color: 'text-warning',        bar: 'warning',  ring: 'ring-warning/20' },
  complete:     { label: 'Complete',      color: 'text-success',        bar: 'success',  ring: 'ring-success/20' },
  error:        { label: 'Failed',        color: 'text-danger',         bar: 'danger',   ring: 'ring-danger/20' },
  cancelled:    { label: 'Cancelled',     color: 'text-muted',          bar: 'accent',   ring: '' },
};

export function TransferItem({ transfer, onPause, onResume, onCancel, onRetry, onDismiss }) {
  const {
    id, name, size, type, status,
    percent = 0, speed = 0, peakSpeed = 0, eta,
    direction, sent = 0, stalled, errorMessage,
    startedAt, completedAt,
  } = transfer;

  const cfg      = STATUS[status] ?? STATUS.queued;
  const isActive = status === 'transferring';
  const isPaused = status === 'paused';
  const isQueued = status === 'queued';
  const isError  = status === 'error';
  const isDone   = ['complete','error','cancelled'].includes(status);
  const isOk     = status === 'complete';

  const elapsed  = startedAt && completedAt ? ((completedAt - startedAt) / 1000) : null;
  const avgSpeed = elapsed && sent > 0 ? sent / elapsed : null;

  return (
    <div
      className={cn(
        'glass rounded-2xl p-4 transition-all duration-300',
        'ring-1 ring-transparent',
        isActive && !stalled && 'border-accent/25 ring-accent/10',
        isPaused  && 'border-warning/25 ring-warning/10',
        isOk      && 'border-success/20 ring-success/10',
        isError   && 'border-danger/20  ring-danger/10',
        stalled && isActive && 'border-warning/40 ring-warning/20',
        isOk && 'animate-fade-in',
      )}
      role="listitem"
      aria-label={`${name} — ${status}`}
    >
      <div className="flex items-start gap-3.5">
        {/* File type icon */}
        <div className={cn(
          'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-300',
          isActive && !stalled && 'bg-accent-muted border-accent/25',
          isOk     && 'bg-success-muted border-success/25',
          isError  && 'bg-danger-muted  border-danger/25',
          isPaused && 'bg-warning-muted border-warning/25',
          isQueued && 'bg-surface border-border',
          !isActive && !isOk && !isError && !isPaused && !isQueued && 'bg-surface border-border',
        )}>
          <FileTypeIcon mimeType={type} name={name} size={16} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name + status */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-medium text-text leading-snug truncate" title={name}>
              {name}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {stalled && isActive && (
                <span className="text-2xs text-warning font-semibold uppercase tracking-wide animate-pulse">
                  Stalled
                </span>
              )}
              <span className={cn('text-2xs font-semibold uppercase tracking-wide', cfg.color)}>
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2.5 text-xs text-muted mb-2.5 flex-wrap tabular">
            <span>{formatBytes(size)}</span>

            {direction === 'receive'
              ? <span className="flex items-center gap-1 text-teal font-medium">
                  <ArrowDown size={10} />Receiving
                </span>
              : <span className="flex items-center gap-1 text-accent-light font-medium">
                  <ArrowUp size={10} />Sending
                </span>}

            {isActive && speed > 0 && (<>
              <Dot />
              <span className="flex items-center gap-1">
                <Zap size={10} className="text-accent" />
                {formatSpeed(speed)}
              </span>
              <Dot />
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {formatETA(eta)}
              </span>
            </>)}

            {isPaused && sent > 0 && (<>
              <Dot />
              <span>{formatBytes(sent)} / {formatBytes(size)}</span>
            </>)}

            {isOk && elapsed && (<>
              <Dot />
              <span>{elapsed.toFixed(1)}s</span>
              {avgSpeed && (<>
                <Dot />
                <span>{formatSpeed(avgSpeed)} avg</span>
              </>)}
            </>)}

            {isOk && peakSpeed > 0 && (<>
              <Dot />
              <span className="flex items-center gap-1 text-accent/70">
                <Trophy size={10} />
                {formatSpeed(peakSpeed)} peak
              </span>
            </>)}
          </div>

          {/* Progress */}
          {!isDone && (
            <div className="space-y-1.5">
              <ProgressBar
                value={percent}
                variant={stalled ? 'warning' : cfg.bar}
                className="h-1.5"
                animated
              />
              {(isActive || isPaused) && size > 0 && (
                <div className="flex justify-between text-2xs text-muted tabular">
                  <span>{formatBytes(sent)} of {formatBytes(size)}</span>
                  <span>{percent.toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Terminal state messages */}
          {isOk && (
            <div className="flex items-center gap-1.5 text-xs text-success mt-1 font-medium">
              <CheckCircle2 size={13} />
              {direction === 'receive' ? 'Saved to Downloads' : 'Delivered successfully'}
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-1.5 text-xs text-danger mt-1" title={errorMessage ?? ''}>
              <AlertCircle size={13} />
              <span className="truncate">{errorMessage || 'Transfer failed'}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0 -mr-1">
          {isActive && (
            <IconBtn onClick={() => onPause?.(id)} label="Pause" icon={<Pause size={13} />} />
          )}
          {isPaused && (
            <IconBtn onClick={() => onResume?.(id)} label="Resume" icon={<Play size={13} />} variant="accent" />
          )}
          {isError && onRetry && (
            <IconBtn onClick={() => onRetry?.(id)} label="Retry" icon={<RotateCcw size={13} />} variant="accent" />
          )}
          {(isActive || isPaused || isQueued) && (
            <IconBtn onClick={() => onCancel?.(id)} label="Cancel" icon={<X size={13} />} variant="danger" />
          )}
          {isDone && onDismiss && (
            <IconBtn onClick={() => onDismiss?.(id)} label="Dismiss" icon={<X size={13} />} />
          )}
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="text-border" aria-hidden>·</span>;
}

function IconBtn({ onClick, label, icon, variant }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center text-muted transition-all duration-150',
        'hover:scale-110 active:scale-95',
        variant === 'danger'  && 'hover:bg-danger-muted  hover:text-danger',
        variant === 'accent'  && 'hover:bg-accent-muted  hover:text-accent-light',
        !variant              && 'hover:bg-border         hover:text-text',
      )}
    >
      {icon}
    </button>
  );
}
