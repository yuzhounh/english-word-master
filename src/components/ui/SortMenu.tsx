import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpDown, Check } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useBackHandler } from '../../hooks/useBackHandler';

interface SortOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

export function SortMenu<T extends string>({ value, options, onChange }: {
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useBackHandler(() => { if (!open) return false; setOpen(false); triggerRef.current?.focus(); return true; }, 10);
  useClickOutside(rootRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div ref={rootRef} className="notebook-sort relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label="排序方式"
        title={`排序方式：${options.find(option => option.value === value)?.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          const rect = triggerRef.current?.getBoundingClientRect();
          setAbove(!!rect && innerHeight - rect.bottom < 230 && rect.top > 230);
          setOpen(!open);
        }}
        className="w-10 h-10 flex items-center justify-center surface-muted border border-slate-200 dark:border-slate-600 rounded-xl text-secondary hover:text-brand-600 focus-ring cursor-pointer"
      >
        <ArrowUpDown className="w-4 h-4" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="选择排序方式"
          className={`notebook-sort-menu absolute right-0 w-60 max-w-[calc(100vw-24px)] surface-card rounded-2xl shadow-elevated p-2 z-40 ${above ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          onKeyDown={event => {
            const items = [...(event.currentTarget as HTMLDivElement).querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'ArrowDown' ? (index + 1) % items.length
              : event.key === 'ArrowUp' ? (index + items.length - 1) % items.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
            if (next >= 0) { event.preventDefault(); items[next].focus({ preventScroll: true }); }
          }}
        >
          <div className="px-3 pt-2 pb-2 text-xs font-semibold text-muted">排列方式</div>
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left focus-ring cursor-pointer ${value === option.value ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-secondary hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-[11px] text-muted mt-0.5">{option.description}</span>
              </span>
              <span className="w-5 h-5 shrink-0">{value === option.value && <Check className="w-5 h-5" />}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
