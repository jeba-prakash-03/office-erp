import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Download, Filter, Calendar, FileSpreadsheet, 
  TrendingUp, Users, DollarSign, CheckSquare, Layers 
} from 'lucide-react';
import { reportsApi } from '../../api/services';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { LoadingState } from '../../components/ui/LoadingState';
import { useNotification } from '../../context/NotificationContext';

const REPORT_TYPES = [
  { id: 'attendance', name: 'Monthly Attendance Report', icon: Users },
  { id: 'leave', name: 'Leave & Time-Off Consumption', icon: Calendar },
  { id: 'payroll', name: 'Payroll & Salary Summary', icon: DollarSign },
  { id: 'projects', name: 'Projects & Milestone Progress', icon: Layers },
  { id: 'tasks', name: 'Tasks Productivity & Velocity', icon: CheckSquare },
  { id: 'financial', name: 'Profit & Loss Statement', icon: TrendingUp },
  { id: 'expenses', name: 'Expense Category Breakdown', icon: BarChart3 },
  { id: 'invoices', name: 'Invoices & Receivables Aging', icon: FileSpreadsheet },
];

export const ReportsView: React.FC = () => {
  const { showNotification } = useNotification();
  const [selectedReport, setSelectedReport] = useState('attendance');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().substring(0, 10));
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await reportsApi.getReport(selectedReport, {
        start_date: startDate,
        end_date: endDate,
      });
      setReportData(res.data.data.records || res.data.data || []);
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.response?.data?.message || 'Failed to generate report');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReport, startDate, endDate]);

  const exportToCSV = () => {
    if (reportData.length === 0) {
      showNotification('error', 'No data to export');
      return;
    }

    const headers = Object.keys(reportData[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of reportData) {
      const values = headers.map((header) => {
        const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${selectedReport}_report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showNotification('success', 'CSV report exported successfully');
  };

  // Generate dynamic columns from JSON keys
  const columns: Column<any>[] = reportData.length > 0
    ? Object.keys(reportData[0]).map((key) => ({
        header: key.replace(/_/g, ' ').toUpperCase(),
        accessor: (row) => {
          const val = row[key];
          if (val === null || val === undefined) return '—';
          if (typeof val === 'boolean') return val ? 'Yes' : 'No';
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        },
      }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Analytics & Reports"
        subtitle="Generate executive audit reports, payroll sheets, attendance matrices, and financial ledgers"
        action={
          <button
            onClick={exportToCSV}
            disabled={reportData.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        }
      />

      {/* Report Types Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {REPORT_TYPES.map((rep) => {
          const Icon = rep.icon;
          const isSelected = selectedReport === rep.id;

          return (
            <button
              key={rep.id}
              onClick={() => setSelectedReport(rep.id)}
              className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  isSelected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold leading-tight line-clamp-2">
                {rep.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <button
          onClick={fetchReport}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors ml-auto"
        >
          Run Analysis
        </button>
      </div>

      {/* Report Data Table */}
      <DataTable
        columns={columns}
        data={reportData}
        keyField="id"
        loading={loading}
        emptyMessage="No data generated for the selected report filters."
      />
    </div>
  );
};
