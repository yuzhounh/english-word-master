import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => (
  <div className="rounded-[var(--radius-card)] border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-12 text-center space-y-3 shadow-card">
    <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/30 text-brand-500 rounded-full flex items-center justify-center mx-auto">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-base">{title}</h3>
    {description && (
      <p className="text-slate-400 dark:text-slate-500 text-sm max-w-sm mx-auto">{description}</p>
    )}
    {action && <div className="pt-2">{action}</div>}
  </div>
);
