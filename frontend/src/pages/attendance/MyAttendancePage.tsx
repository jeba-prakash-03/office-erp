import React, { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle, XCircle, AlertTriangle, Calendar, 
  LogIn, LogOut, FileText, Search, UserCheck, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';
import { attendanceApi } from '../../api/services';
import { Attendance, TodayAttendanceStatus } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CorrectionModal } from './CorrectionModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export const MyAttendancePage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [todayStatus, setTodayStatus] = useState<TodayAttendanceStatus | null>(null);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  
  // Filters
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modals
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const [todayRes, historyRes] = await Promise.all([
        attendanceApi.getMyStatus(),
        attendanceApi.getMyHistory({
          month,
          status: statusFilter || undefined,
          search: search || undefined,
          page,
          limit: 15,
        }),
      ]);

      if (todayRes.data?.success) {
        setTodayStatus(todayRes.data.data);
      }

      if (historyRes.data?.success) {
        const payload: any = historyRes.data.data;
        if (payload && Array.isArray(payload.records)) {
          setHistory(payload.records);
          setTotalPages(payload.pagination?.totalPages || 1);
          setTotalRecords(payload.pagination?.total || 0);
        } else if (Array.isArray(payload)) {
          setHistory(payload);
          setTotalPages(1);
          setTotalRecords(payload.length);
        } else {
          setHistory([]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load my attendance data', err);
      showNotification('error', err.response?.data?.message || 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [month, statusFilter, search, page]);

  const handleClockIn = async () => {
    if (clocking) return;
    setClocking(true);
    try {
      const res = await attendanceApi.clockIn({});
      showNotification('success', res.data?.message || 'Punched in successfully! Have a productive day.');
      await fetchAttendanceData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to clock in';
      showNotification('error', errorMsg);
    } finally {
      setClocking(false);
    }
  };

  const handleClockOut = async () => {
    if (clocking) return;
    setClocking(true);
    try {
      const res = await attendanceApi.clockOut({});
      showNotification('success', res.data?.message || 'Punched out successfully! Workday recorded.');
      await fetchAttendanceData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to clock out';
      showNotification('error', errorMsg);
    } finally {
      setClocking(false);
    }
  };

  const formatTimeString = (dtStr?: string | null) => {
    if (!dtStr) return '—';
    if (dtStr.length > 10) {
      const d = new Date(dtStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      }
      return dtStr.substring(11, 16);
    }
    return dtStr;
  };

  const formatDateString = (dtStr?: string | null) => {
    if (!dtStr) return '—';
    const clean = String(dtStr).substring(0, 10);
    const d = new Date(clean + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    return clean;
  };

  const columns: Column<Attendance>[] = [
    {
      header: 'Date',
      accessor: (a: Attendance) => (
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          {formatDateString(a.date)}
        </span>
      ),
    },
    {
      header: 'Clock In',
      accessor: (a: Attendance) => {
        const inVal = a.check_in || a.clock_in;
        return (
          <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
            {formatTimeString(inVal)}
          </span>
        );
      },
    },
    {
      header: 'Clock Out',
      accessor: (a: Attendance) => {
        const outVal = a.check_out || a.clock_out;
        return (
          <span className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400">
            {formatTimeString(outVal)}
          </span>
        );
      },
    },
    {
      header: 'Working Hours',
      accessor: (a: Attendance) => {
        const hours = a.working_hours_formatted || (a.total_hours ? `${a.total_hours} hrs` : '—');
        return (
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {hours}
          </span>
        );
      },
    },
    {
      header: 'Overtime',
      accessor: (a: Attendance) => {
        const ot = a.overtime_hours_formatted || (Number(a.overtime_hours || 0) > 0 ? `+${a.overtime_hours} hrs` : '0h 00m');
        return (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {ot}
          </span>
        );
      },
    },
    {
      header: 'Status',
      align: 'right',
      accessor: (a: Attendance) => <StatusBadge status={a.status || 'present'} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        subtitle="Record your daily work shift, verify check-in timestamps, and view your personal attendance history"
        action={
          <button
            onClick={() => setCorrectionModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4 text-indigo-500" />
            Request Correction
          </button>
        }
      />

      {/* Profile Check: If user does not have an employee profile linked */}
      {todayStatus && !todayStatus.hasEmployeeProfile && (
        <div className="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
              User Account Not Linked to an Employee Profile
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              Your account is registered with role <strong>{user?.roleName || 'Administrator'}</strong> without an active employee record. Self-service punch-in is intended for employees.
              {(hasPermission('attendance.view') || hasPermission('attendance.manage')) && (
                <span className="block mt-2">
                  <Link
                    to="/attendance"
                    className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 underline hover:no-underline"
                  >
                    Open Attendance Management &rarr;
                  </Link>
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Today's Punch Card & Live Shift Tracking */}
      {todayStatus?.hasEmployeeProfile && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>
                  Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • <span className="font-mono text-white text-sm">{currentTime}</span>
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                {todayStatus.isOnLeave ? (
                  <span className="text-purple-300">Scheduled On Leave</span>
                ) : todayStatus.isClockedOut ? (
                  <span className="text-emerald-300">Workday Completed</span>
                ) : todayStatus.isClockedIn ? (
                  <span className="text-emerald-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    Currently Working
                  </span>
                ) : (
                  <span className="text-amber-300">Not Clocked In Today</span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {todayStatus.isOnLeave
                  ? 'You have approved leave on record for today.'
                  : todayStatus.isClockedOut
                  ? `Shift finished. Clock in: ${formatTimeString(todayStatus.checkIn)} • Clock out: ${formatTimeString(todayStatus.checkOut)}`
                  : todayStatus.isClockedIn
                  ? `Active since ${formatTimeString(todayStatus.checkIn)}`
                  : 'Start your shift by recording your check-in timestamp.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {todayStatus.canClockIn && (
                <button
                  onClick={handleClockIn}
                  disabled={clocking}
                  className="inline-flex items-center gap-2.5 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  <LogIn className="w-5 h-5" />
                  {clocking ? 'Recording Punch...' : 'Clock In'}
                </button>
              )}

              {todayStatus.canClockOut && (
                <button
                  onClick={handleClockOut}
                  disabled={clocking}
                  className="inline-flex items-center gap-2.5 px-6 py-3 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  <LogOut className="w-5 h-5" />
                  {clocking ? 'Recording Punch...' : 'Clock Out'}
                </button>
              )}

              {todayStatus.isClockedOut && (
                <div className="px-5 py-2.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-200 font-medium text-sm flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Punched Out for Today
                </div>
              )}

              {todayStatus.isOnLeave && (
                <div className="px-5 py-2.5 bg-purple-500/20 border border-purple-400/40 rounded-xl text-purple-200 font-medium text-sm flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  On Approved Leave
                </div>
              )}
            </div>
          </div>

          {/* Today's 4 Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 mb-1 font-medium">Clock In</div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {formatTimeString(todayStatus.checkIn)}
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 mb-1 font-medium">Clock Out</div>
              <div className="text-lg font-bold font-mono text-blue-400">
                {formatTimeString(todayStatus.checkOut)}
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 mb-1 font-medium">Working Hours</div>
              <div className="text-lg font-bold font-mono text-white">
                {todayStatus.workingHoursFormatted || '0h 00m'}
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
              <div className="text-xs text-slate-400 mb-1 font-medium">Overtime</div>
              <div className="text-lg font-bold font-mono text-amber-400">
                {todayStatus.overtimeHoursFormatted || '0h 00m'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Attendance History Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              My Attendance History
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review your monthly attendance logs, working durations, and correction statuses
            </p>
          </div>

          <button
            onClick={fetchAttendanceData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Month:</span>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
              <option value="on_leave">On Leave</option>
              <option value="missing_punch">Missing Punch</option>
            </select>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by date or notes..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        {/* History Data Table */}
        <DataTable
          columns={columns}
          data={history}
          keyField="id"
          loading={loading}
          emptyMessage={`No personal attendance records found for ${month}.`}
          pagination={{
            page,
            totalPages,
            totalRecords,
            onPageChange: (p) => setPage(p),
          }}
        />
      </div>

      {/* Request Correction Modal */}
      <CorrectionModal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        onSuccess={() => fetchAttendanceData()}
      />
    </div>
  );
};
