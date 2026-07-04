import { cn } from '@/lib/utils';

const STATES = {
  idle:       'bg-muted',
  connecting: 'bg-warning animate-pulse-dot',
  connected:  'bg-success animate-pulse-dot',
  error:      'bg-danger',
};

export function StatusDot({ status = 'idle', className, size = 'md' }) {
  const sz = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  return (
    <span
      className={cn('inline-block rounded-full shrink-0', sz, STATES[status], className)}
      role="status"
      aria-label={status}
    />
  );
}
