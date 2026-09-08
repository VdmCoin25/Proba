import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame, ArrowRight } from 'lucide-react';
import { products } from '@/data/products';
import { useCountdown } from '@/hooks/useCountdown';
import { ProductCard } from '@/components/product/ProductCard';

export function HotDeals() {
  const deadline = useMemo(() => Date.now() + 1000 * 60 * 60 * 5 + 1000 * 60 * 14, []);
  const { label, isOver } = useCountdown(deadline);

  const deals = products.filter((p) => p.isHot && p.oldPrice).slice(0, 8);

  return (
    <section className="bg-ink py-12 dark:bg-black md:py-16">
      <div className="container">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15">
              <Flame size={20} className="text-rose-400" />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Горячие предложения</h2>
              <p className="text-sm text-white/50">Скидки только на сегодня</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/50">
              {isOver ? 'Акция завершена' : 'Осталось'}
            </span>
            <span
              className="rounded-lg bg-white/10 px-3.5 py-2 font-mono text-lg font-semibold tabular-nums text-white"
              aria-live="polite"
            >
              {label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
          {deals.map((product) => (
            <div key={product.id} className="rounded-card bg-white/[0.03] p-2 sm:p-3">
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        <Link
          to="/catalog"
          className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-white/70"
        >
          Все предложения <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
