import { Product } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchX } from 'lucide-react';

export function ProductGrid({
  products,
  loading,
  emptyTitle = 'Ничего не найдено',
  emptyDescription = 'Попробуйте изменить фильтры или запрос поиска.',
}: {
  products: Product[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState icon={SearchX} title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
