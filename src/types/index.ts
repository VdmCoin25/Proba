export type Condition = 'Новый' | 'Как новый' | 'Б/У';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string; // lucide icon name
  gradient: string; // tailwind gradient classes
  count: number;
}

export interface Seller {
  id: string;
  name: string;
  slug: string;
  avatarColor: string;
  verified: boolean;
  rating: number;
  salesCount: number;
  registeredAt: string; // ISO date
  responseRate: number; // 0-100
  responseTime: string;
  city: string;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  date: string;
  text: string;
  helpful: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryId: string;
  condition: Condition;
  price: number;
  oldPrice?: number;
  rating: number;
  reviewsCount: number;
  sellerId: string;
  location: string;
  shipping: string;
  colorFrom: string;
  colorTo: string;
  image?: string;
  description: string;
  specs: { label: string; value: string }[];
  images: number; // number of gallery thumbnails to render as variants
  tags?: string[];
  isNew?: boolean;
  isHot?: boolean;
  stock: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export type SortOption =
  | 'recommended'
  | 'price-asc'
  | 'price-desc'
  | 'newest'
  | 'rating';

export interface FilterState {
  categories: string[];
  brands: string[];
  conditions: Condition[];
  priceMin: number | null;
  priceMax: number | null;
  minRating: number | null;
  sellers: string[];
  freeShippingOnly: boolean;
}
