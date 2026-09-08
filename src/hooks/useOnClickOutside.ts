import { RefObject, useEffect } from 'react';

export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: () => void,
) {
  useEffect(() => {
    function listener(event: MouseEvent) {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler();
    }
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}
