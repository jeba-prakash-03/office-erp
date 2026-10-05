import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  action,
  actions,
  breadcrumbs,
}) => {
  const displaySubtitle = subtitle || description;
  const displayActions = action || actions;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                {b.href ? (
                  <a href={b.href} className="hover:text-indigo-600 transition-colors">
                    {b.label}
                  </a>
                ) : (
                  <span className="text-slate-800 dark:text-slate-200">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {displaySubtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {displaySubtitle}
          </p>
        )}
      </div>

      {displayActions && <div className="flex items-center gap-3 flex-shrink-0">{displayActions}</div>}
    </div>
  );
};
