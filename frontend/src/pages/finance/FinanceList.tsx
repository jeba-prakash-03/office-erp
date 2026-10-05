import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Plus, ArrowUpRight, 
  ArrowDownRight, FileText, Download, Calendar, Filter, Trash2 
} from 'lucide-react';
import { financeApi } from '../../api/services';
import { Income, Expense, ProfitLossSummary } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatsCard } from '../../components/ui/StatsCard';
import { IncomeModal } from './IncomeModal';
import { ExpenseModal } from './ExpenseModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const FinanceList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [activeTab, setActiveTab] = useState<'overview' | 'incomes' | 'expenses'>('overview');
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ProfitLossSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const [incRes, expRes, sumRes] = await Promise.all([
        financeApi.getIncomes({ ...params, limit: 50 }),
        financeApi.getExpenses({ ...params, limit: 50 }),
        financeApi.getProfitLoss(params),
      ]);

      setIncomes(incRes.data.data.incomes || incRes.data.data);
      setExpenses(expRes.data.data.expenses || expRes.data.data);
      setSummary(sumRes.data.data);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load financial records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [startDate, endDate]);

  const incomeColumns: Column<Income>[] = [
    {
      header: 'Title & Source',
      accessor: (i) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white">{i.title}</span>
          <div className="text-xs text-slate-500">{i.client_name ? `Client: ${i.client_name}` : 'General Income'}</div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: (i) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 capitalize">
          {i.category.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Date',
      accessor: (i) => <span className="text-xs text-slate-600 dark:text-slate-300">{i.date ? i.date.substring(0, 10) : '—'}</span>,
    },
    {
      header: 'Method & Ref',
      accessor: (i) => (
        <span className="text-xs text-slate-500">
          {i.payment_method?.replace('_', ' ')} {i.reference_number ? `(${i.reference_number})` : ''}
        </span>
      ),
    },
    {
      header: 'Amount',
      align: 'right',
      accessor: (i) => (
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          +${Number(i.amount || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  const expenseColumns: Column<Expense>[] = [
    {
      header: 'Expense Item',
      accessor: (e) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white">{e.title}</span>
          <div className="text-xs text-slate-500">{e.vendor ? `Vendor: ${e.vendor}` : 'General'}</div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: (e) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
          {e.category_name || 'Expense'}
        </span>
      ),
    },
    {
      header: 'Date',
      accessor: (e) => <span className="text-xs text-slate-600 dark:text-slate-300">{e.date ? e.date.substring(0, 10) : '—'}</span>,
    },
    {
      header: 'Receipt',
      accessor: (e) => (
        e.receipt_url ? (
          <a
            href={e.receipt_url.startsWith('http') ? e.receipt_url : `http://localhost:5000/${e.receipt_url}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            Receipt
          </a>
        ) : (
          <span className="text-xs text-slate-400">No file</span>
        )
      ),
    },
    {
      header: 'Amount',
      align: 'right',
      accessor: (e) => (
        <span className="text-sm font-bold text-red-600 dark:text-red-400">
          -${Number(e.amount || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  const totalIncome = summary?.total_income || 0;
  const totalExpense = summary?.total_expense || 0;
  const netProfit = summary?.net_profit || (totalIncome - totalExpense);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & Accounting"
        subtitle="Track income streams, operational expenses, profit & loss, and receipts"
        action={
          <div className="flex items-center gap-2">
            {hasPermission('finance.create') && (
              <>
                <button
                  onClick={() => setIncomeModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Income
                </button>
                <button
                  onClick={() => setExpenseModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Expense
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Financial Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Recorded Income"
          value={`$${Number(totalIncome).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<TrendingUp className="w-6 h-6 text-emerald-500" />}
        />
        <StatsCard
          title="Total Operating Expenses"
          value={`$${Number(totalExpense).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<TrendingDown className="w-6 h-6 text-red-500" />}
        />
        <StatsCard
          title="Net Profit / (Loss)"
          value={`$${Number(netProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="w-6 h-6 text-indigo-500" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Profit & Loss Statement
        </button>
        <button
          onClick={() => setActiveTab('incomes')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'incomes'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Incomes ({incomes.length})
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'expenses'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Expenses ({expenses.length})
        </button>
      </div>

      {/* TAB CONTENT: P&L Statement */}
      {activeTab === 'overview' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Financial Performance Summary
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Live Real-Time Calculation
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Income Streams */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
                Top Income Sources
              </h4>
              <div className="space-y-2.5">
                {incomes.slice(0, 5).map((inc) => (
                  <div key={inc.id} className="flex justify-between items-center text-xs p-2.5 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{inc.title}</span>
                    <span className="font-bold text-emerald-600">+${Number(inc.amount).toLocaleString()}</span>
                  </div>
                ))}
                {incomes.length === 0 && <p className="text-xs text-slate-400">No income entries recorded.</p>}
              </div>
            </div>

            {/* Expense Categories */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-3">
                Recent Expenses
              </h4>
              <div className="space-y-2.5">
                {expenses.slice(0, 5).map((exp) => (
                  <div key={exp.id} className="flex justify-between items-center text-xs p-2.5 bg-red-50/40 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/40">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{exp.title}</span>
                    <span className="font-bold text-red-600">-${Number(exp.amount).toLocaleString()}</span>
                  </div>
                ))}
                {expenses.length === 0 && <p className="text-xs text-slate-400">No expense entries recorded.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Incomes Table */}
      {activeTab === 'incomes' && (
        <DataTable
          columns={incomeColumns}
          data={incomes}
          keyField="id"
          loading={loading}
          emptyMessage="No income records found."
        />
      )}

      {/* TAB CONTENT: Expenses Table */}
      {activeTab === 'expenses' && (
        <DataTable
          columns={expenseColumns}
          data={expenses}
          keyField="id"
          loading={loading}
          emptyMessage="No expense records found."
        />
      )}

      {/* Income Modal */}
      {incomeModalOpen && (
        <IncomeModal
          isOpen={incomeModalOpen}
          onClose={() => setIncomeModalOpen(false)}
          onSuccess={fetchFinanceData}
        />
      )}

      {/* Expense Modal */}
      {expenseModalOpen && (
        <ExpenseModal
          isOpen={expenseModalOpen}
          onClose={() => setExpenseModalOpen(false)}
          onSuccess={fetchFinanceData}
        />
      )}
    </div>
  );
};
