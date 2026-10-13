import { useEffect, useRef } from 'react';

const handlers: Array<{ callback: () => boolean; priority: number }> = [];
declare global {
  interface Window { wordmasterHandleBack?: () => boolean; }
}
if (typeof window !== 'undefined') {
  window.wordmasterHandleBack = () => {
    for (const entry of [...handlers].reverse().sort((a, b) => b.priority - a.priority)) {
      if (entry.callback()) return true;
    }
    return false;
  };
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && window.wordmasterHandleBack?.()) event.preventDefault();
  });
}

export function useBackHandler(handler: () => boolean, priority = 0) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const callback = () => latest.current();
    const entry = { callback, priority };
    handlers.push(entry);
    return () => { const index = handlers.indexOf(entry); if (index >= 0) handlers.splice(index, 1); };
  }, [priority]);
}
