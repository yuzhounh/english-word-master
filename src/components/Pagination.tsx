import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  pageSize: number; // 20, 50, 100, 200, or 0 (All)
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100, 200, 0], // 0 means "All"
  className = ''
}) => {
  if (totalItems <= 0) return null;

  const isAll = pageSize <= 0 || pageSize >= totalItems;
  const totalPages = isAll ? 1 : Math.ceil(totalItems / pageSize);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = isAll ? 1 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = isAll ? totalItems : Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page number array
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
    <div className={`bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 shadow-card flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}>
      {/* Top Row on Mobile / Left on Desktop: Total Info & Page Size */}
      <div className="flex items-center justify-between w-full sm:w-auto gap-3 text-xs text-slate-600 font-medium">
        <div>
          <span className="hidden sm:inline">
            显示 <strong className="text-slate-900 font-bold">{startItem}</strong> - <strong className="text-slate-900 font-bold">{endItem}</strong> 词，
          </span>
          共 <strong className="text-brand-600 font-extrabold">{totalItems}</strong> 词
          {!isAll && totalPages > 1 && (
            <span className="text-slate-400 ml-1">
              (第 <strong className="text-slate-800">{safeCurrentPage}</strong> / {totalPages} 页)
            </span>
          )}
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <span className="text-slate-400 font-normal text-[11px] sm:text-xs">每页:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              onPageSizeChange(newSize);
              onPageChange(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 hover:border-brand-400 focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 0 ? '全部' : `${opt} 词/页`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Page Navigation Buttons (Bottom Row on Mobile / Right on Desktop) */}
      {!isAll && totalPages > 1 && (
        <div className="w-full sm:w-auto flex justify-center overflow-x-auto py-0.5">
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 max-w-full shrink-0">
            {/* First Page */}
            <button
              onClick={() => onPageChange(1)}
              disabled={safeCurrentPage === 1}
              className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
              title="第一页"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Prev Page */}
            <button
              onClick={() => onPageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
              title="上一页"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-0.5 sm:gap-1 px-0.5">
              {getPageNumbers().map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs">
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
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => onPageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
              title="下一页"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
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
