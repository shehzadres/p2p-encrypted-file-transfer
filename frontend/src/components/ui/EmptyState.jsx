import { cn } from '@/lib/utils';

/**
 * EmptyState — illustrated empty states with optional action.
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
        <div className={cn(
          'rounded-2xl bg-border/60 border border-border flex items-center justify-center mb-4',
          isLg ? 'w-16 h-16 text-2xl' : 'w-12 h-12 text-xl',
        )}>
          {icon}
        </div>
      )}
      <p className={cn(
        'font-semibold text-text mb-1.5',
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
