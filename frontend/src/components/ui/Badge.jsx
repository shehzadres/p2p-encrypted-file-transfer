import { cn } from '@/lib/utils';

const VARIANTS = {
  accent:  'badge-accent',
  success: 'badge-success',
  warning: 'badge-warning',
  danger:  'badge-danger',
  muted:   'badge-muted',
};

export function Badge({ children, variant = 'muted', className }) {
  return (
    <span className={cn(VARIANTS[variant] ?? VARIANTS.muted, className)}>
      {children}
    </span>
  );
}
