import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Heart, ShoppingCart, Shield, Truck, MapPin, ChevronRight, Star } from 'lucide-react';
import { products } from '@/data/products';
import { sellers } from '@/data/sellers';
import { reviews } from '@/data/reviews';
import { ProductVisual } from '@/components/product/ProductVisual';
import { ConditionBadge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { Price } from '@/components/ui/Price';
import { Button } from '@/components/ui/Button';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatDate } from '@/utils/format';

export function ProductPage() {
  const { slug } = useParams();
  const product = products.find((p) => p.slug === slug);
  const [activeThumb, setActiveThumb] = useState(0);
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();

  if (!product) return <Navigate to="/catalog" replace />;

  const seller = sellers.find((s) => s.id === product.sellerId);
  const productReviews = reviews.filter((r) => r.productId === product.id);
  const related = products
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 8);
  const saved = has(product.id);

  return (
    <div className="container py-8">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-ink-soft dark:text-ink-darksoft">
        <Link to="/catalog" className="hover:text-ink dark:hover:text-ink-dark">
          Каталог
        </Link>
        <ChevronRight size={14} />
        <Link
          to={`/catalog?category=${product.categoryId}`}
          className="hover:text-ink dark:hover:text-ink-dark"
        >
          {product.brand}
        </Link>
        <ChevronRight size={14} />
        <span className="line-clamp-1 text-ink dark:text-ink-dark">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <ProductVisual
            product={product}
            variantIndex={activeThumb}
            className="aspect-square w-full"
          />
          {product.images > 1 && (
            <div className="mt-3 flex gap-2.5">
              {Array.from({ length: product.images }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveThumb(i)}
                  aria-label={`Фото ${i + 1}`}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    activeThumb === i
                      ? 'border-accent dark:border-accent-dark'
                      : 'border-transparent'
                  }`}
                >
                  <ProductVisual product={product} variantIndex={i} className="h-full w-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <ConditionBadge condition={product.condition} />
            {product.isNew && (
              <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent dark:bg-accent-dark/15 dark:text-accent-dark">
                Новинка
              </span>
            )}
          </div>
          <p className="mt-3 text-sm text-ink-soft dark:text-ink-darksoft">{product.brand}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-ink-dark sm:text-3xl">
            {product.name}
          </h1>
          <div className="mt-3">
            <Rating value={product.rating} reviewsCount={product.reviewsCount} size={16} />
          </div>

          <div className="mt-5">
            <Price price={product.price} oldPrice={product.oldPrice} size="lg" />
          </div>

          <div className="mt-6 flex flex-col gap-2.5 rounded-xl2 border border-line p-4 text-sm dark:border-line-dark">
            <div className="flex items-center gap-2.5 text-ink-soft dark:text-ink-darksoft">
              <Truck size={16} /> {product.shipping}
            </div>
            <div className="flex items-center gap-2.5 text-ink-soft dark:text-ink-darksoft">
              <MapPin size={16} /> {product.location}
            </div>
            <div className="flex items-center gap-2.5 text-ink-soft dark:text-ink-darksoft">
              <Shield size={16} /> Безопасная сделка через MARKET
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button size="lg" fullWidth onClick={() => addItem(product.id)}>
              <ShoppingCart size={17} /> Купить сейчас
            </Button>
            <button
              onClick={() => toggle(product.id)}
              aria-label={saved ? 'Убрать из избранного' : 'Добавить в избранное'}
              aria-pressed={saved}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line text-ink transition-colors hover:border-ink/25 dark:border-line-dark dark:text-ink-dark dark:hover:border-white/25"
            >
              <Heart size={19} className={saved ? 'fill-rose-500 text-rose-500' : ''} />
            </button>
          </div>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            className="mt-3"
            onClick={() => addItem(product.id)}
          >
            Добавить в корзину
          </Button>

          {seller && (
            <Link
              to={`/seller/${seller.slug}`}
              className="mt-7 flex items-center gap-3 rounded-xl2 border border-line p-4 transition-colors hover:border-ink/20 dark:border-line-dark dark:hover:border-white/20"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: seller.avatarColor }}
              >
                {seller.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink dark:text-ink-dark">
                  {seller.name}
                  {seller.verified && (
                    <Shield size={13} className="fill-accent/15 text-accent dark:text-accent-dark" />
                  )}
                </p>
                <p className="text-xs text-ink-soft dark:text-ink-darksoft">
                  {seller.salesCount} продаж · рейтинг {seller.rating}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-ink-soft dark:text-ink-darksoft" />
            </Link>
          )}
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Описание</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft dark:text-ink-darksoft">
            {product.description}
          </p>

          <h2 className="mt-10 text-lg font-semibold text-ink dark:text-ink-dark">
            Характеристики
          </h2>
          <dl className="mt-3 max-w-xl divide-y divide-line dark:divide-line-dark">
            {product.specs.map((spec) => (
              <div key={spec.label} className="flex justify-between py-2.5 text-sm">
                <dt className="text-ink-soft dark:text-ink-darksoft">{spec.label}</dt>
                <dd className="font-medium text-ink dark:text-ink-dark">{spec.value}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-10 text-lg font-semibold text-ink dark:text-ink-dark">
            Отзывы ({productReviews.length})
          </h2>
          {productReviews.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft dark:text-ink-darksoft">
              Пока нет отзывов об этом товаре.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-5">
              {productReviews.map((review) => (
                <div key={review.id} className="border-b border-line pb-5 last:border-0 dark:border-line-dark">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink dark:text-ink-dark">
                      {review.author}
                    </p>
                    <span className="text-xs text-ink-soft dark:text-ink-darksoft">
                      {formatDate(review.date)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={13}
                        className={
                          i < review.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-ink/15 dark:text-white/15'
                        }
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-ink-darksoft">
                    {review.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {seller && (
          <div>
            <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">О продавце</h2>
            <div className="mt-3 rounded-xl2 border border-line p-5 dark:border-line-dark">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
                  style={{ backgroundColor: seller.avatarColor }}
                >
                  {seller.name.slice(0, 1)}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink dark:text-ink-dark">{seller.name}</p>
                  <p className="text-xs text-ink-soft dark:text-ink-darksoft">{seller.city}</p>
                </div>
              </div>
              <dl className="mt-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft dark:text-ink-darksoft">Рейтинг</dt>
                  <dd className="font-medium text-ink dark:text-ink-dark">{seller.rating}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft dark:text-ink-darksoft">Продаж</dt>
                  <dd className="font-medium text-ink dark:text-ink-dark">{seller.salesCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft dark:text-ink-darksoft">Отвечает</dt>
                  <dd className="font-medium text-ink dark:text-ink-dark">
                    {seller.responseTime}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft dark:text-ink-darksoft">На площадке с</dt>
                  <dd className="font-medium text-ink dark:text-ink-dark">
                    {formatDate(seller.registeredAt)}
                  </dd>
                </div>
              </dl>
              <Link
                to={`/seller/${seller.slug}`}
                className="mt-4 block w-full rounded-lg border border-line py-2.5 text-center text-sm font-medium text-ink transition-colors hover:border-ink/25 dark:border-line-dark dark:text-ink-dark dark:hover:border-white/25"
              >
                Все товары продавца
              </Link>
            </div>
          </div>
        )}
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
            Похожие товары
          </h2>
          <ProductCarousel products={related} />
        </div>
      )}
    </div>
  );
}
