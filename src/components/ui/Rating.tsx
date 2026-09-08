import { Star } from 'lucide-react';

export function Rating({
  value,
  reviewsCount,
  size = 14,
}: {
  value: number;
  reviewsCount?: number;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <Star size={size} className="fill-amber-400 text-amber-400" />
      <span className="text-sm font-medium text-ink dark:text-ink-dark">{value.toFixed(1)}</span>
      {typeof reviewsCount === 'number' && (
        <span className="text-sm text-ink-soft dark:text-ink-darksoft">({reviewsCount})</span>
      )}
    </div>
  );
}
