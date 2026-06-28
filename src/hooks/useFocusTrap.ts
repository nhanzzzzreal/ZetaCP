import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(isOpen: boolean, ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!isOpen || !ref.current) return;
    const container = ref.current;
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) focusables[0].focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (list.length === 0) return;
      if (e.shiftKey && document.activeElement === list[0]) {
        list[list.length - 1].focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === list[list.length - 1]) {
        list[0].focus();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, ref]);
}
