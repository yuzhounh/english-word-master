import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  className = '',
  showLabel = false,
}) => {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-medium text-muted">
          <span>进度</span>
          <span>
            <span className="text-brand-600 dark:text-brand-400 font-bold">{value}</span> / {max}
            <span className="text-slate-400 dark:text-slate-500 ml-1">({percent}%)</span>
          </span>
        </div>
      )}
      <div className="h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out bg-slate-400 dark:bg-slate-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
