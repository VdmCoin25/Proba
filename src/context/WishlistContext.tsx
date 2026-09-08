import { createContext, useContext, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/context/ToastContext';

interface WishlistContextValue {
  ids: string[];
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useLocalStorage<string[]>('market-wishlist', []);
  const { showToast } = useToast();

  function toggle(productId: string) {
    setIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      showToast('Добавлено в избранное ✓');
      return [...prev, productId];
    });
  }

  function has(productId: string) {
    return ids.includes(productId);
  }

  return (
    <WishlistContext.Provider value={{ ids, toggle, has }}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
