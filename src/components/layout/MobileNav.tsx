import { NavLink } from 'react-router-dom';
import { Home, LayoutGrid, Heart, ShoppingBag, PlusCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

const items = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/catalog', label: 'Каталог', icon: LayoutGrid },
  { to: '/sell', label: 'Продать', icon: PlusCircle },
  { to: '/favorites', label: 'Избранное', icon: Heart },
  { to: '/cart', label: 'Корзина', icon: ShoppingBag },
] as const;

export function MobileNav() {
  const { count } = useCart();
  const { ids } = useWishlist();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md dark:border-line-dark dark:bg-surface-dark/95 sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around py-1.5">
        {items.map(({ to, label, icon: Icon, end }) => {
          const badge = to === '/cart' ? count : to === '/favorites' ? ids.length : 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'text-accent dark:text-accent-dark'
                    : 'text-ink-soft dark:text-ink-darksoft'
                }`
              }
            >
              <span className="relative">
                <Icon size={21} />
                {badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-semibold text-white dark:bg-accent-dark">
                    {badge}
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
