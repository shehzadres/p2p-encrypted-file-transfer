import { cn } from '@/lib/utils';

const VARIANTS = {
  accent:  'bg-gradient-to-r from-accent-dim via-accent to-teal shadow-[0_0_14px_rgb(var(--c-accent)/0.55)]',
  success: 'bg-gradient-to-r from-success-dim via-success to-teal shadow-[0_0_14px_rgb(var(--c-success)/0.5)]',
  warning: 'bg-gradient-to-r from-warning to-rose shadow-[0_0_14px_rgb(var(--c-warning)/0.5)]',
  danger:  'bg-gradient-to-r from-danger-dim to-danger shadow-[0_0_14px_rgb(var(--c-danger)/0.5)]',
  teal:    'bg-gradient-to-r from-teal-dim to-teal shadow-[0_0_14px_rgb(var(--c-teal)/0.5)]',
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
      className={cn(
        'w-full rounded-full overflow-hidden h-1.5 relative',
        'bg-[var(--fill-2)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]',
        className,
      )}
    >
      {indeterminate ? (
        <div
          className={cn('absolute inset-y-0 w-1/2 rounded-full', VARIANTS[variant] ?? VARIANTS.accent)}
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
          {/* top gloss */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-white/25 rounded-full" aria-hidden />
          {showPulse && (
            <div className="absolute inset-0 shimmer" aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}
