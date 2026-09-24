import { useEffect, useState } from 'react';

export function useTVNavigation(enabled: boolean) {
  const [currentFocusedIndex, setCurrentFocusedIndex] = useState<number>(-1);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input text field
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur();
        }
        return;
      }

      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>('[data-focusable="true"]')
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
      });

      if (focusable.length === 0) return;

      const currentEl = document.querySelector<HTMLElement>('[data-focused="true"]') || (activeEl as HTMLElement);
      let currentIndex = focusable.indexOf(currentEl);

      if (currentIndex === -1) {
        // Focus first element
        focusable[0]?.setAttribute('data-focused', 'true');
        focusable[0]?.focus();
        setCurrentFocusedIndex(0);
        return;
      }

      const currentRect = currentEl.getBoundingClientRect();
      let nextIndex = -1;
      let minDistance = Infinity;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        focusable.forEach((target, idx) => {
          if (idx === currentIndex) return;
          const targetRect = target.getBoundingClientRect();
          if (targetRect.left >= currentRect.right - 10) {
            const dx = targetRect.left - currentRect.right;
            const dy = Math.abs(targetRect.top - currentRect.top);
            const dist = dx + dy * 2;
            if (dist < minDistance) {
              minDistance = dist;
              nextIndex = idx;
            }
          }
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        focusable.forEach((target, idx) => {
          if (idx === currentIndex) return;
          const targetRect = target.getBoundingClientRect();
          if (targetRect.right <= currentRect.left + 10) {
            const dx = currentRect.left - targetRect.right;
            const dy = Math.abs(targetRect.top - currentRect.top);
            const dist = dx + dy * 2;
            if (dist < minDistance) {
              minDistance = dist;
              nextIndex = idx;
            }
          }
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusable.forEach((target, idx) => {
          if (idx === currentIndex) return;
          const targetRect = target.getBoundingClientRect();
          if (targetRect.top >= currentRect.bottom - 10) {
            const dy = targetRect.top - currentRect.bottom;
            const dx = Math.abs(targetRect.left - currentRect.left);
            const dist = dy * 2 + dx;
            if (dist < minDistance) {
              minDistance = dist;
              nextIndex = idx;
            }
          }
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusable.forEach((target, idx) => {
          if (idx === currentIndex) return;
          const targetRect = target.getBoundingClientRect();
          if (targetRect.bottom <= currentRect.top + 10) {
            const dy = currentRect.top - targetRect.bottom;
            const dx = Math.abs(targetRect.left - currentRect.left);
            const dist = dy * 2 + dx;
            if (dist < minDistance) {
              minDistance = dist;
              nextIndex = idx;
            }
          }
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        currentEl.click();
      } else if (['Escape', 'Backspace', 'BrowserBack', 'GoBack', 'Back'].includes(e.key)) {
        // If a modal or player close button exists, trigger it
        const closeBtn = document.querySelector<HTMLElement>('[title*="Voltar"], [title*="Fechar"], [title*="Esc"]');
        if (closeBtn) {
          e.preventDefault();
          closeBtn.click();
        }
      }

      if (nextIndex !== -1 && focusable[nextIndex]) {
        currentEl.removeAttribute('data-focused');
        const nextEl = focusable[nextIndex];
        nextEl.setAttribute('data-focused', 'true');
        nextEl.focus();
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        setCurrentFocusedIndex(nextIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, currentFocusedIndex]);
}
