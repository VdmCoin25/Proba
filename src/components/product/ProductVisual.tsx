import { useState } from 'react';
import * as Icons from 'lucide-react';
import { LucideProps } from 'lucide-react';
import { ComponentType } from 'react';
import { Product } from '@/types';
import { categories } from '@/data/categories';

const categoryIconFallback: Record<string, string> = {
  smartphones: 'Smartphone',
  laptops: 'Laptop',
  audio: 'Headphones',
  watches: 'Watch',
  games: 'Gamepad2',
  cameras: 'Camera',
  tv: 'Tv',
  accessories: 'Cable',
  tablets: 'Tablet',
};

export function ProductVisual({
  product,
  className = '',
  variantIndex = 0,
}: {
  product: Product;
  className?: string;
  variantIndex?: number;
}) {
  const [broken, setBroken] = useState(false);
  const iconName =
    categories.find((c) => c.id === product.categoryId)?.icon ??
    categoryIconFallback[product.categoryId] ??
    'Package';
  const Icon = (Icons as unknown as Record<string, ComponentType<LucideProps>>)[iconName] ??
    Icons.Package;

  // Slight variance per gallery thumbnail so thumbnails don't look identical
  const rotate = variantIndex % 2 === 0 ? '' : 'scale-x-[-1]';

  if (product.image && !broken) {
    return (
      <div className={`relative overflow-hidden rounded-card bg-canvas-soft dark:bg-canvas-darksoft ${className}`}>
        <img
          src={product.image}
          alt={product.name}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-card ${className}`}
      style={{
        background: `linear-gradient(150deg, ${product.colorFrom}22, ${product.colorTo}33)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${product.colorFrom}55, transparent 60%)`,
        }}
      />
      <Icon
        size={64}
        strokeWidth={1.25}
        className={`relative drop-shadow-sm ${rotate}`}
        style={{ color: product.colorFrom }}
      />
    </div>
  );
}
