import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Plus,
  Search,
  DollarSign,
  PieChart as PieIcon,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
  Lock,
  FileText,
  Calendar,
  Building,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { investmentApi } from '../../api/services';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../utils/formatters';
import { Investment } from '../../types';

export const InvestmentsList: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [summary, setSummary] = useState<any>({
    totalInvested: 0,
    totalCurrentValue: 0,
    netGain: 0,
    overallReturnPct: 0,
    activeCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Equity',
    amount: '',
    currentValue: '',
    returnRate: '',
    date: new Date().toISOString().split('T')[0],
    source: '',
    status: 'active',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Security Check: strictly Super Admin
  if (user?.roleName !== 'super_admin') {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Restricted Access</h2>
        <p className="text-sm text-slate-500">
          The Investment Portfolio module contains confidential company capitalization data and is strictly restricted to Super Administrators.
        </p>
      </div>
    );
  }

  const fetchInvestments = async () => {
    try {
      setLoading(true);
      const res = await investmentApi.getAll();
      if (res.data?.success) {
        setInvestments(res.data.data.investments || []);
        setSummary(res.data.data.summary || {});
      }
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to load investments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestments();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      type: 'Equity',
      amount: '',
      currentValue: '',
      returnRate: '',
      date: new Date().toISOString().split('T')[0],
      source: '',
      status: 'active',
      notes: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (inv: Investment) => {
    setEditingId(inv.id);
    setFormData({
      name: inv.name,
      type: inv.type || 'Equity',
      amount: String(inv.amount),
      currentValue: String(inv.current_value || inv.amount),
      returnRate: String(inv.return_rate || 0),
      date: inv.date.split('T')[0],
      source: inv.source || '',
      status: inv.status || 'active',
      notes: inv.notes || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount || !formData.date) {
      showNotification('error', 'Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: formData.name,
        type: formData.type,
        amount: Number(formData.amount),
        currentValue: formData.currentValue ? Number(formData.currentValue) : Number(formData.amount),
        returnRate: formData.returnRate ? Number(formData.returnRate) : 0,
        date: formData.date,
        source: formData.source,
        status: formData.status,
        notes: formData.notes,
      };

      if (editingId) {
        await investmentApi.update(editingId, payload);
        showNotification('success', 'Investment record updated successfully');
      } else {
        await investmentApi.create(payload);
        showNotification('success', 'New investment recorded successfully');
      }

      setModalOpen(false);
      fetchInvestments();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete investment "${name}"? This action will be recorded in the security audit log.`)) {
      return;
    }
    try {
      await investmentApi.delete(id);
      showNotification('success', 'Investment deleted');
      fetchInvestments();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Delete failed');
    }
  };

  const filteredInvestments = investments.filter((inv) => {
    const matchesSearch = inv.name.toLowerCase().includes(search.toLowerCase()) ||
      (inv.source && inv.source.toLowerCase().includes(search.toLowerCase())) ||
      inv.type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Corporate Investments</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <Lock className="w-3 h-3" />
              Super Admin Confidential
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track company capital allocations, venture equity, treasuries, and portfolio returns.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Add Investment
        </button>
      </div>

      {/* KPI Portfolio Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Invested</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {formatCurrency(summary.totalInvested || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Principal capital committed</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Valuation</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatCurrency(summary.totalCurrentValue || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Mark-to-market portfolio value</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Net Return Gain</span>
            <div className={`p-2 rounded-xl ${summary.netGain >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50'}`}>
              {summary.netGain >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
          </div>
          <div className={`text-2xl font-extrabold mt-2 ${summary.netGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {summary.netGain >= 0 ? '+' : ''}{formatCurrency(summary.netGain || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ROI: <span className="font-semibold">{summary.overallReturnPct}%</span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Assets</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <PieIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.activeCount || 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">Of {investments.length} total holdings</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search investments by name, type, source..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="matured">Matured</option>
            <option value="exited">Exited</option>
            <option value="under_review">Under Review</option>
          </select>
        </div>
      </div>

      {/* Investment Table */}
      {loading ? (
        <LoadingState text="Loading secure investment portfolio..." />
      ) : filteredInvestments.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="w-8 h-8 stroke-1" />}
          title="No investment records found"
          description={search ? "No investments match your search criteria." : "Click 'Add Investment' to record your first capitalization asset."}
          action={
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Add Investment
            </button>
          }
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-3.5">Investment / Asset</th>
                  <th className="px-5 py-3.5">Type & Source</th>
                  <th className="px-5 py-3.5 text-right">Principal Invested</th>
                  <th className="px-5 py-3.5 text-right">Current Valuation</th>
                  <th className="px-5 py-3.5 text-right">Return / Gain</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredInvestments.map((inv) => {
                  const gain = (Number(inv.current_value) || 0) - Number(inv.amount);
                  const returnPct = Number(inv.amount) > 0 ? ((gain / Number(inv.amount)) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{inv.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          {inv.type}
                        </span>
                        {inv.source && (
                          <div className="text-xs text-slate-500 mt-1">Source: {inv.source}</div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatCurrency(inv.amount)}
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(inv.current_value || inv.amount)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className={`font-bold ${gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          {returnPct}% ROI
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          (inv.status as string) === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : (inv.status as string) === 'matured'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : (inv.status as string) === 'exited' || (inv.status as string) === 'divested'
                            ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {inv.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(inv)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition"
                            title="Edit Investment"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv.id, inv.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition"
                            title="Delete Investment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Investment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Investment Record' : 'Record New Investment'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Investment Name / Asset *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Series A Convertible Note"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Asset Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Equity">Equity</option>
                    <option value="Debt / Bond">Debt / Bond</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Mutual Fund / ETF">Mutual Fund / ETF</option>
                    <option value="Venture Capital">Venture Capital</option>
                    <option value="Fixed Deposit">Fixed Deposit</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Investment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                  </input>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Principal Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="50000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Current Valuation ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 65000"
                    value={formData.currentValue}
                    onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Capital Source
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Treasury Account"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="matured">Matured</option>
                    <option value="exited">Exited</option>
                    <option value="under_review">Under Review</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Notes & Details
                </label>
                <textarea
                  rows={3}
                  placeholder="Terms, expected exit date, dividend terms..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Investment' : 'Save Investment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
