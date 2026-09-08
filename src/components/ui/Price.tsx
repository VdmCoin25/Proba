import { formatPrice, discountPercent } from '@/utils/format';
import { DiscountBadge } from '@/components/ui/Badge';

export function Price({
  price,
  oldPrice,
  size = 'md',
}: {
  price: number;
  oldPrice?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const percent = discountPercent(price, oldPrice);
  const priceClass = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-lg' : 'text-base';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`font-semibold tracking-tight text-ink dark:text-ink-dark ${priceClass}`}>
        {formatPrice(price)}
      </span>
      {oldPrice && (
        <span className="text-sm text-ink-soft line-through dark:text-ink-darksoft">
          {formatPrice(oldPrice)}
        </span>
      )}
      {percent && <DiscountBadge percent={percent} />}
    </div>
  );
}
