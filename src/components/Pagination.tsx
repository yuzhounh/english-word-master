import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  pageSize: number; // 30, 50, 100, or 0 (All)
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const DEFAULT_PAGE_SIZE_OPTIONS = [30, 50, 100, 0];

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className = ''
}) => {
  if (totalItems <= 0) return null;

  const isAll = pageSize <= 0 || pageSize >= totalItems;
  const totalPages = isAll ? 1 : Math.ceil(totalItems / pageSize);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = isAll ? 1 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = isAll ? totalItems : Math.min(safeCurrentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);
    if (safeCurrentPage > 3) pages.push('...');

    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (safeCurrentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className={`surface-card rounded-xl p-3 sm:p-4 shadow-card flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center justify-between w-full sm:w-auto gap-3 text-xs text-secondary font-medium">
        <div>
          <span className="hidden sm:inline">
            显示 <strong className="text-primary font-bold">{startItem}</strong> - <strong className="text-primary font-bold">{endItem}</strong> 词，
          </span>
          共 <strong className="text-brand-600 dark:text-brand-400 font-extrabold">{totalItems}</strong> 词
          {!isAll && totalPages > 1 && (
            <span className="text-muted ml-1">
              (第 <strong className="text-primary">{safeCurrentPage}</strong> / {totalPages} 页)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <span className="text-muted font-normal text-[11px] sm:text-xs">每页:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              onPageSizeChange(newSize);
              onPageChange(1);
            }}
            className="surface-input rounded-lg px-2 py-1 text-xs font-bold hover:border-brand-400 focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 0 ? '全部' : `${opt} 词/页`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isAll && totalPages > 1 && (
        <div className="w-full sm:w-auto flex justify-center overflow-x-auto py-0.5">
          <div className="flex items-center gap-0.5 sm:gap-1 surface-muted p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 max-w-full shrink-0">
            <button
              onClick={() => onPageChange(1)}
              disabled={safeCurrentPage === 1}
              className="p-1 sm:p-1.5 rounded-lg text-muted hover:text-primary hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
              title="第一页"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => onPageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              className="p-1 sm:p-1.5 rounded-lg text-muted hover:text-primary hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
              title="上一页"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-0.5 sm:gap-1 px-0.5">
              {getPageNumbers().map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-muted text-xs">
                      ...
                    </span>
                  );
                }
                const isActive = p === safeCurrentPage;
                return (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`min-w-[28px] h-7 px-1.5 sm:px-2 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? 'gradient-brand text-white shadow-sm'
                        : 'text-secondary hover:bg-white dark:hover:bg-slate-700 hover:text-primary'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              className="p-1 sm:p-1.5 rounded-lg text-muted hover:text-primary hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
              title="下一页"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onPageChange(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="p-1 sm:p-1.5 rounded-lg text-muted hover:text-primary hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
              title="最后一页"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
