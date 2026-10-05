import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Plus, Check, X, Search, Filter, 
  DollarSign, Clock, Calendar 
} from 'lucide-react';
import { loansApi } from '../../api/services';
import { Loan } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCard } from '../../components/ui/StatsCard';
import { LoanModal } from './LoanModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const LoansList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const res = await loansApi.getAll({
        status: statusFilter || undefined,
        page,
        limit: 15,
      });
      setLoans(res.data.data.loans || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load loan requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [statusFilter, page]);

  const handleApprove = async (id: string | number) => {
    try {
      await loansApi.approve(id);
      showNotification('success', 'Loan request approved');
      fetchLoans();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to approve loan');
    }
  };

  const handleReject = async (id: string | number) => {
    try {
      await loansApi.reject(id, { rejection_reason: 'Does not meet loan requirements' });
      showNotification('success', 'Loan request rejected');
      fetchLoans();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to reject loan');
    }
  };

  const totalDisbursed = loans
    .filter((l) => l.status === 'approved' || l.status === 'repaying' || l.status === 'completed')
    .reduce((acc, l) => acc + Number(l.amount || 0), 0);

  const columns: Column<Loan>[] = [
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
      header: 'Type',
      accessor: (l) => (
        <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
          {l.type.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Principal Amount',
      accessor: (l) => (
        <span className="text-xs font-bold text-slate-900 dark:text-white">
          ${Number(l.amount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Monthly Deduction',
      accessor: (l) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          ${Number(l.monthly_deduction || 0).toLocaleString()} / mo ({l.repayment_months} mos)
        </span>
      ),
    },
    {
      header: 'Remaining Balance',
      accessor: (l) => (
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          ${Number(l.remaining_amount !== undefined ? l.remaining_amount : l.amount).toLocaleString()}
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
          {l.status === 'pending' && hasPermission('loans.approve') && (
            <>
              <button
                onClick={() => handleApprove(l.id)}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
                title="Approve Loan"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleReject(l.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                title="Reject Loan"
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
        title="Loans & Salary Advances"
        subtitle="Manage employee loan disbursements, automated monthly deductions, and balances"
        action={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Apply for Loan
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard
          title="Total Active Loan Requests"
          value={totalRecords.toString()}
          icon={<CreditCard className="w-6 h-6" />}
        />
        <StatsCard
          title="Total Approved Disbursal"
          value={`$${totalDisbursed.toLocaleString()}`}
          icon={<DollarSign className="w-6 h-6" />}
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
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={loans}
        keyField="id"
        loading={loading}
        emptyMessage="No loan applications found."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {modalOpen && (
        <LoanModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchLoans}
        />
      )}
    </div>
  );
};
