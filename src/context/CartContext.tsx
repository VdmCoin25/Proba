import { createContext, useContext, useMemo, ReactNode } from 'react';
import { CartItem } from '@/types';
import { products } from '@/data/products';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/context/ToastContext';

interface CartContextValue {
  items: CartItem[];
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useLocalStorage<CartItem[]>('market-cart', []);
  const { showToast } = useToast();

  function addItem(productId: string, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [...prev, { productId, quantity }];
    });
    showToast('Добавлено в корзину ✓');
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function setQuantity(productId: string, quantity: number) {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  }

  function clear() {
    setItems([]);
  }

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, i) => {
      const product = products.find((p) => p.id === i.productId);
      return product ? sum + product.price * i.quantity : sum;
    }, 0);
  }, [items]);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, setQuantity, clear, count, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
