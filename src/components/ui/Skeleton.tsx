import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/60 ${className}`} />
);

export const WordCardSkeleton: React.FC = () => (
  <div className="rounded-[var(--radius-card)] border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-4 space-y-3 shadow-card">
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <Skeleton className="h-12 w-full rounded-xl" />
    <Skeleton className="h-16 w-full rounded-xl" />
  </div>
);

export const WordGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <WordCardSkeleton key={i} />
    ))}
  </div>
);

export const LibraryTreeSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 9 }).map((_, i) => (
      <div
        key={i}
        className="rounded-[var(--radius-card)] border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-5 shadow-card flex items-center gap-3"
      >
        <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);
