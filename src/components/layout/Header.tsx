import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Heart, ShoppingBag, User, Menu, X, Sun, Moon } from 'lucide-react';
import { navCategories } from '@/data/categories';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useTheme } from '@/context/ThemeContext';
import { SearchOverlay } from '@/components/search/SearchOverlay';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { count } = useCart();
  const { ids } = useWishlist();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md dark:border-line-dark dark:bg-surface-dark/85">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white dark:bg-accent-dark">
              M
            </span>
            <span className="text-lg font-bold tracking-tight text-ink dark:text-ink-dark">
              MARKET
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navCategories.map((item) => (
              <NavLink
                key={item.label}
                to={item.slug ? `/catalog?category=${item.slug}` : '/catalog'}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-ink dark:text-ink-dark'
                      : 'text-ink-soft hover:text-ink dark:text-ink-darksoft dark:hover:text-ink-dark'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Открыть поиск"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-ink dark:text-ink-darksoft dark:hover:bg-white/[0.06] dark:hover:text-ink-dark"
          >
            <Search size={19} />
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            className="hidden h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-ink dark:text-ink-darksoft dark:hover:bg-white/[0.06] dark:hover:text-ink-dark sm:flex"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link
            to="/favorites"
            aria-label="Избранное"
            className="relative hidden h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-ink dark:text-ink-darksoft dark:hover:bg-white/[0.06] dark:hover:text-ink-dark sm:flex"
          >
            <Heart size={19} />
            {ids.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white dark:bg-accent-dark">
                {ids.length}
              </span>
            )}
          </Link>
          <Link
            to="/cart"
            aria-label="Корзина"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-ink dark:text-ink-darksoft dark:hover:bg-white/[0.06] dark:hover:text-ink-dark"
          >
            <ShoppingBag size={19} />
            {count > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white dark:bg-accent-dark">
                {count}
              </span>
            )}
          </Link>
          <Link
            to="/sell"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-ink dark:text-ink-darksoft dark:hover:bg-white/[0.06] dark:hover:text-ink-dark md:flex"
            aria-label="Профиль"
          >
            <User size={19} />
          </Link>
          <Link
            to="/sell"
            className="hidden h-9 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent/90 dark:bg-accent-dark dark:hover:bg-accent-dark/90 md:inline-flex"
          >
            Разместить
          </Link>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/[0.04] hover:text-ink dark:text-ink-darksoft dark:hover:bg-white/[0.06] dark:hover:text-ink-dark lg:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-line dark:border-line-dark lg:hidden"
          >
            <div className="container flex flex-col gap-1 py-3">
              {navCategories.map((item) => (
                <Link
                  key={item.label}
                  to={item.slug ? `/catalog?category=${item.slug}` : '/catalog'}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-ink hover:bg-black/[0.03] dark:text-ink-dark dark:hover:bg-white/[0.05]"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-1 flex items-center gap-2 border-t border-line px-2 pt-3 dark:border-line-dark">
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 text-sm font-medium text-ink-soft dark:text-ink-darksoft"
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                </button>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
