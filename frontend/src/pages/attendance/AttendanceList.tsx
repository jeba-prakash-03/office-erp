import React, { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle, XCircle, AlertTriangle, Calendar, 
  Search, UserCheck, Users, CalendarCheck, HelpCircle, Edit3, Plus, RefreshCw, FileCheck
} from 'lucide-react';
import { attendanceApi, departmentsApi } from '../../api/services';
import { Attendance, AttendanceOverview, Department } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCard } from '../../components/ui/StatsCard';
import { AdminCorrectionModal } from './AdminCorrectionModal';
import { ReviewCorrectionsModal } from './ReviewCorrectionsModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const AttendanceList: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { showNotification } = useNotification();

  // State
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const todayStr = new Date().toISOString().substring(0, 10);
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('today');
  const [date, setDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Modals
  const [adminCorrectionOpen, setAdminCorrectionOpen] = useState(false);
  const [reviewCorrectionsOpen, setReviewCorrectionsOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);

  // Load Departments
  useEffect(() => {
    departmentsApi.getAll().then((res: any) => {
      setDepartments(Array.isArray(res.data?.data) ? res.data.data : (res.data?.data?.records || []));
    }).catch(console.error);
  }, []);

  // Handle Preset Changes
  const applyPreset = (p: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom') => {
    setPreset(p);
    setPage(1);
    const now = new Date();
    if (p === 'today') {
      setDate(now.toISOString().substring(0, 10));
      setStartDate('');
      setEndDate('');
    } else if (p === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      setDate(y.toISOString().substring(0, 10));
      setStartDate('');
      setEndDate('');
    } else if (p === 'this_week') {
      const first = new Date(now);
      first.setDate(now.getDate() - now.getDay());
      setDate('');
      setStartDate(first.toISOString().substring(0, 10));
      setEndDate(now.toISOString().substring(0, 10));
    } else if (p === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setDate('');
      setStartDate(first.toISOString().substring(0, 10));
      setEndDate(now.toISOString().substring(0, 10));
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);

      const params: any = {
        page,
        limit: 20,
        department_id: departmentId || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      };

      if (date) {
        params.date = date;
      } else if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const [listRes, overviewRes] = await Promise.all([
        attendanceApi.getAll(params),
        attendanceApi.getOverview({ date: date || todayStr }),
      ]);

      if (listRes.data?.success) {
        const payload: any = listRes.data.data;
        if (payload && Array.isArray(payload.records)) {
          setAttendances(payload.records);
          setTotalPages(payload.pagination?.totalPages || 1);
          setTotalRecords(payload.pagination?.total || 0);
        } else if (Array.isArray(payload)) {
          setAttendances(payload);
          setTotalPages(1);
          setTotalRecords(payload.length);
        } else {
          setAttendances([]);
        }
      }

      if (overviewRes.data?.success) {
        setOverview(overviewRes.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load attendance list', err);
      showNotification('error', err.response?.data?.message || 'Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [date, startDate, endDate, departmentId, statusFilter, search, page]);

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

  const handleEditRecord = (rec: Attendance) => {
    setSelectedAttendance(rec);
    setAdminCorrectionOpen(true);
  };

  const handleNewManualEntry = () => {
    setSelectedAttendance(null);
    setAdminCorrectionOpen(true);
  };

  const columns: Column<Attendance>[] = [
    {
      header: 'Employee',
      accessor: (a: Attendance) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
            {(a.employee_name || 'E').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="font-semibold text-slate-900 dark:text-white block text-xs">
              {a.employee_name || `Employee #${a.employee_id}`}
            </span>
            <div className="text-[11px] text-slate-500">
              {a.employee_code || `EMP-${a.employee_id}`}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      accessor: (a: Attendance) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {a.department_name || '—'}
        </span>
      ),
    },
    {
      header: 'Date',
      accessor: (a: Attendance) => (
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
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
      accessor: (a: Attendance) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {a.working_hours_formatted || (a.total_hours ? `${a.total_hours} hrs` : '—')}
        </span>
      ),
    },
    {
      header: 'Overtime',
      accessor: (a: Attendance) => (
        <span className="text-xs text-slate-500 font-mono">
          {a.overtime_hours_formatted || (Number(a.overtime_hours || 0) > 0 ? `+${a.overtime_hours} hrs` : '0h 00m')}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (a: Attendance) => <StatusBadge status={a.status || 'present'} />,
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (a: Attendance) => (
        <button
          onClick={() => handleEditRecord(a)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
          title="Administrative Manual Correction"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Correct
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Management"
        subtitle="Monitor organizational attendance, review working duration logs, and perform authorized audit corrections"
        action={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setReviewCorrectionsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
            >
              <FileCheck className="w-4 h-4 text-indigo-500" />
              Review Corrections
            </button>
            <button
              onClick={handleNewManualEntry}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Manual Punch Entry
            </button>
          </div>
        }
      />

      {/* Today's Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard
          title="Total Employees"
          value={overview?.totalEmployees ?? 0}
          icon={Users}
          subtitle="Active workforce"
        />
        <StatsCard
          title="Present"
          value={overview?.present ?? 0}
          icon={CheckCircle}
          subtitle="Clocked in today"
        />
        <StatsCard
          title="Absent"
          value={overview?.absent ?? 0}
          icon={XCircle}
          subtitle="No punch recorded"
        />
        <StatsCard
          title="Late Arrivals"
          value={overview?.late ?? 0}
          icon={AlertTriangle}
          subtitle="Punched after 09:15"
        />
        <StatsCard
          title="On Leave"
          value={overview?.onLeave ?? 0}
          icon={CalendarCheck}
          subtitle="Approved leaves"
        />
        <StatsCard
          title="Missing Punch"
          value={overview?.missingPunch ?? 0}
          icon={HelpCircle}
          subtitle="Unclosed shifts"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
        {/* Preset Selection Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">
              Timeframe:
            </span>
            {(['today', 'yesterday', 'this_week', 'this_month', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  preset === p
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAttendance}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Records
          </button>
        </div>

        {/* Detailed Filter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {preset === 'custom' ? (
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDate('');
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDate('');
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
              />
            </div>
          ) : (
            <div>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPreset('custom');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
              />
            </div>
          )}

          <div>
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="on_leave">On Leave</option>
              <option value="missing_punch">Missing Punch</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search employee name/code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <DataTable
        columns={columns}
        data={attendances}
        keyField="id"
        loading={loading}
        emptyMessage={
          date
            ? `No attendance records recorded for ${formatDateString(date)}.`
            : `No attendance records found matching selected filters.`
        }
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: (p) => setPage(p),
        }}
      />

      {/* Admin Manual Correction Modal */}
      <AdminCorrectionModal
        isOpen={adminCorrectionOpen}
        onClose={() => setAdminCorrectionOpen(false)}
        onSuccess={() => fetchAttendance()}
        initialAttendance={selectedAttendance}
      />

      {/* Review Corrections Modal */}
      <ReviewCorrectionsModal
        isOpen={reviewCorrectionsOpen}
        onClose={() => setReviewCorrectionsOpen(false)}
        onSuccess={() => fetchAttendance()}
      />
    </div>
  );
};
