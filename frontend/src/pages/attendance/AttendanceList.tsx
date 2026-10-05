import React, { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle, XCircle, AlertTriangle, Calendar, 
  LogIn, LogOut, FileText, Search, UserCheck 
} from 'lucide-react';
import { attendanceApi, employeesApi } from '../../api/services';
import { Attendance, Employee } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCard } from '../../components/ui/StatsCard';
import { CorrectionModal } from './CorrectionModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const AttendanceList: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const [listRes, todayRes] = await Promise.all([
        attendanceApi.getAll({
          month,
          status: statusFilter || undefined,
          search: search || undefined,
          page,
          limit: 20,
        }),
        attendanceApi.getTodayStatus(),
      ]);

      setAttendances(listRes.data.data.records || listRes.data.data);
      if (listRes.data.data.pagination) {
        setTotalPages(listRes.data.data.pagination.totalPages || 1);
        setTotalRecords(listRes.data.data.pagination.total || 0);
      }
      setTodayStatus(todayRes.data.data);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [month, statusFilter, search, page]);

  const handleClockIn = async () => {
    setClocking(true);
    try {
      await attendanceApi.clockIn({});
      showNotification('success', 'Clocked in successfully! Have a great workday.');
      fetchAttendance();
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
      fetchAttendance();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to clock out');
    } finally {
      setClocking(false);
    }
  };

  const isClockedIn = todayStatus?.clock_in && !todayStatus?.clock_out;
  const isClockedOut = !!todayStatus?.clock_out;

  const columns: Column<Attendance>[] = [
    {
      header: 'Employee',
      accessor: (a) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-white">
            {a.employee_name || `Employee #${a.employee_id}`}
          </span>
          <div className="text-xs text-slate-500">{a.employee_code}</div>
        </div>
      ),
    },
    {
      header: 'Date',
      accessor: (a) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {a.date ? a.date.substring(0, 10) : '—'}
        </span>
      ),
    },
    {
      header: 'Clock In',
      accessor: (a) => (
        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
          {a.clock_in ? a.clock_in.substring(11, 16) || a.clock_in : '—'}
        </span>
      ),
    },
    {
      header: 'Clock Out',
      accessor: (a) => (
        <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
          {a.clock_out ? a.clock_out.substring(11, 16) || a.clock_out : '—'}
        </span>
      ),
    },
    {
      header: 'Working Hours',
      accessor: (a) => (
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
          {a.total_hours ? `${Number(a.total_hours).toFixed(1)} hrs` : '—'}
        </span>
      ),
    },
    {
      header: 'Overtime',
      accessor: (a) => (
        <span className="text-xs text-slate-500">
          {Number(a.overtime_hours || 0) > 0 ? `+${Number(a.overtime_hours).toFixed(1)} hrs` : '0 hrs'}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'right',
      accessor: (a) => <StatusBadge status={a.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance & Time Tracking"
        subtitle="Manage daily punches, working hours, overtime, and monthly attendance logs"
        action={
          <button
            onClick={() => setCorrectionModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Request Correction
          </button>
        }
      />

      {/* Clock In / Out Banner Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-100 text-sm font-medium">
            <Clock className="w-4 h-4" />
            <span>Today's Workshift: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <h2 className="text-2xl font-bold">
            {isClockedOut
              ? 'Workday Completed'
              : isClockedIn
              ? 'Currently Working'
              : 'Not Clocked In Yet'}
          </h2>
          <p className="text-xs text-indigo-200">
            {todayStatus?.clock_in
              ? `Punched In at ${todayStatus.clock_in.substring(11, 16) || todayStatus.clock_in}`
              : 'Record your check-in timestamp to start your workday.'}
            {todayStatus?.clock_out && ` • Punched Out at ${todayStatus.clock_out.substring(11, 16) || todayStatus.clock_out}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isClockedIn && !isClockedOut && (
            <button
              onClick={handleClockIn}
              disabled={clocking}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
            >
              <LogIn className="w-5 h-5" />
              {clocking ? 'Punching In...' : 'Clock In Now'}
            </button>
          )}

          {isClockedIn && (
            <button
              onClick={handleClockOut}
              disabled={clocking}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
            >
              <LogOut className="w-5 h-5" />
              {clocking ? 'Punching Out...' : 'Clock Out Now'}
            </button>
          )}

          {isClockedOut && (
            <div className="px-5 py-2.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-100 font-medium text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-300" />
              Clocked Out for Today
            </div>
          )}
        </div>
      </div>

      {/* Filter and Month Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Month:</span>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
        >
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="half_day">Half Day</option>
          <option value="absent">Absent</option>
          <option value="on_leave">On Leave</option>
          <option value="holiday">Holiday</option>
        </select>
      </div>

      {/* Attendance Log Table */}
      <DataTable
        columns={columns}
        data={attendances}
        keyField="id"
        loading={loading}
        emptyMessage="No attendance logs found for this period."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {/* Correction Request Modal */}
      {correctionModalOpen && (
        <CorrectionModal
          isOpen={correctionModalOpen}
          onClose={() => setCorrectionModalOpen(false)}
          onSuccess={fetchAttendance}
        />
      )}
    </div>
  );
};
