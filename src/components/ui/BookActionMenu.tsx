import React, { useEffect, useRef, useState } from 'react';
import { Upload, Download, BookOpen, Trash2, X, ChevronLeft, FileJson, FileSpreadsheet } from 'lucide-react';
import { useBackHandler } from '../../hooks/useBackHandler';

interface Props {
  name: string;
  count: number;
  onClose: () => void;
  onImport: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onTest: () => void;
  onDelete?: () => void;
}
export function BookActionMenu({ name, count, onClose, onImport, onExportJSON, onExportCSV, onTest, onDelete }: Props) {
  const [exporting, setExporting] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useBackHandler(() => { if (exporting) setExporting(false); else onClose(); return true; }, 20);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  const run = (action: () => void) => { onClose(); action(); };
  const item = 'flex items-center gap-3 w-full min-h-12 px-3 py-2 text-sm text-left rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-40';
  return <div className="book-action-mask fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-end sm:items-center justify-center p-3" onClick={onClose}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={`${name}管理`} tabIndex={-1} onClick={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key !== 'Tab') return; const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'); if (!buttons?.length) return; const first = buttons[0], last = buttons[buttons.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { e.preventDefault(); first.focus(); } }}
      className="surface-card rounded-3xl p-2 w-full max-w-sm shadow-elevated max-h-[90dvh] overflow-y-auto outline-none">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700 mb-1">
        {exporting && <button type="button" aria-label="返回管理菜单" onClick={() => setExporting(false)} className="w-10 h-10 flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>}
        <div className="min-w-0 flex-1"><h3 className="text-primary font-bold truncate" title={name}>{name}</h3><p className="text-muted text-xs">{count} 词</p></div>
        <button type="button" aria-label="关闭词本菜单" onClick={onClose} className="w-10 h-10 flex items-center justify-center text-secondary"><X className="w-5 h-5" /></button>
      </div>
      {exporting ? <>
        <button className={item} onClick={() => run(onExportJSON)}><FileJson className="w-5 h-5 text-brand-500" />导出 JSON 文件</button>
        <button className={item} onClick={() => run(onExportCSV)}><FileSpreadsheet className="w-5 h-5 text-emerald-500" />导出 CSV 表格</button>
      </> : <>
        <button className={`${item} text-primary`} onClick={() => run(onImport)}><Upload className="w-5 h-5 text-brand-500" />导入词汇</button>
        <button className={`${item} text-primary`} disabled={!count} onClick={() => setExporting(true)}><Download className="w-5 h-5 text-brand-500" />导出词汇</button>
        <button className={`${item} text-primary`} disabled={!count} onClick={() => run(onTest)}><BookOpen className="w-5 h-5 text-brand-500" />测试词本</button>
        {onDelete && <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1"><button className={`${item} text-red-600 dark:text-red-400`} onClick={() => run(onDelete)}><Trash2 className="w-5 h-5" />删除词本</button></div>}
      </>}
    </div>
  </div>;
}
