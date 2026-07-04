import { cn } from '@/lib/utils';

const VARIANTS = {
  primary: 'btn-primary',
  ghost:   'btn-ghost',
  outline: 'btn-outline',
  danger:  'btn-danger',
};

const SIZES = {
  sm: 'h-8  px-3   text-xs  gap-1.5',
  md: 'h-9  px-4   text-sm  gap-2',
  lg: 'h-11 px-5   text-sm  gap-2',
  xl: 'h-12 px-6   text-base gap-2.5',
};

export function Button({
  children, variant = 'primary', size = 'md',
  className, loading, icon, ...props
}) {
  return (
    <button
      className={cn(VARIANTS[variant], SIZES[size], className)}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading
        ? <Spinner size={size === 'sm' ? 12 : 14} />
        : icon
          ? <span className="shrink-0">{icon}</span>
          : null}
      {children}
    </button>
  );
}

function Spinner({ size }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" fill="none"
      className="animate-spin shrink-0"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
