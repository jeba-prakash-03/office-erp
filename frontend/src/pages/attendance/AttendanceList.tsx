import React, { useState, useEffect, useMemo } from 'react';
import { attendanceApi } from '../../api/services';
import { AttendanceSheetEmployee } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/ui/LoadingState';
import {
  Calendar,
  Save,
  Lock,
  Unlock,
  Download,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';

const STATUS_CONFIG: Record<
  string,
  { label: string; full: string; bg: string; text: string; selectBg: string }
> = {
  P: {
    label: 'P',
    full: 'Present',
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300 font-bold',
    selectBg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  A: {
    label: 'A',
    full: 'Absent',
    bg: 'bg-rose-100 dark:bg-rose-950/60',
    text: 'text-rose-700 dark:text-rose-300 font-bold',
    selectBg: 'bg-rose-50 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  },
  L: {
    label: 'L',
    full: 'Leave',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-700 dark:text-amber-300 font-bold',
    selectBg: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  HD: {
    label: 'HD',
    full: 'Half Day',
    bg: 'bg-purple-100 dark:bg-purple-950/60',
    text: 'text-purple-700 dark:text-purple-300 font-bold',
    selectBg: 'bg-purple-50 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  },
  H: {
    label: 'H',
    full: 'Holiday',
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300 font-bold',
    selectBg: 'bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  WO: {
    label: 'WO',
    full: 'Week Off',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400 font-medium',
    selectBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  },
  NM: {
    label: '—',
    full: 'Not Marked',
    bg: 'bg-slate-50 dark:bg-slate-900',
    text: 'text-slate-400 dark:text-slate-500 font-normal',
    selectBg: 'bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400',
  },
};

export const AttendanceList: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roleName === 'super_admin';

  // Month & Year state (Default October 2026 as per specification)
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Sheet Data
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalDays, setTotalDays] = useState<number>(31);
  const [isFinalized, setIsFinalized] = useState<boolean>(false);
  const [finalizedInfo, setFinalizedInfo] = useState<any>(null);
  const [employees, setEmployees] = useState<AttendanceSheetEmployee[]>([]);
  const [companyTotals, setCompanyTotals] = useState<any>(null);

  // Local Edits / Dirty Tracking: { [employeeId]: { [day]: status } }
  const [localEdits, setLocalEdits] = useState<Record<string, Record<number, string>>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showLockModal, setShowLockModal] = useState<boolean>(false);
  const [lockNotes, setLockNotes] = useState<string>('');

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = [2024, 2025, 2026, 2027];

  // Fetch Attendance Sheet
  const fetchSheet = async () => {
    try {
      setLoading(true);
      setError(null);
      setSaveSuccessMsg(null);
      const res = await attendanceApi.getMonthlySheet({ month: selectedMonth, year: selectedYear });
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setTotalDays(d.totalDays || new Date(selectedYear, selectedMonth, 0).getDate());
        setIsFinalized(d.isFinalized || false);
        setFinalizedInfo(d.finalizedInfo || null);
        setEmployees(d.employees || []);
        setCompanyTotals(d.companyTotals || null);
        setLocalEdits({});
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheet();
  }, [selectedMonth, selectedYear]);

  // Handle cell change
  const handleCellChange = (employeeId: string, day: number, newCode: string) => {
    if (isFinalized) return;
    setLocalEdits((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {}),
        [day]: newCode,
      },
    }));
    setSaveSuccessMsg(null);
  };

  // Count pending edits
  const pendingEditsCount = useMemo(() => {
    let count = 0;
    for (const empId of Object.keys(localEdits)) {
      count += Object.keys(localEdits[empId] || {}).length;
    }
    return count;
  }, [localEdits]);

  // Save Attendance Changes
  const handleSaveAttendance = async () => {
    if (pendingEditsCount === 0) return;
    try {
      setSaving(true);
      setError(null);
      await attendanceApi.saveMonthlySheet({
        month: selectedMonth,
        year: selectedYear,
        updates: localEdits,
      });
      setSaveSuccessMsg('Attendance Saved Successfully');
      await fetchSheet();
    } catch (err: any) {
      setError(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  // Finalize / Lock Attendance
  const handleFinalize = async () => {
    try {
      setSaving(true);
      setShowLockModal(false);
      await attendanceApi.finalizeMonth({
        month: selectedMonth,
        year: selectedYear,
        notes: lockNotes,
      });
      setSaveSuccessMsg('Attendance finalized and locked successfully');
      await fetchSheet();
    } catch (err: any) {
      setError(err.message || 'Failed to finalize attendance');
    } finally {
      setSaving(false);
    }
  };

  // Reopen Attendance
  const handleReopen = async () => {
    if (!window.confirm('Are you sure you want to reopen this month for editing?')) return;
    try {
      setSaving(true);
      await attendanceApi.reopenMonth({
        month: selectedMonth,
        year: selectedYear,
      });
      setSaveSuccessMsg('Attendance reopened for editing');
      await fetchSheet();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen attendance');
    } finally {
      setSaving(false);
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // Calculate live row summary taking local edits into account
  const getEmployeeLiveRow = (emp: AttendanceSheetEmployee) => {
    const edits = localEdits[emp.id] || {};
    let present = 0,
      absent = 0,
      leave = 0,
      halfDay = 0,
      holiday = 0,
      weekOff = 0;
    const days: Record<number, string> = {};

    for (let day = 1; day <= totalDays; day++) {
      const code = edits[day] || emp.days[String(day)] || 'P';
      days[day] = code;

      if (code === 'P') present++;
      else if (code === 'A') absent++;
      else if (code === 'L') leave++;
      else if (code === 'HD') halfDay++;
      else if (code === 'H') holiday++;
      else if (code === 'WO') weekOff++;
    }

    return {
      ...emp,
      liveDays: days,
      liveSummary: { present, absent, leave, halfDay, holiday, weekOff },
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Monthly Attendance Sheet
            </h1>
            <span
              className={clsx(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider',
                isFinalized
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              )}
            >
              {isFinalized ? (
                <>
                  <Lock className="w-3 h-3 mr-1" /> Finalized
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3 mr-1" /> Draft Mode
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Spreadsheet matrix for monthly company attendance. Select values per day cell and click save.
          </p>
        </div>

        {/* Action Buttons & Month/Year Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
            <Calendar className="w-4 h-4 ml-2 mr-1 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 py-1.5 px-2 focus:outline-none cursor-pointer"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value} className="dark:bg-slate-800">
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 py-1.5 px-2 focus:outline-none cursor-pointer border-l border-slate-200 dark:border-slate-700"
            >
              {years.map((y) => (
                <option key={y} value={y} className="dark:bg-slate-800">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Export Excel / CSV */}
          <a
            href={attendanceApi.exportUrl(selectedMonth, selectedYear)}
            download
            className="inline-flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Export Grid (CSV)
          </a>

          {/* Save Button */}
          {!isFinalized && (
            <button
              onClick={handleSaveAttendance}
              disabled={saving || pendingEditsCount === 0}
              className={clsx(
                'inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm',
                pendingEditsCount > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              )}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Saving...' : pendingEditsCount > 0 ? `Save Attendance (${pendingEditsCount})` : 'Save Attendance'}
            </button>
          )}

          {/* Finalize / Reopen Toggle */}
          {!isFinalized ? (
            <button
              onClick={() => setShowLockModal(true)}
              className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Finalize Month
            </button>
          ) : (
            <button
              onClick={handleReopen}
              disabled={saving}
              className="inline-flex items-center px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              <Unlock className="w-3.5 h-3.5 mr-1.5" />
              Reopen Month
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {saveSuccessMsg && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-200 text-xs font-medium">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Summary KPI Cards & Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employees</span>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
            {companyTotals?.totalEmployees || employees.length}
          </p>
        </div>
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200/80 dark:border-emerald-900/50 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            (P) Present
          </span>
          <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
            {companyTotals?.totalPresent || 0}
          </p>
        </div>
        <div className="bg-rose-50/60 dark:bg-rose-950/30 p-3 rounded-lg border border-rose-200/80 dark:border-rose-900/50 shadow-sm">
          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            (A) Absent
          </span>
          <p className="text-lg font-bold text-rose-800 dark:text-rose-200 mt-0.5">
            {companyTotals?.totalAbsent || 0}
          </p>
        </div>
        <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/50 shadow-sm">
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            (L) Leave
          </span>
          <p className="text-lg font-bold text-amber-800 dark:text-amber-200 mt-0.5">
            {companyTotals?.totalLeave || 0}
          </p>
        </div>
        <div className="bg-purple-50/60 dark:bg-purple-950/30 p-3 rounded-lg border border-purple-200/80 dark:border-purple-900/50 shadow-sm">
          <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
            (HD) Half Day
          </span>
          <p className="text-lg font-bold text-purple-800 dark:text-purple-200 mt-0.5">
            {companyTotals?.totalHalfDay || 0}
          </p>
        </div>
        <div className="bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200/80 dark:border-blue-900/50 shadow-sm">
          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
            (H) Holiday
          </span>
          <p className="text-lg font-bold text-blue-800 dark:text-blue-200 mt-0.5">
            {companyTotals?.totalHoliday || 0}
          </p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            (WO) Week Off
          </span>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">
            {companyTotals?.totalWeekOff || 0}
          </p>
        </div>
      </div>

      {/* Main Spreadsheet Matrix Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee name, ID, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>
              Showing <strong>{filteredEmployees.length}</strong> of {employees.length} employees
            </span>
            <button
              onClick={fetchSheet}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600"
              title="Refresh Sheet"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Spreadsheet Grid View */}
        {loading ? (
          <div className="p-12">
            <LoadingState text="Loading monthly attendance matrix..." />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No active employees found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add employees to your company directory to begin recording monthly attendance sheets.
            </p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No employees found matching your search filter.
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold select-none">
                  {/* Fixed Column 1: Employee Name */}
                  <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 px-4 py-3 min-w-[200px] border-r border-slate-200 dark:border-slate-700 shadow-sm">
                    Employee Name
                  </th>

                  {/* Day Columns 1..N */}
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                    const dateObj = new Date(selectedYear, selectedMonth - 1, day);
                    const dayName = dateObj.toLocaleDateString('default', { weekday: 'narrow' });
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                    return (
                      <th
                        key={day}
                        className={clsx(
                          'px-1.5 py-2 text-center min-w-[44px] max-w-[48px] border-r border-slate-200/70 dark:border-slate-800',
                          isWeekend && 'bg-slate-100/60 dark:bg-slate-800/40'
                        )}
                      >
                        <div className="text-[11px] font-bold">{day}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{dayName}</div>
                      </th>
                    );
                  })}

                  {/* Summary Columns */}
                  <th className="px-2 py-3 text-center min-w-[40px] bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-l border-slate-200 dark:border-slate-700">
                    P
                  </th>
                  <th className="px-2 py-3 text-center min-w-[40px] bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300">
                    A
                  </th>
                  <th className="px-2 py-3 text-center min-w-[40px] bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                    L
                  </th>
                  <th className="px-2 py-3 text-center min-w-[40px] bg-purple-50/50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300">
                    HD
                  </th>
                  <th className="px-2 py-3 text-center min-w-[40px] bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">
                    H
                  </th>
                  <th className="px-2 py-3 text-center min-w-[40px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    WO
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {filteredEmployees.map((rawEmp) => {
                  const emp = getEmployeeLiveRow(rawEmp);
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-blue-50/30 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Fixed First Column: Employee Information */}
                      <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-4 py-2.5 border-r border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {emp.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                          <span className="font-mono text-slate-500 dark:text-slate-400 font-bold">
                            {emp.employeeId}
                          </span>
                          <span>&bull;</span>
                          <span className="truncate">{emp.department}</span>
                        </div>
                      </td>

                      {/* Day Cells 1..N with Fast Dropdown Select */}
                      {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                        const currentCode = emp.liveDays[day] || 'NM';
                        const isEdited = localEdits[emp.id]?.[day] !== undefined;
                        const config = STATUS_CONFIG[currentCode] || STATUS_CONFIG['NM'];

                        return (
                          <td
                            key={day}
                            className={clsx(
                              'p-1 text-center border-r border-slate-200/60 dark:border-slate-800/80 relative',
                              isEdited && 'ring-1 ring-blue-500 ring-inset bg-blue-50/20'
                            )}
                          >
                            <select
                              disabled={isFinalized}
                              value={currentCode}
                              onChange={(e) => handleCellChange(emp.id, day, e.target.value)}
                              className={clsx(
                                'w-full py-1 text-center font-bold text-[11px] rounded transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-90',
                                config.selectBg
                              )}
                              title={`Day ${day}: ${config.full}`}
                            >
                              <option value="NM">— (Not Marked)</option>
                              <option value="P">P (Present)</option>
                              <option value="A">A (Absent)</option>
                              <option value="L">L (Leave)</option>
                              <option value="HD">HD (Half Day)</option>
                              <option value="H">H (Holiday)</option>
                              <option value="WO">WO (Week Off)</option>
                            </select>
                          </td>
                        );
                      })}

                      {/* Summary Badges */}
                      <td className="px-2 py-2 text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 border-l border-slate-200 dark:border-slate-700">
                        {emp.liveSummary.present}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-rose-700 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/10">
                        {emp.liveSummary.absent}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/10">
                        {emp.liveSummary.leave}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-purple-700 dark:text-purple-400 bg-purple-50/30 dark:bg-purple-950/10">
                        {emp.liveSummary.halfDay}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/10">
                        {emp.liveSummary.holiday}
                      </td>
                      <td className="px-2 py-2 text-center font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">
                        {emp.liveSummary.weekOff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lock Confirmation Modal */}
      {showLockModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-emerald-600">
              <Lock className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Finalize Attendance for {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Finalizing locks the monthly attendance sheet from further routine modifications. This ensures
              attendance inputs for payroll remain stable and consistent.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Finalization Notes (Optional)
              </label>
              <textarea
                value={lockNotes}
                onChange={(e) => setLockNotes(e.target.value)}
                placeholder="e.g., Verified against biometric and shift rosters."
                rows={2}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowLockModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {saving ? 'Finalizing...' : 'Confirm & Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
