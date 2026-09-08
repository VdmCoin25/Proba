import { Category } from '@/types';

export const categories: Category[] = [
  {
    id: 'smartphones',
    name: 'Смартфоны',
    slug: 'smartfony',
    icon: 'Smartphone',
    gradient: 'from-[#5B2EFF]/15 to-[#5B2EFF]/0',
    count: 342,
  },
  {
    id: 'laptops',
    name: 'Ноутбуки',
    slug: 'noutbuki',
    icon: 'Laptop',
    gradient: 'from-[#0EA5A4]/15 to-[#0EA5A4]/0',
    count: 218,
  },
  {
    id: 'audio',
    name: 'Аудио',
    slug: 'audio',
    icon: 'Headphones',
    gradient: 'from-[#F59E0B]/15 to-[#F59E0B]/0',
    count: 176,
  },
  {
    id: 'watches',
    name: 'Умные часы',
    slug: 'chasy',
    icon: 'Watch',
    gradient: 'from-[#EC4899]/15 to-[#EC4899]/0',
    count: 94,
  },
  {
    id: 'games',
    name: 'Игры',
    slug: 'igry',
    icon: 'Gamepad2',
    gradient: 'from-[#22C55E]/15 to-[#22C55E]/0',
    count: 131,
  },
  {
    id: 'cameras',
    name: 'Камеры',
    slug: 'kamery',
    icon: 'Camera',
    gradient: 'from-[#6366F1]/15 to-[#6366F1]/0',
    count: 67,
  },
  {
    id: 'tv',
    name: 'ТВ',
    slug: 'tv',
    icon: 'Tv',
    gradient: 'from-[#EF4444]/15 to-[#EF4444]/0',
    count: 58,
  },
  {
    id: 'accessories',
    name: 'Аксессуары',
    slug: 'aksessuary',
    icon: 'Cable',
    gradient: 'from-[#64748B]/15 to-[#64748B]/0',
    count: 289,
  },
  {
    id: 'tablets',
    name: 'Планшеты',
    slug: 'planshety',
    icon: 'Tablet',
    gradient: 'from-[#5B2EFF]/15 to-[#5B2EFF]/0',
    count: 88,
  },
];

// Ordered ids for the 8-card "Что ищете?" homepage grid (tablets folded into nav, not the grid)
export const homeGridCategoryIds = [
  'smartphones',
  'laptops',
  'audio',
  'watches',
  'games',
  'cameras',
  'tv',
  'accessories',
];

export const navCategories = [
  { label: 'Каталог', slug: '' },
  { label: 'Смартфоны', slug: 'smartfony' },
  { label: 'Ноутбуки', slug: 'noutbuki' },
  { label: 'Планшеты', slug: 'planshety' },
  { label: 'Аудио', slug: 'audio' },
  { label: 'Игры', slug: 'igry' },
];
