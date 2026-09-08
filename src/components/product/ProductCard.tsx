import { Link } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { Product } from '@/types';
import { ProductVisual } from '@/components/product/ProductVisual';
import { ConditionBadge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { Price } from '@/components/ui/Price';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const saved = has(product.id);

  return (
    <div className="group relative flex flex-col">
      <Link
        to={`/product/${product.slug}`}
        className="relative block overflow-hidden rounded-card"
      >
        <div className="relative aspect-square overflow-hidden">
          <ProductVisual
            product={product}
            className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5">
            <ConditionBadge condition={product.condition} />
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              toggle(product.id);
            }}
            aria-label={saved ? 'Убрать из избранного' : 'Добавить в избранное'}
            aria-pressed={saved}
            className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft backdrop-blur transition-transform hover:scale-105 dark:bg-black/50 dark:text-white"
          >
            <Heart size={15} className={saved ? 'fill-rose-500 text-rose-500' : ''} />
          </button>

          <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex translate-y-2 gap-1.5 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.preventDefault();
                addItem(product.id);
              }}
              className="pointer-events-auto flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink text-xs font-medium text-white shadow-soft transition-colors hover:bg-ink/85 dark:bg-white dark:text-ink dark:hover:bg-white/85"
            >
              <ShoppingCart size={13} /> В корзину
            </button>
            <span className="pointer-events-auto flex h-9 items-center justify-center rounded-lg bg-white/90 px-3 text-xs font-medium text-ink shadow-soft backdrop-blur dark:bg-black/50 dark:text-white">
              Подробнее
            </span>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-ink-soft dark:text-ink-darksoft">{product.brand}</span>
        <Link
          to={`/product/${product.slug}`}
          className="line-clamp-1 text-sm font-medium text-ink hover:text-accent dark:text-ink-dark dark:hover:text-accent-dark"
        >
          {product.name}
        </Link>
        <Rating value={product.rating} reviewsCount={product.reviewsCount} />
        <Price price={product.price} oldPrice={product.oldPrice} />
      </div>
    </div>
  );
}
