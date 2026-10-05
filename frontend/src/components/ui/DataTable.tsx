import React from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface Column<T> {
  key?: string;
  header: string;
  accessor?: (item: T) => React.ReactNode;
  render?: (item: T) => React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  keyField?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  headerActions?: React.ReactNode;
  pagination?: {
    page: number;
    limit?: number;
    total?: number;
    totalRecords?: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data = [],
  loading,
  error,
  onRetry,
  keyField = 'id',
  emptyTitle,
  emptyDescription,
  emptyMessage = 'No records matching your criteria.',
  emptyAction,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  headerActions,
  pagination,
}: DataTableProps<T> & { error?: string | null; onRetry?: () => void }) {
  const displayEmptyTitle = emptyTitle || 'No records found';
  const displayEmptyDesc = emptyDescription || emptyMessage;

  const totalEntries = pagination ? (pagination.total !== undefined ? pagination.total : pagination.totalRecords || data.length) : data.length;
  const pageSize = pagination?.limit || 15;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col transition-all">
      {/* Table Toolbar */}
      {(onSearchChange || headerActions) && (
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          {onSearchChange ? (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>
          ) : <div />}
          {headerActions && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[200px] relative">
        {error ? (
          <div className="p-6">
            <ErrorState title="Unable to Load Table Data" message={error} onRetry={onRetry} />
          </div>
        ) : loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="py-16">
            <EmptyState title={displayEmptyTitle} description={displayEmptyDesc} action={emptyAction} />
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                {columns.map((col, idx) => (
                  <th
                    key={col.key || idx}
                    className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {data.map((item: any, rowIdx) => (
                <tr
                  key={item[keyField] !== undefined ? String(item[keyField]) : rowIdx}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={`py-3 px-4 text-slate-700 dark:text-slate-300 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
                    >
                      {col.accessor
                        ? col.accessor(item)
                        : col.render
                        ? col.render(item)
                        : col.key
                        ? item[col.key]
                        : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {pagination && (pagination.totalPages > 1 || totalEntries > 0) && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(pagination.page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {Math.min(pagination.page * pageSize, totalEntries)}
            </span>{' '}
            of <span className="font-semibold text-slate-700 dark:text-slate-300">{totalEntries}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-medium">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
