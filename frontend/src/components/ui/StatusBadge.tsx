import React from 'react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '_');

  let colorClasses = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  switch (normalized) {
    case 'active':
    case 'present':
    case 'approved':
    case 'paid':
    case 'completed':
    case 'won':
    case 'available':
      colorClasses = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      break;
    case 'pending':
    case 'in_progress':
    case 'processing':
    case 'partially_paid':
    case 'probation':
    case 'sent':
    case 'contacted':
    case 'qualified':
    case 'proposal':
    case 'negotiation':
      colorClasses = 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      break;
    case 'inactive':
    case 'draft':
    case 'planning':
    case 'backlog':
    case 'todo':
    case 'new':
      colorClasses = 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      break;
    case 'overdue':
    case 'rejected':
    case 'cancelled':
    case 'terminated':
    case 'absent':
    case 'lost':
    case 'blocked':
    case 'repair':
    case 'critical':
      colorClasses = 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      break;
    case 'late':
    case 'half_day':
    case 'on_hold':
    case 'review':
    case 'notice_period':
      colorClasses = 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      break;
    case 'leave':
    case 'assigned':
    case 'locked':
      colorClasses = 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      break;
  }

  const formatText = (txt: string) => {
    return txt.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize whitespace-nowrap',
        colorClasses,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70"></span>
      {formatText(status)}
    </span>
  );
};
