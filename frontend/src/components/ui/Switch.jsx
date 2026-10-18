import { cn } from '@/lib/utils';

/**
 * Switch — animated toggle (role="switch").
 * tone: 'accent' | 'danger'
 */
export function Switch({ checked, onChange, label, tone = 'accent', disabled, className, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 w-11 h-6 rounded-full border transition-all duration-300 ease-spring',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-void',
        checked
          ? tone === 'danger'
            ? 'bg-danger/85 border-danger/60 shadow-[0_0_18px_rgb(var(--c-danger)/0.45)]'
            : 'bg-accent/85 border-accent/60 shadow-[0_0_18px_rgb(var(--c-accent)/0.45)]'
          : 'bg-[var(--fill-2)] border-[var(--line-strong)]',
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md
                   transition-transform duration-300 ease-spring"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}
