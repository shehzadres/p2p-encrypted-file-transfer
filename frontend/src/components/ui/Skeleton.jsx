import { cn } from '@/lib/utils';

/**
 * Skeleton — shimmer placeholder for loading states.
 */
export function Skeleton({ className, rounded = 'rounded-xl' }) {
  return (
    <div
      aria-hidden
      className={cn('relative overflow-hidden bg-border/60 shimmer', rounded, className)}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-5 space-y-3" aria-label="Loading…" aria-busy>
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 shrink-0" rounded="rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/5" rounded="rounded-md" />
          <Skeleton className="h-2.5 w-2/5" rounded="rounded-md" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full" rounded="rounded-full" />
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="space-y-2" aria-label="Loading transfers…" aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
