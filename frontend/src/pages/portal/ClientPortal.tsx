import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase, FileText, CheckCircle2, Clock, 
  DollarSign, Download, Eye, ExternalLink 
} from 'lucide-react';
import { clientsApi, invoicesApi, projectsApi } from '../../api/services';
import { Project, Invoice, Client } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCard } from '../../components/ui/StatsCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../context/AuthContext';

export const ClientPortal: React.FC = () => {
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPortalData = async () => {
      try {
        setLoading(true);
        const [projRes, invRes] = await Promise.all([
          projectsApi.getAll({ limit: 50 }),
          invoicesApi.getAll({ limit: 50 }),
        ]);
        setProjects(projRes.data.data.projects || projRes.data.data);
        setInvoices(invRes.data.data.invoices || invRes.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortalData();
  }, []);

  if (loading) return <LoadingState text="Loading your client workspace..." />;

  const totalInvoiced = invoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
  const totalPaid = invoices.reduce((acc, i) => acc + Number(i.paid_amount || 0), 0);
  const totalBalance = totalInvoiced - totalPaid;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white rounded-2xl p-8 shadow-lg">
        <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">Client Self-Service Portal</span>
        <h1 className="text-2xl sm:text-3xl font-black mt-1">
          Welcome to your Project & Billing Hub
        </h1>
        <p className="text-xs text-indigo-200 mt-2 max-w-xl">
          Real-time visibility into project delivery milestones, sprint tracking, itemized invoices, and payment receipts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Active Projects"
          value={projects.length.toString()}
          icon={<Briefcase className="w-6 h-6 text-indigo-500" />}
        />
        <StatsCard
          title="Total Paid to Date"
          value={`$${totalPaid.toLocaleString()}`}
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
        />
        <StatsCard
          title="Outstanding Invoices"
          value={`$${totalBalance.toLocaleString()}`}
          icon={<Clock className="w-6 h-6 text-amber-500" />}
        />
      </div>

      {/* Projects Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-500" />
          Active Project Workspaces
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{p.name}</h4>
                  <p className="text-xs text-slate-500">{p.code || 'PRJ-' + p.id}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Sprint Progress</span>
                  <span className="font-bold text-indigo-600">{p.progress || 0}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${p.progress || 0}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Deadline: {p.deadline || 'Ongoing'}</span>
                <Link
                  to={`/projects/${p.id}`}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-xs text-slate-400 py-4 col-span-2 text-center">No projects assigned.</p>
          )}
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-500" />
          Recent Invoices & Payment Status
        </h3>

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {invoices.map((inv) => (
            <div key={inv.id} className="py-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">{inv.invoice_number}</span>
                <div className="text-xs text-slate-500">
                  Issued: {inv.issue_date?.substring(0, 10)} • Due: {inv.due_date?.substring(0, 10)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">${Number(inv.total_amount).toFixed(2)}</span>
                  <StatusBadge status={inv.status} />
                </div>
                <Link
                  to={`/invoices/${inv.id}`}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium text-xs rounded-lg hover:bg-indigo-100"
                >
                  View Invoice
                </Link>
              </div>
            </div>
          ))}
          {invoices.length === 0 && (
            <p className="text-xs text-slate-400 py-4 text-center">No invoices issued.</p>
          )}
        </div>
      </div>
    </div>
  );
};
