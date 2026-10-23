import { createContext, useContext } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Page-level controls that the phone shell draws (title bar, search box, list actions). */
export interface ChromeAction { id: string; label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean }
export interface ChromeSelection {
  count: number;
  total: number;
  toggleAll: () => void;
  exit: () => void;
  actions: ChromeAction[];
  more: { id: string; label: string; onClick: () => void; danger?: boolean }[];
}
export interface ChromeSort {
  value: string;
  options: { value: string; label: string; description: string }[];
  onChange: (value: string) => void;
}
export interface ChromeFab { icon: LucideIcon; label: string; onClick: () => void }

export interface ChromeActions {
  setTitle: (title: string | null) => void;
  setBack: (back: (() => void) | null) => void;
  setStatus: (status: string | null) => void;
  setSelection: (selection: ChromeSelection | null) => void;
  setSort: (sort: ChromeSort | null) => void;
  setFab: (fab: ChromeFab | null) => void;
  setPlaceholder: (placeholder: string | null) => void;
  setSearch: (value: string) => void;
}

export const ChromeActionsContext = createContext<ChromeActions | null>(null);
export const ChromeSearchContext = createContext('');

/** Null on the desktop layout, where pages keep their own toolbars. */
export const useChromeActions = () => useContext(ChromeActionsContext);
export const useChromeSearch = () => useContext(ChromeSearchContext);
