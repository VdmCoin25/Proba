import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { products } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { ProductVisual } from '@/components/product/ProductVisual';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPrice } from '@/utils/format';

export function CartPage() {
  const { items, setQuantity, removeItem, subtotal } = useCart();

  const lines = items
    .map((item) => ({ item, product: products.find((p) => p.id === item.productId) }))
    .filter((l): l is { item: typeof l.item; product: NonNullable<typeof l.product> } =>
      Boolean(l.product),
    );

  const delivery = lines.length > 0 ? 0 : 0;
  const discount = 0;
  const total = subtotal + delivery - discount;

  if (lines.length === 0) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Корзина пуста"
          description="Добавьте товары из каталога, чтобы оформить заказ."
          action={
            <Link to="/catalog">
              <Button>Перейти в каталог</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">Корзина</h1>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col divide-y divide-line dark:divide-line-dark">
          {lines.map(({ item, product }) => (
            <div key={product.id} className="flex gap-4 py-5">
              <Link to={`/product/${product.slug}`} className="shrink-0">
                <ProductVisual product={product} className="h-24 w-24" />
              </Link>
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs text-ink-soft dark:text-ink-darksoft">
                      {product.brand}
                    </span>
                    <Link
                      to={`/product/${product.slug}`}
                      className="block text-sm font-medium text-ink hover:text-accent dark:text-ink-dark dark:hover:text-accent-dark"
                    >
                      {product.name}
                    </Link>
                  </div>
                  <button
                    onClick={() => removeItem(product.id)}
                    aria-label="Удалить товар"
                    className="shrink-0 rounded-full p-1.5 text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-rose-600 dark:text-ink-darksoft dark:hover:bg-white/[0.06]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-lg border border-line dark:border-line-dark">
                    <button
                      onClick={() => setQuantity(product.id, item.quantity - 1)}
                      aria-label="Уменьшить количество"
                      className="flex h-8 w-8 items-center justify-center text-ink-soft hover:text-ink dark:text-ink-darksoft dark:hover:text-ink-dark"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-ink dark:text-ink-dark">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(product.id, item.quantity + 1)}
                      aria-label="Увеличить количество"
                      className="flex h-8 w-8 items-center justify-center text-ink-soft hover:text-ink dark:text-ink-darksoft dark:hover:text-ink-dark"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                    {formatPrice(product.price * item.quantity)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-xl2 border border-line p-5 dark:border-line-dark lg:sticky lg:top-24">
          <h2 className="text-base font-semibold text-ink dark:text-ink-dark">Итого</h2>
          <dl className="mt-4 flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft dark:text-ink-darksoft">Промежуточный итог</dt>
              <dd className="text-ink dark:text-ink-dark">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft dark:text-ink-darksoft">Доставка</dt>
              <dd className="text-ink dark:text-ink-dark">
                {delivery === 0 ? 'Бесплатно' : formatPrice(delivery)}
              </dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-soft dark:text-ink-darksoft">Скидка</dt>
                <dd className="text-rose-600">−{formatPrice(discount)}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex justify-between border-t border-line pt-4 dark:border-line-dark">
            <span className="text-base font-semibold text-ink dark:text-ink-dark">К оплате</span>
            <span className="text-base font-semibold text-ink dark:text-ink-dark">
              {formatPrice(total)}
            </span>
          </div>
          <Button size="lg" fullWidth className="mt-5">
            Перейти к оформлению
          </Button>
        </div>
      </div>
    </div>
  );
}
