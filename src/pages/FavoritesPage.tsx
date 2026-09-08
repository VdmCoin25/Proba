import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { products } from '@/data/products';
import { useWishlist } from '@/context/WishlistContext';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export function FavoritesPage() {
  const { ids } = useWishlist();
  const items = products.filter((p) => ids.includes(p.id));

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">Избранное</h1>
      <p className="mt-1.5 text-sm text-ink-soft dark:text-ink-darksoft">
        {items.length > 0 ? `${items.length} сохранённых товаров` : 'Список пуст'}
      </p>

      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Пока ничего не сохранено"
            description="Нажмите на сердечко на карточке товара, чтобы добавить его сюда."
            action={
              <Link to="/catalog">
                <Button>Перейти в каталог</Button>
              </Link>
            }
          />
        ) : (
          <ProductGrid products={items} />
        )}
      </div>
    </div>
  );
}
