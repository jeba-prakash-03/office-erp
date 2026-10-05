import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, attendanceApi } from '../../api/services';
import { useNotifications } from '../../context/NotificationContext';
import { StatsCard } from '../../components/ui/StatsCard';
import { LoadingState } from '../../components/ui/LoadingState';
import {
  Users,
  Briefcase,
  CheckSquare,
  DollarSign,
  TrendingUp,
  Clock,
  Calendar,
  AlertCircle,
  FileText,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await dashboardApi.getStats();
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const res = await attendanceApi.checkIn();
      showToast(res.data.message || 'Checked in successfully!', 'success');
      fetchStats();
    } catch (err: any) {
      showToast(err.message || 'Check-in failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const res = await attendanceApi.checkOut();
      showToast(res.data.message || 'Checked out successfully!', 'success');
      fetchStats();
    } catch (err: any) {
      showToast(err.message || 'Check-out failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <LoadingState message="Aggregating real-time organizational metrics from MySQL..." />
      </div>
    );
  }

  const stats = data?.stats || {};
  const charts = data?.charts || {};
  const recentActivities = data?.recentActivities || [];
  const upcomingHolidays = data?.upcomingHolidays || [];

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-950 p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Enterprise Real-time Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Real-time operational dashboard for monitoring active workforce, projects, financials, and company workflows.
            </p>
          </div>

          {/* Quick Attendance Check-in/out Widget */}
          {user?.employee && (
            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-xl flex items-center gap-4">
              <div className="text-left">
                <p className="text-[11px] text-slate-300 uppercase font-semibold">Today Attendance</p>
                <p className="text-xs font-bold text-white mt-0.5">
                  {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
                >
                  Check In
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
                >
                  Check Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Primary Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatsCard
          title="Total Workforce"
          value={stats.employees?.total || 0}
          icon={Users}
          subtitle={`${stats.employees?.active || 0} active employees`}
          iconBgColor="bg-blue-50 dark:bg-blue-950/50"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <StatsCard
          title="Today's Attendance"
          value={`${stats.attendance?.presentToday || 0} Present`}
          icon={Clock}
          subtitle={`${stats.attendance?.absentToday || 0} absent • ${stats.attendance?.onLeaveToday || 0} on leave`}
          iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <StatsCard
          title="Active Projects"
          value={stats.projects?.active || 0}
          icon={Briefcase}
          subtitle={`${stats.projects?.completed || 0} completed • ${stats.projects?.total || 0} total`}
          iconBgColor="bg-purple-50 dark:bg-purple-950/50"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <StatsCard
          title="Pending Tasks"
          value={stats.tasks?.pending || 0}
          icon={CheckSquare}
          subtitle={`${stats.tasks?.overdue || 0} overdue tasks`}
          iconBgColor="bg-amber-50 dark:bg-amber-950/50"
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatsCard
          title="Monthly Income"
          value={`$${Number(stats.financials?.monthlyIncome || 0).toLocaleString()}`}
          icon={TrendingUp}
          subtitle="Client invoices & revenue"
          iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <StatsCard
          title="Monthly Expenses"
          value={`$${Number(stats.financials?.monthlyExpenses || 0).toLocaleString()}`}
          icon={DollarSign}
          subtitle="Operations & vendor overhead"
          iconBgColor="bg-rose-50 dark:bg-rose-950/50"
          iconColor="text-rose-600 dark:text-rose-400"
        />
        <StatsCard
          title="Net Profit (Month)"
          value={`$${Number(stats.financials?.netProfit || 0).toLocaleString()}`}
          icon={DollarSign}
          subtitle="Income minus expenses"
          iconBgColor="bg-indigo-50 dark:bg-indigo-950/50"
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
        <StatsCard
          title="Outstanding Receivables"
          value={`$${Number(stats.financials?.outstandingReceivables || 0).toLocaleString()}`}
          icon={FileText}
          subtitle={`${stats.financials?.overdueInvoices || 0} overdue invoices`}
          iconBgColor="bg-orange-50 dark:bg-orange-950/50"
          iconColor="text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income vs Expenses Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Revenue vs Expenses Trend</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monthly financial performance over the last 6 months</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.monthlyTrends || []}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#incomeGrad)" name="Income ($)" />
                <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#expenseGrad)" name="Expenses ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Status Pie Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Project Distribution</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Current status breakdown</p>
          </div>
          <div className="h-56 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.projectStatus || []}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {(charts.projectStatus || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            {(charts.projectStatus || []).map((entry: any, index: number) => (
              <div key={entry.status} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span className="text-slate-600 dark:text-slate-400 capitalize">{entry.status.replace(/_/g, ' ')}:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Activity & Upcoming Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Audit Activities Stream */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Organizational Activities</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Real-time Audit Log</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {recentActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No recorded audit logs yet.</div>
            ) : (
              recentActivities.map((act: any) => (
                <div key={act.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                      {act.module?.[0] || 'A'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {act.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-slate-400 text-[11px] truncate">
                        By {act.user_name || act.user_email || 'System'} • Module: {act.module}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0 ml-4">
                    {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Holidays Widget */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-purple-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Upcoming Holidays</h3>
          </div>

          <div className="space-y-3">
            {upcomingHolidays.length === 0 ? (
              <p className="text-xs text-slate-400">No upcoming holidays scheduled.</p>
            ) : (
              upcomingHolidays.map((h: any) => (
                <div
                  key={h.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">{h.name}</h4>
                    <p className="text-[11px] text-slate-400">{h.description || 'Public holiday'}</p>
                  </div>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg">
                    {new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
