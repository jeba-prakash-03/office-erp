import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, attendanceApi } from '../../api/services';
import { useNotification } from '../../context/NotificationContext';
import { StatsCard } from '../../components/ui/StatsCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { formatCurrency } from '../../utils/formatters';
import { Link } from 'react-router-dom';
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
  Sparkles,
  HelpCircle,
  BarChart3,
  Layers,
  ChevronRight
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
  const { user, hasPermission } = useAuth();
  const { showNotification } = useNotification();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Role view override for administrators
  const defaultRoleView = user?.roleName === 'super_admin' || user?.roleName === 'admin'
    ? 'executive'
    : user?.roleName === 'hr_manager' || user?.roleName === 'hr'
    ? 'hr'
    : user?.roleName === 'finance_manager'
    ? 'finance'
    : user?.roleName === 'project_manager'
    ? 'projects'
    : user?.roleName === 'manager' || user?.roleName === 'team_lead'
    ? 'team'
    : 'employee';

  const [viewMode, setViewMode] = useState<string>(defaultRoleView);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await dashboardApi.getStats();
      if (res.data?.success) {
        setData(res.data);
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

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const res = await attendanceApi.clockIn({});
      showNotification('success', res.data?.message || 'Clocked in successfully!');
      fetchStats();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || err.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const res = await attendanceApi.clockOut({});
      showNotification('success', res.data?.message || 'Clocked out successfully!');
      fetchStats();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || err.message || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <LoadingState text="Aggregating organizational metrics from MySQL..." />
      </div>
    );
  }

  const stats = data?.stats || {};
  const charts = data?.charts || {};
  const recentActivities = data?.recentActivities || [];
  const upcomingHolidays = data?.upcomingHolidays || [];
  const pendingApprovals = data?.pendingApprovals || [];

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

  const isSuperOrAdmin = user?.roleName === 'super_admin' || user?.roleName === 'admin';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Banner with Role Context */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Role: <span className="capitalize">{user?.roleName?.replace('_', ' ') || 'Enterprise User'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome, {user?.name || user?.email}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              {viewMode === 'employee'
                ? 'Your personal workplace dashboard: track daily shifts, tasks, leave balances, and company schedules.'
                : viewMode === 'hr'
                ? 'HR & People Operations: monitor workforce attendance, review leave requests, and track departmental performance.'
                : viewMode === 'finance'
                ? 'Financial Command: monitor revenue, operating expenses, invoice receivables, and payroll disbursals.'
                : viewMode === 'projects'
                ? 'Project Management: track sprint deliverables, team timesheet allocations, and milestone deadlines.'
                : 'Executive Command: high-level business intelligence, cross-department workflows, and organizational health.'}
            </p>
          </div>

          {/* Quick Actions & View Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {isSuperOrAdmin && (
              <div className="bg-slate-800/80 border border-slate-700 p-1.5 rounded-xl flex items-center gap-1">
                <span className="text-[11px] font-semibold text-slate-400 px-2">Perspective:</span>
                {(['executive', 'hr', 'finance', 'projects', 'employee'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                      viewMode === mode
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}

            {/* Attendance Punch Box for Employees */}
            {(user?.employeeId || user?.roleName === 'employee') && (
              <div className="bg-white/10 backdrop-blur-md border border-white/15 p-3 rounded-xl flex items-center gap-3">
                <div className="text-left">
                  <p className="text-[10px] text-indigo-300 uppercase font-bold">Shift Punch</p>
                  <p className="text-xs font-bold text-white">
                    {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50"
                  >
                    Clock In
                  </button>
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50"
                  >
                    Clock Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW: EMPLOYEE SELF-SERVICE */}
      {viewMode === 'employee' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="My Tasks"
              value={stats.tasks?.myPending || stats.tasks?.pending || 0}
              icon={CheckSquare}
              subtitle="Active deliverables"
              iconBgColor="bg-indigo-50 dark:bg-indigo-950/50"
              iconColor="text-indigo-600 dark:text-indigo-400"
            />
            <StatsCard
              title="Leave Balance"
              value={`${stats.leave?.remainingDays ?? 18} Days`}
              icon={CalendarCheck}
              subtitle="Available annual quota"
              iconBgColor="bg-purple-50 dark:bg-purple-950/50"
              iconColor="text-purple-600 dark:text-purple-400"
            />
            <StatsCard
              title="Hours This Week"
              value={`${stats.timesheets?.myWeeklyHours || 38.5} hrs`}
              icon={Clock}
              subtitle="Logged across projects"
              iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
              iconColor="text-emerald-600 dark:text-emerald-400"
            />
            <StatsCard
              title="Active Projects"
              value={stats.projects?.myActive || stats.projects?.active || 0}
              icon={Briefcase}
              subtitle="Assigned workstreams"
              iconBgColor="bg-blue-50 dark:bg-blue-950/50"
              iconColor="text-blue-600 dark:text-blue-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Self-Service Shortcuts</h3>
                  <p className="text-xs text-slate-500">Quick access to your personal ERP records</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Link to="/my-attendance" className="p-4 bg-slate-50 dark:bg-slate-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group">
                  <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-slate-900 dark:text-white">My Attendance</div>
                  <div className="text-[11px] text-slate-500">Punch history & shift logs</div>
                </Link>
                <Link to="/leave" className="p-4 bg-slate-50 dark:bg-slate-900/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group">
                  <CalendarCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Apply for Leave</div>
                  <div className="text-[11px] text-slate-500">Balances & requests</div>
                </Link>
                <Link to="/timesheets" className="p-4 bg-slate-50 dark:bg-slate-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group">
                  <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-slate-900 dark:text-white">My Timesheets</div>
                  <div className="text-[11px] text-slate-500">Log task working hours</div>
                </Link>
                <Link to="/tasks" className="p-4 bg-slate-50 dark:bg-slate-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group">
                  <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-slate-900 dark:text-white">My Tasks</div>
                  <div className="text-[11px] text-slate-500">Assigned deliverable board</div>
                </Link>
                <Link to="/payroll" className="p-4 bg-slate-50 dark:bg-slate-900/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group">
                  <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-slate-900 dark:text-white">My Payslips</div>
                  <div className="text-[11px] text-slate-500">Salary & deduction slips</div>
                </Link>
                <Link to="/performance" className="p-4 bg-slate-50 dark:bg-slate-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group">
                  <TrendingUp className="w-5 h-5 text-rose-600 dark:text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Performance</div>
                  <div className="text-[11px] text-slate-500">Review feedback & KPIs</div>
                </Link>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Upcoming Company Holidays
              </h3>
              <div className="space-y-2.5">
                {upcomingHolidays.length > 0 ? (
                  upcomingHolidays.map((h: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{h.name}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono font-medium">{h.date}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 py-4 text-center">No upcoming holidays scheduled this month.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: HR & PEOPLE OPERATIONS */}
      {viewMode === 'hr' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatsCard
              title="Total Employees"
              value={stats.employees?.total || 0}
              icon={Users}
              subtitle={`${stats.employees?.active || 0} active headcount`}
            />
            <StatsCard
              title="Present Today"
              value={stats.attendance?.presentToday || 0}
              icon={CheckCircle2}
              subtitle={`${stats.attendance?.lateToday || 0} marked late`}
              iconColor="text-emerald-500"
            />
            <StatsCard
              title="On Leave Today"
              value={stats.attendance?.onLeaveToday || 0}
              icon={CalendarCheck}
              subtitle="Approved absences"
              iconColor="text-purple-500"
            />
            <StatsCard
              title="Pending Approvals"
              value={pendingApprovals?.length || 0}
              icon={FileCheck}
              subtitle="Leave & correction queue"
              iconColor="text-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">HR Management Actions</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/employees" className="p-3.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <Users className="w-4 h-4 text-indigo-500 mb-1" />
                  <div className="font-bold text-slate-900 dark:text-white">Directory & Profiles</div>
                  <div className="text-[11px] text-slate-500">Manage employee master records</div>
                </Link>
                <Link to="/attendance" className="p-3.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <Clock className="w-4 h-4 text-emerald-500 mb-1" />
                  <div className="font-bold text-slate-900 dark:text-white">Attendance Operations</div>
                  <div className="text-[11px] text-slate-500">Review shifts & manual punches</div>
                </Link>
                <Link to="/leave" className="p-3.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <CalendarCheck className="w-4 h-4 text-purple-500 mb-1" />
                  <div className="font-bold text-slate-900 dark:text-white">Leave Governance</div>
                  <div className="text-[11px] text-slate-500">Policies & balance allocations</div>
                </Link>
                <Link to="/approvals" className="p-3.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <FileCheck className="w-4 h-4 text-amber-500 mb-1" />
                  <div className="font-bold text-slate-900 dark:text-white">Approvals Hub</div>
                  <div className="text-[11px] text-slate-500">Process pending submissions</div>
                </Link>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Department Distribution</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={charts.departmentDistribution || [{ name: 'Engineering', value: 12 }, { name: 'Operations', value: 8 }, { name: 'Sales', value: 6 }, { name: 'Finance', value: 4 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} fill="#8884d8">
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: FINANCE */}
      {viewMode === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatsCard
              title="Total Revenue (Month)"
              value={formatCurrency(stats.financials?.monthlyIncome || 0)}
              icon={TrendingUp}
              subtitle="Invoiced client income"
              iconColor="text-emerald-500"
            />
            <StatsCard
              title="Operating Expenses"
              value={formatCurrency(stats.financials?.monthlyExpenses || 0)}
              icon={DollarSign}
              subtitle="Vendors, utility, overhead"
              iconColor="text-rose-500"
            />
            <StatsCard
              title="Net Profit"
              value={formatCurrency(stats.financials?.netProfit || 0)}
              icon={DollarSign}
              subtitle="Monthly EBITDA"
              iconColor="text-indigo-500"
            />
            <StatsCard
              title="Receivables"
              value={formatCurrency(stats.financials?.outstandingReceivables || 0)}
              icon={FileText}
              subtitle="Pending invoice balance"
              iconColor="text-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-4">Cashflow Trend (Last 6 Months)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.monthlyTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Area type="monotone" dataKey="income" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Income" />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Finance Operations</h3>
              <div className="space-y-2">
                <Link to="/invoices" className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 rounded-xl text-xs font-semibold">
                  <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-500" /> Invoice Management</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
                <Link to="/payments" className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 rounded-xl text-xs font-semibold">
                  <span className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" /> Payment Logs</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
                <Link to="/payroll" className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 rounded-xl text-xs font-semibold">
                  <span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-amber-500" /> Payroll Administration</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
                <Link to="/loans" className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 rounded-xl text-xs font-semibold">
                  <span className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-cyan-500" /> Loans & Advances</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: PROJECTS & SPRINT WORKFLOWS */}
      {viewMode === 'projects' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatsCard
              title="Active Projects"
              value={stats.projects?.active || 0}
              icon={Briefcase}
              subtitle="Under active delivery"
              iconColor="text-indigo-500"
            />
            <StatsCard
              title="Pending Tasks"
              value={stats.tasks?.pending || 0}
              icon={CheckSquare}
              subtitle={`${stats.tasks?.overdue || 0} overdue`}
              iconColor="text-amber-500"
            />
            <StatsCard
              title="Billable Hours Logged"
              value={`${stats.timesheets?.monthlyTotal || 240} hrs`}
              icon={Clock}
              subtitle="Current billing cycle"
              iconColor="text-emerald-500"
            />
            <StatsCard
              title="Completed Projects"
              value={stats.projects?.completed || 0}
              icon={CheckCircle2}
              subtitle="Delivered successfully"
              iconColor="text-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Work Navigation</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/projects" className="p-3.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 rounded-xl text-xs">
                  <Briefcase className="w-4 h-4 text-indigo-500 mb-1" />
                  <div className="font-bold text-slate-900 dark:text-white">Projects Directory</div>
                  <div className="text-[11px] text-slate-500">Sprints, teams, documents</div>
                </Link>
                <Link to="/tasks" className="p-3.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 rounded-xl text-xs">
                  <CheckSquare className="w-4 h-4 text-emerald-500 mb-1" />
                  <div className="font-bold text-slate-900 dark:text-white">Tasks & Kanban</div>
                  <div className="text-[11px] text-slate-500">Sprint deliverable board</div>
                </Link>
                <Link to="/timesheets" className="p-3.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 rounded-xl text-xs">
                  <Clock className="w-4 h-4 text-blue-500 mb-1" />
                  <div className="font-bold text-slate-900 dark:text-white">Timesheet Governance</div>
                  <div className="text-[11px] text-slate-500">Review billable team hours</div>
                </Link>
                <Link to="/approvals" className="p-3.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 rounded-xl text-xs">
                  <FileCheck className="w-4 h-4 text-amber-500 mb-1" />
                  <div className="font-bold text-slate-900 dark:text-white">Approvals Hub</div>
                  <div className="text-[11px] text-slate-500">Approve timesheet batches</div>
                </Link>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Sprint Task Status Breakdown</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.taskStatus || [{ name: 'To Do', count: 8 }, { name: 'In Progress', count: 14 }, { name: 'In Review', count: 5 }, { name: 'Completed', count: 22 }]}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: EXECUTIVE / SUPER ADMIN ALL-IN-ONE */}
      {viewMode === 'executive' && (
        <div className="space-y-6">
          {/* Primary Cross-Department Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Active Headcount"
              value={stats.employees?.total || 0}
              icon={Users}
              subtitle={`${stats.employees?.active || 0} active employees`}
            />
            <StatsCard
              title="Today's Attendance"
              value={`${stats.attendance?.presentToday || 0} Present`}
              icon={Clock}
              subtitle={`${stats.attendance?.onLeaveToday || 0} on leave`}
              iconColor="text-emerald-500"
            />
            <StatsCard
              title="Active Workstreams"
              value={stats.projects?.active || 0}
              icon={Briefcase}
              subtitle={`${stats.projects?.completed || 0} delivered`}
              iconColor="text-purple-500"
            />
            <StatsCard
              title="Monthly Income"
              value={formatCurrency(stats.financials?.monthlyIncome || 0)}
              icon={TrendingUp}
              subtitle={`Net: ${formatCurrency(stats.financials?.netProfit || 0)}`}
              iconColor="text-emerald-500"
            />
          </div>

          {/* Core Visual Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Company Financial Performance</h3>
                  <p className="text-xs text-slate-500">Revenue and operating expenses over time</p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.monthlyTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Area type="monotone" dataKey="income" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Income" />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Central Approvals Box */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-indigo-500" />
                  Pending Approvals Queue
                </h3>
                <Link to="/approvals" className="text-xs font-semibold text-indigo-600 hover:underline">
                  View All &rarr;
                </Link>
              </div>
              <div className="space-y-2">
                {pendingApprovals.length > 0 ? (
                  pendingApprovals.slice(0, 4).map((p: any, i: number) => (
                    <div key={i} className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{p.requester_name || 'Requester'}</div>
                        <div className="text-[11px] text-slate-400 capitalize">{p.entity_type?.replace('_', ' ')}</div>
                      </div>
                      <Link to="/approvals" className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded font-semibold text-[11px]">
                        Review
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 py-8 text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                    <div>All pending approval queues cleared!</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
