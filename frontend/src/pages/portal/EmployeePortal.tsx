import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, Clock, Calendar, FileText, Laptop, 
  CheckSquare, LogIn, LogOut, ArrowRight 
} from 'lucide-react';
import { 
  attendanceApi, leaveApi, payrollApi, 
  tasksApi, assetsApi 
} from '../../api/services';
import { 
  Attendance, LeaveBalance, Payroll, 
  Task, Asset 
} from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatsCard } from '../../components/ui/StatsCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

export const EmployeePortal: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [recentPayslips, setRecentPayslips] = useState<Payroll[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [assignedAssets, setAssignedAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      const [todayRes, balRes, payRes, taskRes, astRes] = await Promise.all([
        attendanceApi.getTodayStatus(),
        leaveApi.getBalances(),
        payrollApi.getAll({ limit: 5 }),
        tasksApi.getAll({ limit: 10 }),
        assetsApi.getAll({ status: 'assigned', limit: 10 }),
      ]);

      setTodayStatus(todayRes.data.data);
      setBalances(balRes.data.data || []);
      setRecentPayslips(payRes.data.data.records || payRes.data.data || []);
      setAssignedTasks(taskRes.data.data.tasks || taskRes.data.data || []);
      setAssignedAssets(astRes.data.data.assets || astRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  const handleClockIn = async () => {
    setClocking(true);
    try {
      await attendanceApi.clockIn({});
      showNotification('success', 'Clocked in successfully!');
      fetchPortalData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to clock in');
    } finally {
      setClocking(false);
    }
  };

  const handleClockOut = async () => {
    setClocking(true);
    try {
      await attendanceApi.clockOut({});
      showNotification('success', 'Clocked out successfully!');
      fetchPortalData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to clock out');
    } finally {
      setClocking(false);
    }
  };

  if (loading) return <LoadingState text="Loading your employee portal..." />;

  const isClockedIn = todayStatus?.clock_in && !todayStatus?.clock_out;
  const isClockedOut = !!todayStatus?.clock_out;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 text-white rounded-2xl p-6 sm:p-8 shadow-md flex flex-wrap items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">
            Employee Self-Service Desk
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-1">
            Hello, {user?.name}!
          </h1>
          <p className="text-xs text-indigo-100 mt-1">
            Role: <span className="capitalize font-semibold">{user?.role?.replace(/_/g, ' ')}</span> • Today is {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div>
          {!isClockedIn && !isClockedOut && (
            <button
              onClick={handleClockIn}
              disabled={clocking}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow transition-all transform active:scale-95 disabled:opacity-50 text-sm"
            >
              <LogIn className="w-4 h-4" />
              {clocking ? 'Punching...' : 'Punch In Now'}
            </button>
          )}

          {isClockedIn && (
            <button
              onClick={handleClockOut}
              disabled={clocking}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow transition-all transform active:scale-95 disabled:opacity-50 text-sm"
            >
              <LogOut className="w-4 h-4" />
              {clocking ? 'Punching...' : 'Punch Out'}
            </button>
          )}

          {isClockedOut && (
            <span className="px-4 py-2 bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 rounded-xl text-xs font-semibold">
              ✓ Clocked Out Today
            </span>
          )}
        </div>
      </div>

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {balances.map((b) => (
          <div key={b.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 block truncate">
              {b.leave_type_name}
            </span>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {b.remaining_days} <span className="text-xs text-slate-500 font-normal">days left</span>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Section: Tasks and Payslips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Tasks */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-500" />
              My Assigned Tasks ({assignedTasks.length})
            </h3>
            <Link to="/tasks" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              View All →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {assignedTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{t.title}</h4>
                  <span className="text-[10px] text-slate-500">{t.project_name || 'Project'} • Due {t.due_date?.substring(0, 10) || 'N/A'}</span>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
            {assignedTasks.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No tasks assigned to you currently.</p>
            )}
          </div>
        </div>

        {/* My Payslips */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              My Salary Slips & Payslips
            </h3>
            <Link to="/payroll" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              View All →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {recentPayslips.slice(0, 5).map((pay) => (
              <div key={pay.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                    {new Date(2026, Number(pay.month) - 1, 1).toLocaleString('default', { month: 'long' })} {pay.year}
                  </h4>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Net: ${Number(pay.net_salary).toLocaleString()}
                  </span>
                </div>
                <Link
                  to={`/payroll/payslip/${pay.id}`}
                  className="px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded hover:bg-indigo-100"
                >
                  View Slip
                </Link>
              </div>
            ))}
            {recentPayslips.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No payslips generated yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
