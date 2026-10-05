import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon | React.ReactNode;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
  iconBgColor?: string;
  iconColor?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  change,
  changeType = 'neutral',
  subtitle,
  iconBgColor = 'bg-indigo-50 dark:bg-indigo-950/50',
  iconColor = 'text-indigo-600 dark:text-indigo-400',
}) => {
  const isIconComponent = typeof icon === 'function' || (typeof icon === 'object' && icon !== null && 'render' in icon);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</p>
        <div className={clsx('p-2.5 rounded-lg', iconBgColor, iconColor)}>
          {isIconComponent ? React.createElement(icon as LucideIcon, { className: 'w-5 h-5' }) : icon}
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {value}
        </h3>
        {change && (
          <span
            className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              changeType === 'positive' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
              changeType === 'negative' && 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
              changeType === 'neutral' && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            {change}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
      )}
    </div>
  );
};
