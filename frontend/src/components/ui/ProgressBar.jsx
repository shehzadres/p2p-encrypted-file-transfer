import { cn } from '@/lib/utils';

const VARIANTS = {
  accent:  'bg-gradient-to-r from-accent to-accent-light',
  success: 'bg-gradient-to-r from-success to-emerald-400',
  warning: 'bg-gradient-to-r from-warning to-yellow-400',
  danger:  'bg-gradient-to-r from-danger  to-red-400',
  teal:    'bg-gradient-to-r from-teal    to-cyan-400',
};

export function ProgressBar({ value = 0, variant = 'accent', className, animated, indeterminate }) {
  const clamped   = Math.min(100, Math.max(0, value ?? 0));
  const isDone    = clamped >= 100;
  const showPulse = animated !== false && !isDone && clamped > 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Transfer progress"
      className={cn('w-full bg-border/60 rounded-full overflow-hidden h-1.5 relative', className)}
    >
      {indeterminate ? (
        <div
          className={cn('absolute inset-y-0 w-1/2 rounded-full', VARIANTS[variant])}
          style={{ animation: 'progressIndeterminate 1.5s ease-in-out infinite' }}
        />
      ) : (
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden',
            VARIANTS[variant] ?? VARIANTS.accent,
          )}
          style={{ width: `${clamped}%` }}
        >
          {showPulse && (
            <div className="absolute inset-0 shimmer" aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}
