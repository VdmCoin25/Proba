import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string) => {
    const id = ++counter;
    setToasts((t) => [...t, { id, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  function dismiss(id: number) {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2.5 rounded-card border border-line bg-surface px-4 py-3 shadow-lift dark:border-line-dark dark:bg-surface-dark"
              role="status"
            >
              <CheckCircle2 size={18} className="shrink-0 text-accent dark:text-accent-dark" />
              <p className="flex-1 text-sm font-medium text-ink dark:text-ink-dark">
                {toast.message}
              </p>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 text-ink-soft transition-colors hover:text-ink dark:text-ink-darksoft dark:hover:text-ink-dark"
                aria-label="Закрыть уведомление"
              >
                <X size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
