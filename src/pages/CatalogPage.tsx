import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { products } from '@/data/products';
import { categories } from '@/data/categories';
import { FilterSidebar, defaultFilters } from '@/components/catalog/FilterSidebar';
import { ProductGrid } from '@/components/product/ProductGrid';
import { SortOption } from '@/types';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'recommended', label: 'Рекомендуемые' },
  { value: 'price-asc', label: 'Дешевле' },
  { value: 'price-desc', label: 'Дороже' },
  { value: 'newest', label: 'Новинки' },
  { value: 'rating', label: 'По рейтингу' },
];

export function CatalogPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(defaultFilters);
  const [sort, setSort] = useState<SortOption>('recommended');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const categoryParam = searchParams.get('category');
  const queryParam = searchParams.get('q');

  useEffect(() => {
    setLoading(true);
    const id = window.setTimeout(() => setLoading(false), 400);
    return () => window.clearTimeout(id);
  }, [searchParams]);

  useEffect(() => {
    if (categoryParam) {
      const bySlug = categories.find((c) => c.slug === categoryParam || c.id === categoryParam);
      if (bySlug) {
        setFilters((f) => ({ ...f, categories: [bySlug.id] }));
      }
    }
  }, [categoryParam]);

  const filtered = useMemo(() => {
    let list = [...products];

    if (queryParam) {
      const q = queryParam.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q),
      );
    }
    if (filters.categories.length) {
      list = list.filter((p) => filters.categories.includes(p.categoryId));
    }
    if (filters.brands.length) {
      list = list.filter((p) => filters.brands.includes(p.brand));
    }
    if (filters.conditions.length) {
      list = list.filter((p) => filters.conditions.includes(p.condition));
    }
    if (filters.priceMin !== null) {
      list = list.filter((p) => p.price >= filters.priceMin!);
    }
    if (filters.priceMax !== null) {
      list = list.filter((p) => p.price <= filters.priceMax!);
    }
    if (filters.minRating !== null) {
      list = list.filter((p) => p.rating >= filters.minRating!);
    }
    if (filters.sellers.length) {
      list = list.filter((p) => filters.sellers.includes(p.sellerId));
    }
    if (filters.freeShippingOnly) {
      list = list.filter((p) => p.shipping.toLowerCase().includes('бесплатн'));
    }

    switch (sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        list.sort((a, b) => Number(b.isNew) - Number(a.isNew));
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      default:
        list.sort((a, b) => Number(b.isHot) - Number(a.isHot));
    }

    return list;
  }, [filters, sort, queryParam]);

  function resetFilters() {
    setFilters(defaultFilters);
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
          {queryParam ? `Результаты по запросу «${queryParam}»` : 'Каталог'}
        </h1>
        <p className="text-sm text-ink-soft dark:text-ink-darksoft">
          {filtered.length} товаров найдено
        </p>
      </div>

      <div className="flex gap-10">
        <div className="hidden w-64 shrink-0 lg:block">
          <FilterSidebar filters={filters} onChange={setFilters} onReset={resetFilters} />
        </div>

        <div className="flex-1">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink dark:border-line-dark dark:text-ink-dark lg:hidden"
            >
              <SlidersHorizontal size={15} /> Фильтры
            </button>

            <div className="relative ml-auto">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink dark:border-line-dark dark:text-ink-dark"
              >
                {sortOptions.find((o) => o.value === sort)?.label}
                <ChevronDown size={15} className={sortOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface shadow-lift dark:border-line-dark dark:bg-surface-dark"
                    >
                      {sortOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setSort(opt.value);
                            setSortOpen(false);
                          }}
                          className={`block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05] ${
                            sort === opt.value
                              ? 'font-medium text-accent dark:text-accent-dark'
                              : 'text-ink dark:text-ink-dark'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <ProductGrid products={filtered} loading={loading} />
        </div>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[80] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-surface p-5 dark:bg-surface-dark"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink dark:text-ink-dark">Фильтры</h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Закрыть фильтры"
                  className="rounded-full p-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <X size={18} />
                </button>
              </div>
              <FilterSidebar filters={filters} onChange={setFilters} onReset={resetFilters} />
              <button
                onClick={() => setDrawerOpen(false)}
                className="sticky bottom-0 mt-6 w-full rounded-xl bg-accent py-3 text-sm font-medium text-white dark:bg-accent-dark"
              >
                Показать {filtered.length} товаров
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
