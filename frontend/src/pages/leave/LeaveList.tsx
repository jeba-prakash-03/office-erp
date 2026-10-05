import React, { useState, useEffect } from 'react';
import { 
  Calendar, Check, X, Plus, Filter, Search, 
  Clock, AlertCircle, User, ShieldCheck 
} from 'lucide-react';
import { leaveApi } from '../../api/services';
import { LeaveApplication, LeaveBalance } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ApplyLeaveModal } from './ApplyLeaveModal';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const LeaveList: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  // Approval modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected'>('approved');
  const [remarks, setRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchLeaveData = async () => {
    try {
      setLoading(true);
      const [appRes, balRes] = await Promise.all([
        leaveApi.getAll({
          status: statusFilter || undefined,
          page,
          limit: 15,
        }),
        leaveApi.getBalances(),
      ]);

      setApplications(appRes.data.data.applications || appRes.data.data);
      if (appRes.data.data.pagination) {
        setTotalPages(appRes.data.data.pagination.totalPages || 1);
        setTotalRecords(appRes.data.data.pagination.total || 0);
      }
      setBalances(balRes.data.data || []);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load leave records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, [page, statusFilter]);

  const handleOpenActionModal = (app: LeaveApplication, type: 'approved' | 'rejected') => {
    setSelectedApp(app);
    setActionType(type);
    setRemarks('');
    setActionModalOpen(true);
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setSubmittingAction(true);
    try {
      if (actionType === 'approved') {
        await leaveApi.approve(selectedApp.id, { remarks });
        showNotification('success', 'Leave application approved');
      } else {
        await leaveApi.reject(selectedApp.id, { rejection_reason: remarks });
        showNotification('success', 'Leave application rejected');
      }
      setActionModalOpen(false);
      fetchLeaveData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to update leave application');
    } finally {
      setSubmittingAction(false);
    }
  };

  const columns: Column<LeaveApplication>[] = [
    {
      header: 'Employee',
      accessor: (l) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-white">
            {l.employee_name || `Employee #${l.employee_id}`}
          </span>
          <div className="text-xs text-slate-500">{l.employee_code}</div>
        </div>
      ),
    },
    {
      header: 'Leave Type',
      accessor: (l) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
          {l.leave_type_name || 'Standard'}
        </span>
      ),
    },
    {
      header: 'Duration',
      accessor: (l) => (
        <div className="text-xs text-slate-700 dark:text-slate-300">
          <div>{l.start_date?.substring(0, 10)} to {l.end_date?.substring(0, 10)}</div>
          <span className="text-slate-500">{l.total_days} {Number(l.total_days) === 1 ? 'day' : 'days'}</span>
        </div>
      ),
    },
    {
      header: 'Reason',
      accessor: (l) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 max-w-[200px]" title={l.reason}>
          {l.reason}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (l) => <StatusBadge status={l.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (l) => (
        <div className="flex items-center justify-end gap-1.5">
          {l.status === 'pending' && (hasPermission('leave.approve') || user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'hr_manager') && (
            <>
              <button
                onClick={() => handleOpenActionModal(l, 'approved')}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
                title="Approve Leave"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleOpenActionModal(l, 'rejected')}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                title="Reject Leave"
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
        title="Leave Management"
        subtitle="Manage employee leave requests, approvals, and annual time-off balances"
        action={
          <button
            onClick={() => setApplyModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Apply for Leave
          </button>
        }
      />

      {/* Leave Balances Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {balances.map((b) => (
            <div
              key={b.id}
              className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {b.leave_type_name || 'Leave Type'}
                </span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  {b.allocated_days} Total
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {b.remaining_days}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">days left</span>
                </div>
                <span className="text-xs text-slate-400">
                  {b.used_days} used
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
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
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={applications}
        keyField="id"
        loading={loading}
        emptyMessage="No leave applications found."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {/* Apply Leave Modal */}
      {applyModalOpen && (
        <ApplyLeaveModal
          isOpen={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
          onSuccess={fetchLeaveData}
        />
      )}

      {/* Approval / Rejection Modal */}
      <Modal
        isOpen={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={actionType === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
        size="sm"
      >
        <form onSubmit={handleConfirmAction} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {actionType === 'approved'
              ? `Are you sure you want to approve leave for ${selectedApp?.employee_name}?`
              : `Are you sure you want to reject leave for ${selectedApp?.employee_name}?`}
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {actionType === 'approved' ? 'Remarks (Optional)' : 'Rejection Reason *'}
            </label>
            <textarea
              rows={3}
              required={actionType === 'rejected'}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter details..."
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActionModalOpen(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingAction}
              className={`px-4 py-2 text-white rounded-lg text-xs font-medium ${
                actionType === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submittingAction ? 'Processing...' : actionType === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
