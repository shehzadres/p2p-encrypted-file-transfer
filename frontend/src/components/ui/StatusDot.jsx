import { cn } from '@/lib/utils';

const COLORS = {
  idle:       'bg-muted',
  connecting: 'bg-warning',
  connected:  'bg-success',
  error:      'bg-danger',
};

/**
 * StatusDot — status indicator with a soft radar ping while live.
 */
export function StatusDot({ status = 'idle', className, size = 'md' }) {
  const sz   = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const live = status === 'connecting' || status === 'connected';
  const tone = COLORS[status] ?? COLORS.idle;

  return (
    <span
      className={cn('relative inline-flex shrink-0', sz, className)}
      role="status"
      aria-label={status}
    >
      {live && (
        <span aria-hidden className={cn('absolute inset-0 rounded-full animate-ping-soft', tone)} />
      )}
      <span className={cn('relative inline-block rounded-full', sz, tone)} />
    </span>
  );
}
