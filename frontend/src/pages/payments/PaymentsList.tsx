import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CreditCard, Plus, Search, Filter, Calendar, 
  CheckCircle2, DollarSign, FileText 
} from 'lucide-react';
import { paymentsApi } from '../../api/services';
import { Payment } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatsCard } from '../../components/ui/StatsCard';
import { RecordPaymentModal } from './RecordPaymentModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const PaymentsList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await paymentsApi.getAll({
        page,
        limit: 15,
      });
      setPayments(res.data.data.payments || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load payment transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page]);

  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const columns: Column<Payment>[] = [
    {
      header: 'Invoice #',
      accessor: (p) => (
        <Link
          to={`/invoices/${p.invoice_id}`}
          className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {p.invoice_number || `INV-#${p.invoice_id}`}
        </Link>
      ),
    },
    {
      header: 'Client',
      accessor: (p) => (
        <span className="font-semibold text-slate-900 dark:text-white">
          {p.client_name || 'Client'}
        </span>
      ),
    },
    {
      header: 'Payment Date',
      accessor: (p) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {p.payment_date ? p.payment_date.substring(0, 10) : '—'}
        </span>
      ),
    },
    {
      header: 'Method',
      accessor: (p) => (
        <span className="text-xs capitalize font-medium text-slate-700 dark:text-slate-300">
          {p.payment_method?.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Reference ID',
      accessor: (p) => (
        <span className="text-xs font-mono text-slate-500">
          {p.transaction_reference || '—'}
        </span>
      ),
    },
    {
      header: 'Amount Paid',
      align: 'right',
      accessor: (p) => (
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          ${Number(p.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Transactions"
        subtitle="Real-time register of client invoice settlements and payments"
        action={
          hasPermission('invoices.edit') && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Record Payment
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard
          title="Total Transactions Logged"
          value={totalRecords.toString()}
          icon={<CreditCard className="w-6 h-6" />}
        />
        <StatsCard
          title="Total Collected Revenue"
          value={`$${totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="w-6 h-6 text-emerald-500" />}
        />
      </div>

      <DataTable
        columns={columns}
        data={payments}
        keyField="id"
        loading={loading}
        emptyMessage="No payment transactions found."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {modalOpen && (
        <RecordPaymentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchPayments}
        />
      )}
    </div>
  );
};
