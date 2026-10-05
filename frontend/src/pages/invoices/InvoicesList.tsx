import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Plus, Search, Filter, Eye, Download, 
  DollarSign, CheckCircle2, AlertCircle, Clock 
} from 'lucide-react';
import { invoicesApi } from '../../api/services';
import { Invoice } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCard } from '../../components/ui/StatsCard';
import { InvoiceModal } from './InvoiceModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const InvoicesList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await invoicesApi.getAll({
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        limit: 15,
      });
      setInvoices(res.data.data.invoices || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, search, page]);

  const totalInvoiced = invoices.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + Number(inv.paid_amount || 0), 0);
  const totalPending = totalInvoiced - totalPaid;

  const columns: Column<Invoice>[] = [
    {
      header: 'Invoice #',
      accessor: (i) => (
        <Link
          to={`/invoices/${i.id}`}
          className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {i.invoice_number}
        </Link>
      ),
    },
    {
      header: 'Client & Project',
      accessor: (i) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white">
            {i.client?.company_name || i.client_name || 'Client'}
          </span>
          {i.project_name && (
            <div className="text-xs text-slate-500">{i.project_name}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Issue / Due Date',
      accessor: (i) => (
        <div className="text-xs text-slate-600 dark:text-slate-300">
          <div>{i.issue_date?.substring(0, 10)}</div>
          <span className="text-slate-400">Due: {i.due_date?.substring(0, 10)}</span>
        </div>
      ),
    },
    {
      header: 'Total Amount',
      accessor: (i) => (
        <span className="text-xs font-bold text-slate-900 dark:text-white">
          ${Number(i.total_amount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Paid Amount',
      accessor: (i) => (
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          ${Number(i.paid_amount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (i) => <StatusBadge status={i.status} />,
    },
    {
      header: 'Action',
      align: 'right',
      accessor: (i) => (
        <Link
          to={`/invoices/${i.id}`}
          className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded inline-flex items-center gap-1 text-xs font-medium"
        >
          <Eye className="w-4 h-4" />
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Invoicing & Billing"
        subtitle="Generate itemized invoices, manage accounts receivable, and track payment receipts"
        action={
          hasPermission('invoices.create') && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          )
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Invoiced Value"
          value={`$${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<FileText className="w-6 h-6" />}
        />
        <StatsCard
          title="Total Collected"
          value={`$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<CheckCircle2 className="w-6 h-6" />}
        />
        <StatsCard
          title="Outstanding Receivables"
          value={`$${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<Clock className="w-6 h-6" />}
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice number or client..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
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
          <option value="sent">Sent / Unpaid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        keyField="id"
        loading={loading}
        emptyMessage="No invoices found."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {modalOpen && (
        <InvoiceModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchInvoices}
        />
      )}
    </div>
  );
};
