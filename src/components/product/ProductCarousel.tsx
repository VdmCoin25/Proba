import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';

export function ProductCarousel({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-5"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[46%] shrink-0 snap-start sm:w-[32%] md:w-[24%] lg:w-[19%]"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
      <button
        onClick={() => scrollBy(-1)}
        aria-label="Прокрутить назад"
        className="absolute -left-3 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface shadow-soft transition-transform hover:scale-105 dark:border-line-dark dark:bg-surface-dark md:flex"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => scrollBy(1)}
        aria-label="Прокрутить вперёд"
        className="absolute -right-3 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface shadow-soft transition-transform hover:scale-105 dark:border-line-dark dark:bg-surface-dark md:flex"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
