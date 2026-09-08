export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-ink/[0.06] dark:bg-white/[0.07] ${className}`}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line p-3 dark:border-line-dark">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-3.5 w-1/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
