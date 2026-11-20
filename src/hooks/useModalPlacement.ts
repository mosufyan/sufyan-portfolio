import { useLayoutEffect, useRef, useState } from 'react';

export type ModalVerticalAlign = 'start' | 'center' | 'end';

interface InteractionSnapshot {
  clientY: number;
  viewportHeight: number;
  timestamp: number;
  kind: 'pointer' | 'keyboard';
}

let lastInteraction: InteractionSnapshot | null = null;
let listenersInstalled = false;

function ensureInteractionListeners() {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;

  const recordPointer = (e: PointerEvent) => {
    lastInteraction = {
      clientY: e.clientY,
      viewportHeight: Math.max(window.innerHeight, 1),
      timestamp: Date.now(),
      kind: 'pointer',
    };
  };

  const recordKeydown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.key === '/' || e.key === 'Enter' || e.key === ' ') {
      const isShortcut = e.metaKey || e.ctrlKey || e.key === '/';
      let y = Math.max(window.innerHeight, 1) * 0.5;

      if (!isShortcut && document.activeElement instanceof HTMLElement) {
        const rect = document.activeElement.getBoundingClientRect();
        if (rect.height > 0 && rect.top >= 0 && rect.top <= window.innerHeight) {
          y = rect.top + rect.height / 2;
        }
      }

      lastInteraction = {
        clientY: y,
        viewportHeight: Math.max(window.innerHeight, 1),
        timestamp: Date.now(),
        kind: isShortcut ? 'keyboard' : 'pointer',
      };
    }
  };

  window.addEventListener('pointerdown', recordPointer, { capture: true, passive: true });
  window.addEventListener('keydown', recordKeydown, { capture: true, passive: true });
}

if (typeof window !== 'undefined') {
  ensureInteractionListeners();
}

function resolveModalVerticalAlign(): ModalVerticalAlign {
  if (typeof window === 'undefined') return 'center';
  ensureInteractionListeners();

  const vh = Math.max(window.innerHeight, 1);

  if (lastInteraction && Date.now() - lastInteraction.timestamp < 1200) {
    if (lastInteraction.kind === 'keyboard') {
      return 'center';
    }
    const ratio = lastInteraction.clientY / Math.max(lastInteraction.viewportHeight, 1);
    if (ratio >= 0.56) return 'end';
    if (ratio >= 0.38) return 'center';
    return 'start';
  }

  if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
    const rect = document.activeElement.getBoundingClientRect();
    if (rect.height > 0) {
      const ratio = (rect.top + rect.height / 2) / vh;
      if (ratio >= 0.56) return 'end';
      if (ratio >= 0.38) return 'center';
      return 'start';
    }
  }

  return 'start';
}

const ALIGN_CLASS_MAP: Record<ModalVerticalAlign, string> = {
  start: 'items-start lg:items-center',
  center: 'items-center',
  end: 'items-end lg:items-center',
};

/**
 * Resolves vertical alignment before paint when a modal opens and preserves it until
 * exit completes so modals never jump while closing or get clipped off-screen:
 * - Phone & Tablet (< lg): anchors near the trigger zone (`items-start`, `items-center`,
 *   or `items-end`) so pop-ups triggered from the bottom (#contact / Footer) remain
 *   fully visible even inside tall emulated tablet/mobile preview frames.
 * - Desktop & Big TV (lg+): always centers smoothly (`lg:items-center`).
 */
export function useModalPlacement(isOpen: boolean): string {
  const [align, setAlign] = useState<ModalVerticalAlign>(() =>
    isOpen ? resolveModalVerticalAlign() : 'center'
  );
  const prevOpenRef = useRef(isOpen);

  useLayoutEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setAlign(resolveModalVerticalAlign());
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  return ALIGN_CLASS_MAP[align];
}
