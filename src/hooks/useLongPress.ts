import { useEffect, useRef } from 'react';
import type React from 'react';

/** Long press (480 ms, cancelled after 10 px of movement) that suppresses the click that follows it. */
export function useLongPress(onLongPress: () => void, enabled = true) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const latest = useRef(onLongPress);
  latest.current = onLongPress;
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => cancel, []);
  return {
    onPointerDown: (event: React.PointerEvent) => {
      cancel();
      fired.current = false;
      if (!enabled || event.button !== 0 || !event.isPrimary) return;
      if ((event.target as HTMLElement).closest('button, a, input')) return;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => { fired.current = true; latest.current(); }, 480);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: (event: React.MouseEvent) => {
      if (fired.current) { event.preventDefault(); event.stopPropagation(); fired.current = false; }
    },
    onContextMenu: (event: React.MouseEvent) => {
      if (!enabled) return;
      event.preventDefault();
      cancel();
      fired.current = true;
      latest.current();
    },
  };
}
