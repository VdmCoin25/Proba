import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { LucideProps } from 'lucide-react';
import { ComponentType } from 'react';
import { Category } from '@/types';
import { pluralize } from '@/utils/format';

export function CategoryCard({ category }: { category: Category }) {
  const Icon =
    (Icons as unknown as Record<string, ComponentType<LucideProps>>)[category.icon] ??
    Icons.Package;

  return (
    <Link
      to={`/catalog?category=${category.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl2 border border-line bg-gradient-to-br p-5 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-glow dark:border-line-dark"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70 ${category.gradient}`}
      />
      <div className="relative flex items-center justify-between">
        <Icon
          size={26}
          strokeWidth={1.4}
          className="text-ink transition-transform duration-300 group-hover:scale-110 dark:text-ink-dark"
        />
      </div>
      <div className="relative mt-8">
        <p className="text-base font-semibold text-ink dark:text-ink-dark">{category.name}</p>
        <p className="mt-0.5 text-sm text-ink-soft dark:text-ink-darksoft">
          {category.count} {pluralize(category.count, ['объявление', 'объявления', 'объявлений'])}
        </p>
      </div>
    </Link>
  );
}
