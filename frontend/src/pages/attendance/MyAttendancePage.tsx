import React, { useState, useEffect } from 'react';
import { attendanceApi } from '../../api/services';
import { LoadingState } from '../../components/ui/LoadingState';
import { Calendar, CheckCircle2, XCircle, Clock, Sun, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

const STATUS_CONFIG: Record<
  string,
  { label: string; full: string; bg: string; text: string; dotColor: string }
> = {
  P: { label: 'P', full: 'Present', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60', text: 'text-emerald-700 dark:text-emerald-300', dotColor: 'bg-emerald-500' },
  A: { label: 'A', full: 'Absent', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60', text: 'text-rose-700 dark:text-rose-300', dotColor: 'bg-rose-500' },
  L: { label: 'L', full: 'Leave', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60', text: 'text-amber-700 dark:text-amber-300', dotColor: 'bg-amber-500' },
  HD: { label: 'HD', full: 'Half Day', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60', text: 'text-purple-700 dark:text-purple-300', dotColor: 'bg-purple-500' },
  H: { label: 'H', full: 'Holiday', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60', text: 'text-blue-700 dark:text-blue-300', dotColor: 'bg-blue-500' },
  WO: { label: 'WO', full: 'Week Off', bg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400', dotColor: 'bg-slate-400' },
};

export const MyAttendancePage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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

  const fetchMyAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await attendanceApi.getMyAttendance({ month: selectedMonth, year: selectedYear });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load your attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyAttendance();
  }, [selectedMonth, selectedYear]);

  const summary = data?.summary || { present: 0, absent: 0, leave: 0, halfDay: 0, holiday: 0, weekOff: 0 };
  const daysMap = data?.days || {};
  const totalDays = data?.totalDays || 31;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            My Attendance Record
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            View your verified daily attendance and monthly work summary.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 self-start md:self-auto">
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
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
          <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Present</span>
          </div>
          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{summary.present}</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Full Days Worked</span>
        </div>

        <div className="bg-rose-50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-sm">
          <div className="flex items-center space-x-1.5 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
            <XCircle className="w-3.5 h-3.5" />
            <span>Absent</span>
          </div>
          <p className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">{summary.absent}</p>
          <span className="text-[10px] text-rose-600 dark:text-rose-400">Loss of Pay Days</span>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm">
          <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" />
            <span>Leave</span>
          </div>
          <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">{summary.leave}</p>
          <span className="text-[10px] text-amber-600 dark:text-amber-400">Approved Leaves</span>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/30 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/50 shadow-sm">
          <div className="flex items-center space-x-1.5 text-purple-700 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            <span>Half Day</span>
          </div>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">{summary.halfDay}</p>
          <span className="text-[10px] text-purple-600 dark:text-purple-400">Half Shifts</span>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-sm">
          <div className="flex items-center space-x-1.5 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Sun className="w-3.5 h-3.5" />
            <span>Holiday</span>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{summary.holiday}</p>
          <span className="text-[10px] text-blue-600 dark:text-blue-400">Company Holidays</span>
        </div>

        <div className="bg-slate-100 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" />
            <span>Week Off</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">{summary.weekOff}</p>
          <span className="text-[10px] text-slate-500">Weekends</span>
        </div>
      </div>

      {/* Calendar Day Cards Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
          Daily Breakdown for {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
        </h2>

        {loading ? (
          <div className="p-12">
            <LoadingState text="Loading your attendance records..." />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
              const dateObj = new Date(selectedYear, selectedMonth - 1, day);
              const weekday = dateObj.toLocaleDateString('default', { weekday: 'short' });
              const code = daysMap[day] || (dateObj.getDay() === 0 || dateObj.getDay() === 6 ? 'WO' : 'P');
              const cfg = STATUS_CONFIG[code] || STATUS_CONFIG['P'];

              return (
                <div
                  key={day}
                  className={clsx(
                    'p-3 rounded-lg border flex flex-col justify-between transition-all hover:shadow-sm',
                    cfg.bg
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-slate-900 dark:text-white">{day}</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">{weekday}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={clsx('text-xs font-bold', cfg.text)}>{cfg.full}</span>
                    <span className={clsx('w-2 h-2 rounded-full', cfg.dotColor)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
