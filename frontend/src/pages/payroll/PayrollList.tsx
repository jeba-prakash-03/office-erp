import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  DollarSign, Play, CheckCircle2, Lock, FileText, 
  Search, Filter, Calendar, AlertCircle 
} from 'lucide-react';
import { payrollApi } from '../../api/services';
import { Payroll } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCard } from '../../components/ui/StatsCard';
import { ProcessPayrollModal } from './ProcessPayrollModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

import { formatCurrency } from '../../utils/formatters';

export const PayrollList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [processModalOpen, setProcessModalOpen] = useState(false);

  // Pagination & search
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const res = await payrollApi.getAll({
        month,
        year,
        status: statusFilter || undefined,
        page,
        limit: 20,
      });

      setPayrolls(res.data.data.records || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load payroll records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrolls();
  }, [month, year, statusFilter, page]);

  const handleApprove = async (id: string | number) => {
    try {
      await payrollApi.approve(id);
      showNotification('success', 'Payroll slip approved and locked');
      fetchPayrolls();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to approve payroll');
    }
  };

  const handleMarkPaid = async (id: string | number) => {
    try {
      await payrollApi.markPaid(id, { payment_method: 'bank_transfer', payment_date: new Date().toISOString().substring(0, 10) });
      showNotification('success', 'Salary marked as paid successfully');
      fetchPayrolls();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to mark as paid');
    }
  };

  // Financial aggregates
  const totalNet = payrolls.reduce((acc, p) => acc + Number(p.net_salary || 0), 0);
  const totalGross = payrolls.reduce((acc, p) => acc + Number(p.gross_salary || 0), 0);
  const totalDeductions = payrolls.reduce((acc, p) => acc + Number(p.total_deductions || 0), 0);

  const columns: Column<Payroll>[] = [
    {
      header: 'Employee',
      accessor: (p) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-white">
            {p.employee_name || `Employee #${p.employee_id}`}
          </span>
          <div className="text-xs text-slate-500">{p.employee_code} • {p.department_name || 'Staff'}</div>
        </div>
      ),
    },
    {
      header: 'Basic Salary',
      accessor: (p) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {formatCurrency(p.basic_salary)}
        </span>
      ),
    },
    {
      header: 'Gross Salary',
      accessor: (p) => (
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          {formatCurrency(p.gross_salary)}
        </span>
      ),
    },
    {
      header: 'Deductions',
      accessor: (p) => (
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          -{formatCurrency(p.total_deductions)}
        </span>
      ),
    },
    {
      header: 'Net Salary',
      accessor: (p) => (
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(p.net_salary)}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (p) => <StatusBadge status={p.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            to={`/payroll/payslip/${p.id}`}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
            title="View Payslip"
          >
            <FileText className="w-4 h-4" />
          </Link>

          {p.status === 'generated' && hasPermission('payroll.edit') && (
            <button
              onClick={() => handleApprove(p.id)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              title="Approve & Lock"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}

          {p.status === 'approved' && hasPermission('payroll.edit') && (
            <button
              onClick={() => handleMarkPaid(p.id)}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
              title="Mark as Paid"
            >
              <DollarSign className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll & Salary Disbursal"
        subtitle="Calculate salaries, manage deductions, generate payslips, and record bank payouts"
        action={
          hasPermission('payroll.create') && (
            <button
              onClick={() => setProcessModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Play className="w-4 h-4" />
              Process Monthly Payroll
            </button>
          )
        }
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Gross Payroll"
          value={formatCurrency(totalGross)}
          icon={<DollarSign className="w-6 h-6" />}
        />
        <StatsCard
          title="Total Deductions (Tax & Leaves)"
          value={`-${formatCurrency(totalDeductions)}`}
          icon={<AlertCircle className="w-6 h-6" />}
        />
        <StatsCard
          title="Total Net Salary Payout"
          value={formatCurrency(totalNet)}
          icon={<CheckCircle2 className="w-6 h-6" />}
        />
      </div>

      {/* Filter and Date Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Period:</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2026, i, 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-20 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

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
          <option value="generated">Generated</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Payroll Records Table */}
      <DataTable
        columns={columns}
        data={payrolls}
        keyField="id"
        loading={loading}
        emptyMessage="No payroll records generated for this period. Click 'Process Monthly Payroll' to generate."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {/* Process Payroll Modal */}
      {processModalOpen && (
        <ProcessPayrollModal
          isOpen={processModalOpen}
          onClose={() => setProcessModalOpen(false)}
          onSuccess={fetchPayrolls}
        />
      )}
    </div>
  );
};
