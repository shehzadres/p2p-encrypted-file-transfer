import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ConnectionStepper — glass progress stepper that visualises where the
 * session is in the connect → handshake → transfer lifecycle.
 *
 * @param {number} phase - index of the currently active step
 * @param {Array}  steps - [{ label, hint }]
 */
export function ConnectionStepper({ phase, steps, className }) {
  const last = steps.length - 1;

  return (
    <ol
      className={cn('glass rounded-2xl px-3 sm:px-6 py-4 flex items-start', className)}
      aria-label="Connection progress"
    >
      {steps.map((s, i) => {
        const done   = i < phase;
        const active = i === phase;
        return (
          <li
            key={s.label}
            aria-current={active ? 'step' : undefined}
            className="relative flex-1 flex flex-col items-center text-center min-w-0"
          >
            {/* connector to next node */}
            {i < last && (
              <span
                aria-hidden
                className="absolute top-4 left-1/2 w-full h-px -translate-y-1/2 bg-[var(--line)]"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-teal
                             transition-[width] duration-700 ease-spring"
                  style={{ width: done ? '100%' : '0%' }}
                />
              </span>
            )}

            {/* node */}
            <span className="relative z-10 w-8 h-8 flex items-center justify-center">
              {active && (
                <span aria-hidden className="absolute inset-0 rounded-full bg-accent/40 animate-ping-soft" />
              )}
              <span
                className={cn(
                  'relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold',
                  'transition-all duration-500 ease-spring border',
                  done   && 'bg-gradient-to-br from-accent to-teal text-white border-transparent shadow-glow-sm',
                  active && 'bg-accent/20 text-accent-light border-accent/60 shadow-glow-sm',
                  !done && !active && 'bg-[var(--fill-1)] text-muted border-[var(--line)]',
                )}
              >
                {done ? <Check size={14} strokeWidth={3} aria-hidden /> : i + 1}
              </span>
            </span>

            <span
              className={cn(
                'mt-2 text-xs font-semibold tracking-tight transition-colors duration-300',
                active || done ? 'text-bright' : 'text-muted',
              )}
            >
              {s.label}
            </span>
            {s.hint && (
              <span className="hidden sm:block mt-0.5 text-2xs text-muted leading-snug px-1">
                {s.hint}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
