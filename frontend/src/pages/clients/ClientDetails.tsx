import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clientsApi } from '../../api/services';
import { Client } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import {
  Building,
  Briefcase,
  FileText,
  CreditCard,
  FolderOpen,
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  Users,
} from 'lucide-react';

export const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const { showToast } = useNotifications();

  const fetchClient = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await clientsApi.getById(id);
      if (res.data?.success) {
        setClient(res.data.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load client profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingState message="Loading client account & linkages..." />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-12 text-center text-slate-500">
        Client record not found.
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'payments', label: 'Payment Receipts', icon: CreditCard },
    { id: 'contacts', label: 'Contacts', icon: Users },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Clients Roster
        </Link>
      </div>

      {/* Header Profile */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-xl flex items-center justify-center shadow-lg shadow-emerald-500/10 flex-shrink-0">
              <Building className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{client.company_name}</h1>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {client.client_code}
                </span>
                <StatusBadge status={client.status} />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Primary Contact: <span className="font-semibold text-slate-700 dark:text-slate-200">{client.contact_person}</span> • {client.industry || 'Enterprise'}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {client.email}</span>
                {client.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {client.phone}</span>}
                {client.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {client.address}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm min-h-[350px]">
        {activeTab === 'overview' && (
          <div className="space-y-4 max-w-xl text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Account Details</h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-2.5">
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">Account Executive:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{client.sales_rep_name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">GST / Tax ID:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{client.gst_number || client.tax_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Website:</span>
                <span className="font-semibold text-brand-600 dark:text-brand-400">{client.website || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-3 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Contracted Projects</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(client.projects || []).length === 0 ? (
                <p className="py-6 text-slate-400 col-span-2">No projects created for this client yet.</p>
              ) : (
                (client.projects || []).map((p) => (
                  <div key={p.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <Link to={`/projects/${p.id}`} className="font-bold text-slate-900 dark:text-white hover:text-brand-600">
                        {p.name}
                      </Link>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-slate-400 text-[11px] font-mono mt-0.5">{p.project_code}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">Budget: ${Number(p.budget).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-3 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Invoices History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Grand Total</th>
                    <th className="py-2.5 px-3">Paid Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(client.invoices || []).length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-400">No invoices issued yet.</td></tr>
                  ) : (
                    (client.invoices || []).map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white font-mono">{inv.invoice_number}</td>
                        <td className="py-2.5 px-3 text-slate-500">{inv.invoice_date}</td>
                        <td className="py-2.5 px-3 text-slate-500">{inv.due_date}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">${Number(inv.grand_total).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-emerald-600 font-semibold">${Number(inv.paid_amount).toLocaleString()}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={inv.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-3 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Payment Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Payment Date</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Amount Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(client.payments || []).length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-slate-400">No payment receipts recorded yet.</td></tr>
                  ) : (
                    (client.payments || []).map((pay) => (
                      <tr key={pay.id}>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-white">{pay.payment_number}</td>
                        <td className="py-2.5 px-3 text-slate-500">{pay.payment_date}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 capitalize">{pay.payment_method}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">${Number(pay.amount).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-3 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Associated Contacts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(client.contacts || []).map((c) => (
                <div key={c.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{c.name}</span>
                    {c.is_primary ? <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-semibold">Primary</span> : null}
                  </div>
                  <p className="text-slate-500 mt-1">{c.email} • {c.phone || 'No phone'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
