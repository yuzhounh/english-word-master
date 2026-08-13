import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  badge?: string;
  badgeIcon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  stats?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  badge,
  badgeIcon: BadgeIcon,
  title,
  description,
  action,
  stats,
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
    <div className="absolute inset-x-0 top-0 h-1 gradient-brand" />
    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-100/40 blur-3xl pointer-events-none" />
    <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-accent-500/5 blur-2xl pointer-events-none" />

    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 sm:p-8">
      <div className="space-y-3 min-w-0">
        {badge && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-100">
            {BadgeIcon && <BadgeIcon className="w-3.5 h-3.5" />}
            <span>{badge}</span>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && (
          <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">{description}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
        {stats}
        {action}
      </div>
    </div>
  </div>
);
