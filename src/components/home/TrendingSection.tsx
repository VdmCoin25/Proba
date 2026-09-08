import { products } from '@/data/products';
import { ProductCarousel } from '@/components/product/ProductCarousel';

export function TrendingSection() {
  const trending = [...products].sort((a, b) => b.reviewsCount - a.reviewsCount).slice(0, 10);

  return (
    <section className="container py-12 md:py-16">
      <div className="mb-7 flex items-end justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
          Сейчас покупают
        </h2>
      </div>
      <ProductCarousel products={trending} />
    </section>
  );
}
