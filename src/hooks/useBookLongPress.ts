import { useEffect, useRef } from 'react';
import type React from 'react';

export function useBookLongPress(open: (id: string) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => cancel, []);
  const target = (event: React.SyntheticEvent) => (event.target as HTMLElement).closest<HTMLElement>('[data-book-target]');
  return {
    onPointerDown: (event: React.PointerEvent) => {
      cancel();
      suppressClick.current = false;
      const card = target(event);
      if (!card || event.button !== 0 || !event.isPrimary) return;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => { suppressClick.current = true; open(card.dataset.bookTarget!); }, 480);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: (event: React.MouseEvent) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
    },
    onContextMenu: (event: React.MouseEvent) => {
      const card = target(event);
      if (card) { event.preventDefault(); cancel(); suppressClick.current = true; open(card.dataset.bookTarget!); }
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      const card = target(event);
      if (!card) return;
      if (event.key === 'F10' && event.shiftKey) { event.preventDefault(); open(card.dataset.bookTarget!); }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
    },
  };
}
