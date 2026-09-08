import { categories, homeGridCategoryIds } from '@/data/categories';
import { CategoryCard } from '@/components/category/CategoryCard';

export function CategoriesSection() {
  const homeCategories = homeGridCategoryIds
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean);

  return (
    <section className="container py-12 md:py-16">
      <div className="mb-7 flex items-end justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
          Что ищете?
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
        {homeCategories.map((category) => (
          <CategoryCard key={category!.id} category={category!} />
        ))}
      </div>
    </section>
  );
}
