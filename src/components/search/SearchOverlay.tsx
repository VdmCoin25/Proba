import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { products } from '@/data/products';
import { categories } from '@/data/categories';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDebounce } from '@/hooks/useDebounce';
import { ProductVisual } from '@/components/product/ProductVisual';
import { Price } from '@/components/ui/Price';

const popularCategories = categories.slice(0, 6);

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useLocalStorage<string[]>('market-recent-search', []);
  const debounced = useDebounce(query, 150);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [debounced]);

  function commitSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecent((prev) => [trimmed, ...prev.filter((t) => t !== trimmed)].slice(0, 6));
    onClose();
    navigate(`/catalog?q=${encodeURIComponent(trimmed)}`);
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative mt-0 flex max-h-screen w-full max-w-2xl flex-col overflow-hidden bg-surface shadow-lift dark:bg-surface-dark sm:mt-20 sm:rounded-xl2 sm:border sm:border-line sm:dark:border-line-dark"
          >
            <div className="flex items-center gap-3 border-b border-line px-5 py-4 dark:border-line-dark">
              <Search size={18} className="shrink-0 text-ink-soft dark:text-ink-darksoft" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSearch(query);
                }}
                placeholder="Искать iPhone, MacBook, PlayStation..."
                aria-label="Поиск товаров"
                className="w-full bg-transparent text-base text-ink placeholder:text-ink-soft/70 focus:outline-none dark:text-ink-dark dark:placeholder:text-ink-darksoft/70"
              />
              <button
                onClick={onClose}
                aria-label="Закрыть поиск"
                className="shrink-0 rounded-full p-1.5 text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-ink dark:text-ink-darksoft dark:hover:bg-white/[0.06] dark:hover:text-ink-dark"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              {query.trim() ? (
                results.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <p className="mb-2 text-xs font-medium text-ink-soft dark:text-ink-darksoft">
                      Товары
                    </p>
                    {results.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => commitSearch(product.name)}
                        className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                      >
                        <ProductVisual product={product} className="h-12 w-12 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink dark:text-ink-dark">
                            {product.name}
                          </p>
                          <p className="text-xs text-ink-soft dark:text-ink-darksoft">
                            {product.brand}
                          </p>
                        </div>
                        <Price price={product.price} size="sm" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-ink-soft dark:text-ink-darksoft">
                    Ничего не найдено по запросу «{query}»
                  </p>
                )
              ) : (
                <div className="flex flex-col gap-6">
                  {recent.length > 0 && (
                    <div>
                      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-ink-soft dark:text-ink-darksoft">
                        <Clock size={13} /> Недавние запросы
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recent.map((term) => (
                          <button
                            key={term}
                            onClick={() => commitSearch(term)}
                            className="rounded-pill border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink/25 hover:text-ink dark:border-line-dark dark:text-ink-darksoft dark:hover:border-white/25 dark:hover:text-ink-dark"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-ink-soft dark:text-ink-darksoft">
                      <TrendingUp size={13} /> Популярные категории
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {popularCategories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => commitSearch(cat.name)}
                          className="rounded-pill border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink/25 hover:text-ink dark:border-line-dark dark:text-ink-darksoft dark:hover:border-white/25 dark:hover:text-ink-dark"
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
