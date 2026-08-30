import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  badge?: string;
  badgeIcon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  stats?: React.ReactNode;
  compactOnMobile?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  badge,
  badgeIcon: BadgeIcon,
  title,
  description,
  action,
  stats,
  compactOnMobile = false,
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 shadow-card">
    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-slate-100/40 dark:bg-slate-700/20 blur-3xl pointer-events-none" />

    <div className={`relative z-10 flex flex-col md:flex-row md:items-center justify-between ${compactOnMobile ? 'gap-4 px-5 py-5 sm:gap-6 sm:p-8' : 'gap-6 p-6 sm:p-8'}`}>
      <div className={`${compactOnMobile ? 'space-y-2.5 sm:space-y-3' : 'space-y-3'} min-w-0`}>
        {badge && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-semibold border border-brand-100 dark:border-brand-800">
            {BadgeIcon && <BadgeIcon className="w-3.5 h-3.5" />}
            <span>{badge}</span>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        {description && (
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-2xl">{description}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
        {stats}
        {action}
      </div>
    </div>
  </div>
);
