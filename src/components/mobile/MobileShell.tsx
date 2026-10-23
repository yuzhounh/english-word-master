import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Menu, Search, X } from 'lucide-react';
import { SortMenu } from '../ui/SortMenu';
import { SelectionBar } from './SelectionBar';
import { useBackHandler } from '../../hooks/useBackHandler';
import {
  ChromeActions, ChromeActionsContext, ChromeFab, ChromeSearchContext, ChromeSelection, ChromeSort,
} from './chrome';

interface MobileShellProps {
  title: string;
  placeholder: string | null;
  fab: ChromeFab | null;
  status?: string | null;
  /** Changes whenever the visible view changes; clears the search box. */
  resetKey: string;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  menu: React.ReactNode;
  children: React.ReactNode;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  title, placeholder, fab, status, resetKey, menuOpen, setMenuOpen, menu, children,
}) => {
  const [search, setSearch] = useState('');
  const [titleOverride, setTitle] = useState<string | null>(null);
  const [back, setBack] = useState<(() => void) | null>(null);
  const [statusOverride, setStatus] = useState<string | null>(null);
  const [selection, setSelection] = useState<ChromeSelection | null>(null);
  const [sort, setSort] = useState<ChromeSort | null>(null);
  const [fabOverride, setFab] = useState<ChromeFab | null>(null);
  const [placeholderOverride, setPlaceholder] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // setBack stores functions, so wrap them to avoid the state-updater form.
  const actions = useMemo<ChromeActions>(() => ({
    setTitle, setStatus, setSelection, setSort, setFab, setPlaceholder, setSearch,
    setBack: (fn: (() => void) | null) => setBack(() => fn),
  }), []);

  useEffect(() => { setSearch(''); setMoreOpen(false); }, [resetKey]);
  useEffect(() => { if (!selection) setMoreOpen(false); }, [selection]);
  useBackHandler(() => {
    if (moreOpen) { setMoreOpen(false); return true; }
    if (menuOpen) { setMenuOpen(false); return true; }
    return false;
  }, 25);

  // Collapse the title bar and search box while reading downwards.
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y <= 8) setCollapsed(false);
      else if (delta > 6 && y > 56) setCollapsed(true);
      else if (delta < -6) setCollapsed(false);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { setCollapsed(false); lastY.current = 0; }, [resetKey]);

  const shownTitle = titleOverride ?? title;
  const shownStatus = selection ? `已选择 ${selection.count} 项` : (statusOverride ?? status ?? null);
  const shownPlaceholder = placeholderOverride ?? placeholder;
  const shownFab = fabOverride ?? fab;
  const allSelected = !!selection && selection.total > 0 && selection.count === selection.total;

  return (
    <ChromeActionsContext.Provider value={actions}>
      <ChromeSearchContext.Provider value={search}>
        <div className="m-shell">
          <header className={`m-header${collapsed ? ' is-collapsed' : ''}`} data-m-header>
            <div className="m-titlebar">
              {back && !selection && (
                <button type="button" className="m-icon-btn" aria-label="返回" onClick={back}>
                  <ChevronLeft width={24} height={24} strokeWidth={1.8} />
                </button>
              )}
              <div className="m-title-wrap">
                <h1 className="m-title">{shownTitle}</h1>
                {shownStatus && <div className="m-status" role="status">{shownStatus}</div>}
              </div>
              {selection ? (
                <button type="button" className={`m-icon-btn${allSelected ? ' is-on' : ''}`}
                  aria-label={allSelected ? '取消全选' : '全选'} aria-pressed={allSelected} onClick={selection.toggleAll}>
                  <Check width={24} height={24} strokeWidth={1.8} />
                </button>
              ) : (
                <button type="button" className="m-icon-btn" aria-label="打开菜单" onClick={() => setMenuOpen(true)}>
                  <Menu width={24} height={24} strokeWidth={1.8} />
                </button>
              )}
            </div>
            {shownPlaceholder !== null && (
              <div className="m-search-wrap">
                <div className="m-search">
                  <Search width={20} height={20} strokeWidth={1.8} aria-hidden />
                  <input type="search" value={search} onChange={event => setSearch(event.target.value)}
                    placeholder={shownPlaceholder} aria-label={shownPlaceholder} enterKeyHint="search" />
                  {search && (
                    <button type="button" className="m-search-clear" aria-label="清除搜索" onClick={() => setSearch('')}>
                      <X width={18} height={18} strokeWidth={1.8} />
                    </button>
                  )}
                  {sort && <SortMenu value={sort.value} options={sort.options} onChange={sort.onChange} />}
                </div>
              </div>
            )}
          </header>

          <main className="m-panel">{children}</main>

          {shownFab && !selection && !menuOpen && (
            <button type="button" className="m-fab" aria-label={shownFab.label} title={shownFab.label} onClick={shownFab.onClick}>
              <shownFab.icon width={24} height={24} strokeWidth={1.8} />
            </button>
          )}

          {selection && <SelectionBar selection={selection} moreOpen={moreOpen} setMoreOpen={setMoreOpen} />}

          {menuOpen && menu}
        </div>
      </ChromeSearchContext.Provider>
    </ChromeActionsContext.Provider>
  );
};
