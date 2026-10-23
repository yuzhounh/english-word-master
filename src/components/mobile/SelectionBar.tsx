import React from 'react';
import { MoreVertical, X } from 'lucide-react';
import type { ChromeSelection } from './chrome';

interface SelectionBarProps {
  selection: ChromeSelection;
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
}

/** Bottom action bar shown while list items are selected: up to 3 actions, cancel and more. */
export const SelectionBar: React.FC<SelectionBarProps> = ({ selection, moreOpen, setMoreOpen }) => (
  <>
    {moreOpen && <div className="m-more-mask" onClick={() => setMoreOpen(false)} />}
    <nav className="m-selection-bar" aria-label="选择操作">
      {moreOpen && (
        <div className="m-popup" role="menu">
          {selection.more.map(item => (
            <button key={item.id} type="button" role="menuitem" className={item.danger ? 'is-danger' : undefined}
              onClick={() => { setMoreOpen(false); item.onClick(); }}>{item.label}</button>
          ))}
        </div>
      )}
      {selection.actions.map(action => (
        <button key={action.id} type="button" disabled={action.disabled || selection.count === 0} onClick={action.onClick}>
          <action.icon width={22} height={22} strokeWidth={1.8} aria-hidden />
          <span>{action.label}</span>
        </button>
      ))}
      <button type="button" onClick={selection.exit}>
        <X width={22} height={22} strokeWidth={1.8} aria-hidden />
        <span>取消</span>
      </button>
      {selection.more.length > 0 && (
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
          <MoreVertical width={22} height={22} strokeWidth={1.8} aria-hidden />
          <span>更多</span>
        </button>
      )}
    </nav>
  </>
);
