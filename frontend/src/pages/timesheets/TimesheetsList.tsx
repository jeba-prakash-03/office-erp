import React, { useState, useEffect } from 'react';
import { 
  Clock, Plus, Check, X, Search, Filter, 
  Calendar, CheckCircle2, User 
} from 'lucide-react';
import { timesheetsApi } from '../../api/services';
import { Timesheet } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCard } from '../../components/ui/StatsCard';
import { TimesheetModal } from './TimesheetModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const TimesheetsList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchTimesheets = async () => {
    try {
      setLoading(true);
      const res = await timesheetsApi.getAll({
        status: statusFilter || undefined,
        page,
        limit: 15,
      });
      setTimesheets(res.data.data.timesheets || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load timesheet records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheets();
  }, [statusFilter, page]);

  const handleApprove = async (id: string | number) => {
    try {
      await timesheetsApi.approve(id);
      showNotification('success', 'Timesheet entry approved');
      fetchTimesheets();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to approve timesheet');
    }
  };

  const handleReject = async (id: string | number) => {
    try {
      await timesheetsApi.reject(id);
      showNotification('success', 'Timesheet entry rejected');
      fetchTimesheets();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to reject timesheet');
    }
  };

  const totalHours = timesheets.reduce((acc, t) => acc + Number(t.hours || 0), 0);

  const columns: Column<Timesheet>[] = [
    {
      header: 'Employee',
      accessor: (t) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-white">
            {t.employee_name || `Employee #${t.employee_id}`}
          </span>
          <div className="text-xs text-slate-500">{t.employee_code}</div>
        </div>
      ),
    },
    {
      header: 'Project & Task',
      accessor: (t) => (
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {t.project_name || 'General Project'}
          </span>
          {t.task_title && (
            <div className="text-xs text-slate-500 truncate max-w-[200px]">{t.task_title}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Date',
      accessor: (t) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {t.date ? t.date.substring(0, 10) : '—'}
        </span>
      ),
    },
    {
      header: 'Hours',
      accessor: (t) => (
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
          {Number(t.hours || 0).toFixed(1)} hrs {t.is_billable ? '• Billable' : ''}
        </span>
      ),
    },
    {
      header: 'Description',
      accessor: (t) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 max-w-[220px]" title={t.description}>
          {t.description}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (t) => <StatusBadge status={t.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          {t.status === 'submitted' && hasPermission('timesheets.approve') && (
            <>
              <button
                onClick={() => handleApprove(t.id)}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
                title="Approve Entry"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleReject(t.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                title="Reject Entry"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets & Time Tracking"
        subtitle="Log billable project hours, track sprint efforts, and approve employee submissions"
        action={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Log Timesheet
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard
          title="Total Logged Entries"
          value={totalRecords.toString()}
          icon={<Clock className="w-6 h-6" />}
        />
        <StatsCard
          title="Total Hours Recorded"
          value={`${totalHours.toFixed(1)} hrs`}
          icon={<CheckCircle2 className="w-6 h-6" />}
        />
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={timesheets}
        keyField="id"
        loading={loading}
        emptyMessage="No timesheet records found."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {modalOpen && (
        <TimesheetModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchTimesheets}
        />
      )}
    </div>
  );
};
