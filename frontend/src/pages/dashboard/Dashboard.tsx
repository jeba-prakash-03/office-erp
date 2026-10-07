import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../api/services';
import { useNotification } from '../../context/NotificationContext';
import { StatsCard } from '../../components/ui/StatsCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { formatCurrency } from '../../utils/formatters';
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
  CalendarCheck,
  Check,
  X,
  CreditCard,
  Building,
  Target,
  FileCheck,
  Layers,
  ChevronRight,
  Lock,
  PieChart as PieIcon,
  Server
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await dashboardApi.getStats();
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <LoadingState text="Loading role-tailored dashboard..." />
      </div>
    );
  }

  const role = user?.roleName || 'employee';
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

  // =========================================================================
  // 1. EMPLOYEE SELF-SERVICE DASHBOARD
  // =========================================================================
  if (role === 'employee') {
    const attendance = data?.attendance || { present_days: 0, absent_days: 0, leave_days: 0, half_days: 0 };
    const leaveBalances = data?.leave?.balances || { total_allowed: 0, used_days: 0, remaining_days: 0 };
    const pendingLeaveRequests = data?.leave?.pendingRequests || [];
    const taskStats = data?.tasks?.stats || { total_tasks: 0, todo_tasks: 0, in_progress_tasks: 0, completed_tasks: 0 };
    const recentTasks = data?.tasks?.recent || [];
    const projects = data?.projects || [];
    const payroll = data?.payroll;
    const performance = data?.performance;

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Employee Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-2">
              <Users className="w-3.5 h-3.5" /> Employee Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {user?.name || user?.email}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Your self-service workspace: track monthly attendance, leave balances, assigned tasks, and payslips.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/leave"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              Apply for Leave
            </Link>
          </div>
        </div>

        {/* Top KPI Cards for Employee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Present Days (This Month)"
            value={`${attendance.present_days || 0} Days`}
            icon={Clock}
            subtitle={`Absences: ${attendance.absent_days || 0} • Leaves: ${attendance.leave_days || 0}`}
            iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <StatsCard
            title="Remaining Leave Quota"
            value={`${leaveBalances.remaining_days || 0} Days`}
            icon={CalendarCheck}
            subtitle={`Used: ${leaveBalances.used_days || 0} of ${leaveBalances.total_allowed || 0} days`}
            iconBgColor="bg-purple-50 dark:bg-purple-950/50"
            iconColor="text-purple-600 dark:text-purple-400"
          />
          <StatsCard
            title="My Active Tasks"
            value={(Number(taskStats.todo_tasks) || 0) + (Number(taskStats.in_progress_tasks) || 0)}
            icon={CheckSquare}
            subtitle={`${taskStats.completed_tasks || 0} tasks completed`}
            iconBgColor="bg-indigo-50 dark:bg-indigo-950/50"
            iconColor="text-indigo-600 dark:text-indigo-400"
          />
          <StatsCard
            title="Assigned Projects"
            value={projects.length}
            icon={Briefcase}
            subtitle="Active company workstreams"
            iconBgColor="bg-blue-50 dark:bg-blue-950/50"
            iconColor="text-blue-600 dark:text-blue-400"
          />
        </div>

        {/* Middle Section: Tasks & Payroll / Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks & Projects Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Tasks */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">My Active Tasks</h3>
                  <p className="text-xs text-slate-500">Deliverables assigned to you</p>
                </div>
                <Link to="/tasks" className="text-xs font-semibold text-indigo-600 hover:underline">
                  View Kanban &rarr;
                </Link>
              </div>

              {recentTasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  No pending tasks assigned. You're all caught up!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {recentTasks.map((t: any) => (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">{t.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{t.project_name || 'General Project'}</span>
                          {t.due_date && <span>• Due {new Date(t.due_date).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        t.status === 'in_progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {t.status?.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link to="/my-attendance" className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition shadow-sm text-center">
                <Clock className="w-5 h-5 text-indigo-600 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">Attendance</div>
                <div className="text-[10px] text-slate-400">Monthly Sheet</div>
              </Link>
              <Link to="/leave" className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition shadow-sm text-center">
                <CalendarCheck className="w-5 h-5 text-purple-600 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">Leave Requests</div>
                <div className="text-[10px] text-slate-400">Apply & Status</div>
              </Link>
              <Link to="/payroll" className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition shadow-sm text-center">
                <CreditCard className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">Payslips</div>
                <div className="text-[10px] text-slate-400">Download PDF</div>
              </Link>
              <Link to="/performance" className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition shadow-sm text-center">
                <TrendingUp className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">Performance</div>
                <div className="text-[10px] text-slate-400">Goals & Reviews</div>
              </Link>
            </div>
          </div>

          {/* Right Column: Payslip & Performance Summaries */}
          <div className="space-y-6">
            {/* Latest Payslip Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  Latest Salary Payslip
                </h3>
                <Link to="/payroll" className="text-xs font-semibold text-indigo-600 hover:underline">
                  All Payslips &rarr;
                </Link>
              </div>

              {payroll ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Period:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {new Date(2026, payroll.month - 1).toLocaleString('default', { month: 'long' })} {payroll.year}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Gross Salary:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">${Number(payroll.gross_salary || 0).toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Net Take Home:</span>
                    <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                      ${Number(payroll.net_salary || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">No payslips generated for this period.</div>
              )}
            </div>

            {/* Performance Review Status */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Performance Appraisal
              </h3>
              {performance ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">{performance.cycle_title}</div>
                  <div className="flex items-center gap-1 text-amber-500 font-bold">
                    Rating: {performance.overall_rating || 'N/A'} / 5.0
                  </div>
                  {performance.comments && (
                    <p className="text-slate-500 italic mt-1 line-clamp-2">"{performance.comments}"</p>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">No active review feedback recorded.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. ADMIN & SUPER ADMIN DASHBOARDS
  // =========================================================================
  const metrics = data?.metrics || {};
  const superAdmin = data?.superAdminOnly;
  const recentActivity = data?.recentActivity || [];
  const deptBreakdown = data?.departmentBreakdown || [];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Admin / Super Admin Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            {role === 'super_admin' ? 'Super Admin Executive Console' : 'Company Administration'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Company Overview — {user?.name || user?.email}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Real-time organizational telemetry across workforce, attendance, monthly finance, and operations.
          </p>
        </div>

        {role === 'super_admin' && (
          <Link
            to="/investments"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition"
          >
            <Lock className="w-3.5 h-3.5" />
            Investments Portfolio
          </Link>
        )}
      </div>

      {/* SUPER ADMIN CONFIDENTIAL METRICS BANNER */}
      {role === 'super_admin' && superAdmin && (
        <div className="bg-purple-950/40 border border-purple-800/60 rounded-2xl p-5 text-slate-100">
          <div className="flex items-center justify-between mb-3 border-b border-purple-800/50 pb-2">
            <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <Lock className="w-4 h-4 text-purple-400" />
              Super Admin Confidential Insights
            </div>
            <span className="text-[11px] text-purple-300 font-mono">System Status: {superAdmin.systemStatus} (Uptime: {superAdmin.uptimeHours}h)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-purple-900/30 p-3 rounded-xl border border-purple-700/40">
              <span className="text-purple-300">Total Invested</span>
              <div className="text-lg font-bold text-white mt-1">
                {formatCurrency(superAdmin.investments?.totalInvested || 0)}
              </div>
            </div>
            <div className="bg-purple-900/30 p-3 rounded-xl border border-purple-700/40">
              <span className="text-purple-300">Portfolio Valuation</span>
              <div className="text-lg font-bold text-emerald-300 mt-1">
                {formatCurrency(superAdmin.investments?.totalCurrentValue || 0)}
              </div>
            </div>
            <div className="bg-purple-900/30 p-3 rounded-xl border border-purple-700/40">
              <span className="text-purple-300">Net Return</span>
              <div className="text-lg font-bold text-white mt-1">
                +{formatCurrency(superAdmin.investments?.netGain || 0)} ({superAdmin.investments?.returnRate}%)
              </div>
            </div>
            <div className="bg-purple-900/30 p-3 rounded-xl border border-purple-700/40">
              <span className="text-purple-300">System Users</span>
              <div className="text-lg font-bold text-white mt-1">
                {superAdmin.totalUsers} Accounts
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Core Company KPIs (Clean, readable light cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Employees"
          value={metrics.totalEmployees || 0}
          icon={Users}
          subtitle={`${metrics.activeEmployees || 0} currently active`}
          iconBgColor="bg-indigo-50 dark:bg-indigo-950/50"
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
        <StatsCard
          title="Attendance Today"
          value={`${metrics.presentToday || 0} Present`}
          icon={Clock}
          subtitle={`Absent: ${metrics.absentToday || 0} • On Leave: ${metrics.leaveToday || 0}`}
          iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <StatsCard
          title="Pending Leave Requests"
          value={metrics.pendingLeaveRequests || 0}
          icon={CalendarCheck}
          subtitle="Awaiting admin approval"
          iconBgColor="bg-amber-50 dark:bg-amber-950/50"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          title="Active Projects & Tasks"
          value={`${metrics.activeProjects || 0} Projects`}
          icon={Briefcase}
          subtitle={`${metrics.openTasks || 0} tasks in progress`}
          iconBgColor="bg-blue-50 dark:bg-blue-950/50"
          iconColor="text-blue-600 dark:text-blue-400"
        />
      </div>

      {/* Secondary Finance & Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Monthly Income"
          value={formatCurrency(metrics.monthlyIncome || 0)}
          icon={TrendingUp}
          subtitle="Current calendar month"
          iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <StatsCard
          title="Monthly Expenses"
          value={formatCurrency(metrics.monthlyExpenses || 0)}
          icon={DollarSign}
          subtitle="Operating disbursements"
          iconBgColor="bg-rose-50 dark:bg-rose-950/50"
          iconColor="text-rose-600 dark:text-rose-400"
        />
        <StatsCard
          title="Outstanding Invoices"
          value={formatCurrency(metrics.outstandingInvoicesAmount || 0)}
          icon={FileText}
          subtitle={`${metrics.outstandingInvoicesCount || 0} pending receivables`}
          iconBgColor="bg-amber-50 dark:bg-amber-950/50"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          title="Monthly Payroll Status"
          value={metrics.payrollStatus?.toUpperCase() || 'DRAFT'}
          icon={CreditCard}
          subtitle="October 2026 Payroll Cycle"
          iconBgColor="bg-indigo-50 dark:bg-indigo-950/50"
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
      </div>

      {/* Visual Analytics & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Department Headcount Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deptBreakdown.length > 0 ? deptBreakdown.map((d: any) => ({ name: d.name, value: Number(d.employee_count) })) : [{ name: 'Staff', value: 5 }]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                >
                  {deptBreakdown.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
            {deptBreakdown.slice(0, 4).map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                <span className="text-slate-600 dark:text-slate-400 truncate">{d.name}:</span>
                <span className="font-bold text-slate-900 dark:text-white">{d.employee_count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Audit & System Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Recent Enterprise Activity Log
            </h3>
            <Link to="/audit" className="text-xs font-semibold text-indigo-600 hover:underline">
              View Audit Logs &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No recent logs recorded.</div>
            ) : (
              recentActivity.map((log: any) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{log.action?.replace('_', ' ')}</span>
                    <span className="text-slate-500 ml-2">in {log.module} by {log.user_name || log.user_email || 'System'}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
