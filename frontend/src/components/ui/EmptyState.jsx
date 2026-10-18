import { cn } from '@/lib/utils';

/**
 * EmptyState — glass icon tile with optional action.
 * `icon` can be any React node (a lucide icon is recommended).
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  size = 'md',
}) {
  const isLg = size === 'lg';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-4',
        isLg ? 'py-16' : 'py-10',
        className,
      )}
      role="status"
    >
      {icon && (
        <div className="relative mb-5">
          <div aria-hidden className="absolute inset-0 rounded-2xl bg-accent/30 blur-xl opacity-60" />
          <div className={cn(
            'glass-raised relative rounded-2xl flex items-center justify-center text-accent-light',
            isLg ? 'w-16 h-16' : 'w-14 h-14',
          )}>
            {icon}
          </div>
        </div>
      )}
      <p className={cn(
        'font-semibold text-bright mb-1.5 tracking-tight',
        isLg ? 'text-base' : 'text-sm',
      )}>
        {title}
      </p>
      {body && (
        <p className={cn(
          'text-muted leading-relaxed max-w-xs',
          isLg ? 'text-sm' : 'text-xs',
        )}>
          {body}
        </p>
      )}
      {action && (
        <div className="mt-5">{action}</div>
      )}
    </div>
  );
}
