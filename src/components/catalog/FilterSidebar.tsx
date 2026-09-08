import { ReactNode } from 'react';
import { Condition, FilterState } from '@/types';
import { categories } from '@/data/categories';
import { sellers } from '@/data/sellers';
import { brands } from '@/data/products';
import { Chip } from '@/components/ui/Badge';
import { Star } from 'lucide-react';

const conditions: Condition[] = ['Новый', 'Как новый', 'Б/У'];

export function FilterSidebar({
  filters,
  onChange,
  onReset,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
}) {
  function toggleArrayValue<K extends 'categories' | 'brands' | 'sellers'>(key: K, value: string) {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  }

  function toggleCondition(value: Condition) {
    const current = filters.conditions;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, conditions: next });
  }

  return (
    <aside className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">Фильтры</h2>
        <button
          onClick={onReset}
          className="text-xs font-medium text-accent hover:underline dark:text-accent-dark"
        >
          Сбросить
        </button>
      </div>

      <FilterGroup title="Категория">
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={filters.categories.includes(cat.id)}
                onChange={() => toggleArrayValue('categories', cat.id)}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent dark:border-line-dark"
              />
              <span className="text-ink-soft dark:text-ink-darksoft">{cat.name}</span>
              <span className="ml-auto text-xs text-ink-soft/60 dark:text-ink-darksoft/60">
                {cat.count}
              </span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Цена, ₽">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="От"
            value={filters.priceMin ?? ''}
            onChange={(e) =>
              onChange({ ...filters, priceMin: e.target.value ? Number(e.target.value) : null })
            }
            className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-accent dark:border-line-dark dark:text-ink-dark dark:focus:border-accent-dark"
          />
          <span className="text-ink-soft dark:text-ink-darksoft">—</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="До"
            value={filters.priceMax ?? ''}
            onChange={(e) =>
              onChange({ ...filters, priceMax: e.target.value ? Number(e.target.value) : null })
            }
            className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-accent dark:border-line-dark dark:text-ink-dark dark:focus:border-accent-dark"
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Бренд">
        <div className="flex flex-wrap gap-2">
          {brands.map((brand) => (
            <Chip
              key={brand}
              active={filters.brands.includes(brand)}
              onClick={() => toggleArrayValue('brands', brand)}
            >
              {brand}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Состояние">
        <div className="flex flex-wrap gap-2">
          {conditions.map((c) => (
            <Chip key={c} active={filters.conditions.includes(c)} onClick={() => toggleCondition(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Рейтинг">
        <div className="flex flex-col gap-2">
          {[4.5, 4, 3.5].map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="minRating"
                checked={filters.minRating === r}
                onChange={() => onChange({ ...filters, minRating: r })}
                className="h-4 w-4 border-line text-accent focus:ring-accent dark:border-line-dark"
              />
              <span className="flex items-center gap-1 text-ink-soft dark:text-ink-darksoft">
                <Star size={13} className="fill-amber-400 text-amber-400" /> от {r}
              </span>
            </label>
          ))}
          {filters.minRating !== null && (
            <button
              onClick={() => onChange({ ...filters, minRating: null })}
              className="w-fit text-xs text-accent hover:underline dark:text-accent-dark"
            >
              Сбросить рейтинг
            </button>
          )}
        </div>
      </FilterGroup>

      <FilterGroup title="Продавец">
        <div className="flex flex-col gap-2">
          {sellers.map((seller) => (
            <label key={seller.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={filters.sellers.includes(seller.id)}
                onChange={() => toggleArrayValue('sellers', seller.id)}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent dark:border-line-dark"
              />
              <span className="text-ink-soft dark:text-ink-darksoft">{seller.name}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Доставка">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={filters.freeShippingOnly}
            onChange={() => onChange({ ...filters, freeShippingOnly: !filters.freeShippingOnly })}
            className="h-4 w-4 rounded border-line text-accent focus:ring-accent dark:border-line-dark"
          />
          <span className="text-ink-soft dark:text-ink-darksoft">Только бесплатная доставка</span>
        </label>
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-line pb-6 last:border-0 last:pb-0 dark:border-line-dark">
      <h3 className="mb-3 text-sm font-medium text-ink dark:text-ink-dark">{title}</h3>
      {children}
    </div>
  );
}

export const defaultFilters: FilterState = {
  categories: [],
  brands: [],
  conditions: [],
  priceMin: null,
  priceMax: null,
  minRating: null,
  sellers: [],
  freeShippingOnly: false,
};
