import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { payrollApi, employeesApi } from '../../api/services';
import { SalaryComponent, Employee } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/ui/LoadingState';
import {
  CreditCard,
  Plus,
  Calculator,
  Lock,
  Unlock,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Layers,
  Users,
  Settings,
  Edit2,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';

export const PayrollList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployeeOnly = user?.roleName === 'employee';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'runs' | 'components' | 'structures' | 'my-payslips'>(
    isEmployeeOnly ? 'my-payslips' : 'runs'
  );

  // ---------------------------------------------------------------------------
  // TAB 1: RUNS STATE
  // ---------------------------------------------------------------------------
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [runsLoading, setRunsLoading] = useState<boolean>(true);
  const [runs, setRuns] = useState<any[]>([]);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ---------------------------------------------------------------------------
  // TAB 2: COMPONENTS STATE
  // ---------------------------------------------------------------------------
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [compLoading, setCompLoading] = useState<boolean>(false);
  const [showCompModal, setShowCompModal] = useState<boolean>(false);
  const [editingComp, setEditingComp] = useState<SalaryComponent | null>(null);
  const [compFormData, setCompFormData] = useState<any>({
    name: '',
    type: 'earning',
    calculationType: 'fixed',
    percentageOf: 'Basic Salary',
    defaultValue: 0,
    isTaxable: true,
    isStatutory: false,
    isActive: true,
    description: '',
  });

  // ---------------------------------------------------------------------------
  // TAB 3: EMPLOYEE STRUCTURES STATE
  // ---------------------------------------------------------------------------
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState<boolean>(false);
  const [selectedEmpForStruct, setSelectedEmpForStruct] = useState<any>(null);
  const [empStructure, setEmpStructure] = useState<any[]>([]);
  const [empBasicSalary, setEmpBasicSalary] = useState<number>(0);
  const [structModalOpen, setStructModalOpen] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // TAB 4: MY PAYSLIPS (EMPLOYEE)
  // ---------------------------------------------------------------------------
  const [myPayslips, setMyPayslips] = useState<any[]>([]);
  const [myPayslipsLoading, setMyPayslipsLoading] = useState<boolean>(false);

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

  // Fetch Runs
  const fetchRuns = async () => {
    try {
      setRunsLoading(true);
      const res = await payrollApi.listRuns({ year: selectedYear });
      if (res.data?.success && res.data?.data) {
        setRuns(res.data.data);
        const match = res.data.data.find((r: any) => r.month === selectedMonth && r.year === selectedYear);
        if (match) {
          const detailRes = await payrollApi.getRunById(match.id);
          setActiveRun(detailRes.data?.data || match);
        } else {
          setActiveRun(null);
        }
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setRunsLoading(false);
    }
  };

  // Fetch Components
  const fetchComponents = async () => {
    try {
      setCompLoading(true);
      const res = await payrollApi.getComponents();
      if (res.data?.success && res.data?.data) {
        setComponents(res.data.data);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setCompLoading(false);
    }
  };

  // Fetch Employees for Structures
  const fetchEmployees = async () => {
    try {
      setEmpLoading(true);
      const res = await employeesApi.list({ limit: 100 });
      if (res.data?.success && res.data?.data) {
        setEmployees(res.data.data.records || res.data.data);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setEmpLoading(false);
    }
  };

  // Fetch My Payslips
  const fetchMyPayslips = async () => {
    try {
      setMyPayslipsLoading(true);
      const res = await payrollApi.getMyPayslips();
      if (res.data?.success && res.data?.data) {
        setMyPayslips(res.data.data);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setMyPayslipsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'runs') fetchRuns();
    else if (activeTab === 'components') fetchComponents();
    else if (activeTab === 'structures') fetchEmployees();
    else if (activeTab === 'my-payslips') fetchMyPayslips();
  }, [activeTab, selectedMonth, selectedYear]);

  // Calculate Monthly Payroll
  const handleCalculatePayroll = async () => {
    try {
      setCalculating(true);
      setStatusMsg(null);
      const res = await payrollApi.calculate({ month: selectedMonth, year: selectedYear });
      setStatusMsg({ type: 'success', text: 'Payroll calculation executed successfully' });
      await fetchRuns();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Calculation failed' });
    } finally {
      setCalculating(false);
    }
  };

  // Finalize Payroll
  const handleFinalizePayroll = async () => {
    if (!activeRun?.id) return;
    if (!window.confirm('Finalize payroll and generate payslips? Edits will be locked.')) return;
    try {
      setCalculating(true);
      await payrollApi.finalize({ id: activeRun.id });
      setStatusMsg({ type: 'success', text: 'Payroll finalized and employee payslips generated successfully' });
      await fetchRuns();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Finalization failed' });
    } finally {
      setCalculating(false);
    }
  };

  // Reopen Payroll
  const handleReopenPayroll = async () => {
    if (!activeRun?.id) return;
    if (!window.confirm('Reopen payroll run for adjustments?')) return;
    try {
      setCalculating(true);
      await payrollApi.reopen({ id: activeRun.id });
      setStatusMsg({ type: 'success', text: 'Payroll run reopened for editing' });
      await fetchRuns();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Reopen failed' });
    } finally {
      setCalculating(false);
    }
  };

  // Save Salary Component
  const handleSaveComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingComp) {
        await payrollApi.updateComponent(editingComp.id, compFormData);
      } else {
        await payrollApi.createComponent(compFormData);
      }
      setShowCompModal(false);
      setEditingComp(null);
      await fetchComponents();
    } catch (err: any) {
      alert(err.message || 'Failed to save component');
    }
  };

  // Open Employee Structure Editor
  const openStructureEditor = async (emp: any) => {
    try {
      setSelectedEmpForStruct(emp);
      setEmpBasicSalary(Number(emp.basic_salary) || 0);
      const res = await payrollApi.getEmployeeStructure(emp.id);
      if (res.data?.success && res.data?.data) {
        setEmpStructure(res.data.data.structure || []);
      }
      setStructModalOpen(true);
    } catch (e: any) {
      alert(e.message || 'Failed to load structure');
    }
  };

  // Save Employee Structure
  const handleSaveEmployeeStructure = async () => {
    try {
      await payrollApi.updateEmployeeStructure(selectedEmpForStruct.id, {
        basicSalary: empBasicSalary,
        components: empStructure.map((s) => ({
          componentId: s.id,
          amount: Number(s.assigned_amount) || 0,
          percentage: Number(s.assigned_percentage) || 0,
          isActive: s.is_assigned,
        })),
      });
      setStructModalOpen(false);
      await fetchEmployees();
      alert('Salary structure updated successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to save salary structure');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Payroll & Compensation Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized salary calculations, configurable earnings & deductions, and official payslips.
          </p>
        </div>

        {/* Tab Navigation */}
        {!isEmployeeOnly && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('runs')}
              className={clsx(
                'px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors',
                activeTab === 'runs'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              )}
            >
              Payroll Runs
            </button>
            <button
              onClick={() => setActiveTab('components')}
              className={clsx(
                'px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors',
                activeTab === 'components'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              )}
            >
              Salary Components
            </button>
            <button
              onClick={() => setActiveTab('structures')}
              className={clsx(
                'px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors',
                activeTab === 'structures'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              )}
            >
              Employee Structures
            </button>
          </div>
        )}
      </div>

      {statusMsg && (
        <div
          className={clsx(
            'p-3.5 rounded-xl border text-xs flex items-center justify-between font-medium',
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'
          )}
        >
          <div className="flex items-center space-x-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="font-bold text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: PAYROLL RUNS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'runs' && (
        <div className="space-y-5">
          {/* Month / Action Controls */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 py-1.5 px-3 focus:outline-none cursor-pointer"
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
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 py-1.5 px-3 focus:outline-none cursor-pointer border-l border-slate-200 dark:border-slate-700"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y} className="dark:bg-slate-800">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {activeRun && (
                <span
                  className={clsx(
                    'px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider',
                    activeRun.status === 'finalized'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  )}
                >
                  {activeRun.status === 'finalized' ? 'Finalized & Locked' : 'Calculated (Draft)'}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2.5">
              {activeRun?.status !== 'finalized' ? (
                <>
                  <button
                    onClick={handleCalculatePayroll}
                    disabled={calculating}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    <Calculator className="w-3.5 h-3.5 mr-1.5" />
                    {calculating ? 'Calculating...' : activeRun ? 'Recalculate Run' : 'Calculate Run'}
                  </button>
                  {activeRun && (
                    <button
                      onClick={handleFinalizePayroll}
                      disabled={calculating}
                      className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5 mr-1.5" />
                      Finalize & Generate Payslips
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={handleReopenPayroll}
                  disabled={calculating}
                  className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <Unlock className="w-3.5 h-3.5 mr-1.5" />
                  Reopen Payroll Run
                </button>
              )}
            </div>
          </div>

          {/* Metric Summary Cards */}
          {activeRun && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Gross Salary</span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  ₹{Number(activeRun.total_gross).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-sm">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Total Deductions</span>
                <p className="text-xl font-bold text-rose-800 dark:text-rose-200 mt-1">
                  ₹{Number(activeRun.total_deductions).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Net Payout</span>
                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                  ₹{Number(activeRun.total_net).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Employees</span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {activeRun.total_employees}
                </p>
              </div>
            </div>
          )}

          {/* Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {runsLoading ? (
              <div className="p-12">
                <LoadingState text="Loading payroll run records..." />
              </div>
            ) : !activeRun ? (
              <div className="p-16 text-center space-y-3">
                <CreditCard className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No Payroll Run for {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click the Calculate Run button above to run the centralized salary calculation engine based on active
                  employees and monthly attendance loss of pay.
                </p>
                <button
                  onClick={handleCalculatePayroll}
                  disabled={calculating}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <Calculator className="w-3.5 h-3.5 mr-1.5" />
                  {calculating ? 'Calculating...' : 'Run Calculations Now'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3 text-center">Work Days</th>
                      <th className="px-4 py-3 text-right">Basic Salary</th>
                      <th className="px-4 py-3 text-right">Gross Salary</th>
                      <th className="px-4 py-3 text-right">LOP Deduction</th>
                      <th className="px-4 py-3 text-right">Total Deductions</th>
                      <th className="px-4 py-3 text-right font-bold">Net Salary</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {(activeRun.records || []).map((rec: any) => (
                      <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          <div>{rec.employee_name}</div>
                          <span className="text-[10px] text-slate-400 font-mono font-normal">
                            {rec.employee_code} &bull; {rec.designation}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {rec.department_name || 'General'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {rec.present_days}
                          </span>{' '}
                          / {rec.working_days}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          ₹{Number(rec.basic_salary).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                          ₹{Number(rec.gross_salary).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-600 font-medium">
                          {Number(rec.loss_of_pay_amount) > 0 ? `₹${Number(rec.loss_of_pay_amount).toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-600 font-medium">
                          ₹{Number(rec.total_deductions).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{Number(rec.net_salary).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => navigate(`/payroll/payslip/${rec.id}`)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 rounded transition-colors"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Payslip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: CONFIGURABLE SALARY COMPONENTS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'components' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Configurable Salary Components
            </h2>
            <button
              onClick={() => {
                setEditingComp(null);
                setCompFormData({
                  name: '',
                  type: 'earning',
                  calculationType: 'fixed',
                  percentageOf: 'Basic Salary',
                  defaultValue: 0,
                  isTaxable: true,
                  isStatutory: false,
                  isActive: true,
                  description: '',
                });
                setShowCompModal(true);
              }}
              className="inline-flex items-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Component
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {compLoading ? (
              <div className="p-12">
                <LoadingState text="Loading components..." />
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                    <th className="px-4 py-3">Component Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Calculation Method</th>
                    <th className="px-4 py-3">Default / Percentage</th>
                    <th className="px-4 py-3">Taxable / Statutory</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {components.map((comp) => (
                    <tr key={comp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {comp.name}
                        {comp.description && (
                          <span className="block text-[10px] text-slate-400 font-normal">{comp.description}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'px-2 py-0.5 text-[10px] font-bold rounded uppercase',
                            comp.type === 'earning'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          )}
                        >
                          {comp.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 capitalize">
                        {comp.calculation_type} {comp.percentage_of ? `(${comp.percentage_of})` : ''}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {comp.calculation_type === 'percentage'
                          ? `${comp.default_value}%`
                          : `₹${Number(comp.default_value).toLocaleString('en-IN')}`}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {comp.is_taxable ? 'Taxable' : 'Non-taxable'}{' '}
                        {comp.is_statutory ? '&bull; Statutory' : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'px-2 py-0.5 text-[10px] font-bold rounded',
                            comp.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'
                              : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {comp.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setEditingComp(comp);
                            setCompFormData({
                              name: comp.name,
                              type: comp.type,
                              calculationType: comp.calculation_type,
                              percentageOf: comp.percentage_of || 'Basic Salary',
                              defaultValue: comp.default_value,
                              isTaxable: !!comp.is_taxable,
                              isStatutory: !!comp.is_statutory,
                              isActive: !!comp.is_active,
                              description: comp.description || '',
                            });
                            setShowCompModal(true);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: EMPLOYEE STRUCTURES */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Employee Salary Structures
            </h2>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {empLoading ? (
              <div className="p-12">
                <LoadingState text="Loading employee records..." />
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Designation</th>
                    <th className="px-4 py-3 text-right">Basic Monthly Salary</th>
                    <th className="px-4 py-3 text-center">Structure Customization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        <div>{emp.first_name} {emp.last_name}</div>
                        <span className="text-[10px] text-slate-400 font-mono font-normal">{emp.employee_id}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {emp.department_name || 'Engineering'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {emp.designation}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Number(emp.basic_salary || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openStructureEditor(emp)}
                          className="inline-flex items-center px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                        >
                          <Settings className="w-3 h-3 mr-1.5 text-slate-400" />
                          Configure Components
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 4: MY PAYSLIPS (EMPLOYEE VIEW) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'my-payslips' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              My Official Payslips
            </h2>
          </div>

          {myPayslipsLoading ? (
            <div className="p-12">
              <LoadingState text="Loading your payslips..." />
            </div>
          ) : myPayslips.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No finalized payslips available yet. Check back once the admin finalizes the monthly payroll run.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                    <th className="px-4 py-3">Payslip Number</th>
                    <th className="px-4 py-3">Month / Year</th>
                    <th className="px-4 py-3 text-right">Gross Salary</th>
                    <th className="px-4 py-3 text-right">Total Deductions</th>
                    <th className="px-4 py-3 text-right font-bold">Net Salary</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {myPayslips.map((ps) => (
                    <tr key={ps.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {ps.payslip_number}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {months.find((m) => m.value === ps.month)?.label} {ps.year}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        ₹{Number(ps.gross_salary).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600">
                        ₹{Number(ps.total_deductions).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ₹{Number(ps.net_salary).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {ps.payment_status || 'Paid'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => navigate(`/payroll/payslip/${ps.id}`)}
                          className="inline-flex items-center px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View Payslip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT SALARY COMPONENT */}
      {/* --------------------------------------------------------------------- */}
      {showCompModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingComp ? 'Edit Salary Component' : 'Create Salary Component'}
            </h3>
            <form onSubmit={handleSaveComponent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Component Name *
                </label>
                <input
                  type="text"
                  required
                  value={compFormData.name}
                  onChange={(e) => setCompFormData({ ...compFormData, name: e.target.value })}
                  placeholder="e.g., Performance Bonus"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Component Type
                  </label>
                  <select
                    value={compFormData.type}
                    onChange={(e) => setCompFormData({ ...compFormData, type: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Calculation Method
                  </label>
                  <select
                    value={compFormData.calculationType}
                    onChange={(e) => setCompFormData({ ...compFormData, calculationType: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
              </div>

              {compFormData.calculationType === 'percentage' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Percentage Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={compFormData.defaultValue}
                      onChange={(e) => setCompFormData({ ...compFormData, defaultValue: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Percentage Of
                    </label>
                    <select
                      value={compFormData.percentageOf}
                      onChange={(e) => setCompFormData({ ...compFormData, percentageOf: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="Basic Salary">Basic Salary</option>
                      <option value="Gross">Gross Salary</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Fixed Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={compFormData.defaultValue}
                    onChange={(e) => setCompFormData({ ...compFormData, defaultValue: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center space-x-4 pt-1">
                <label className="flex items-center text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compFormData.isTaxable}
                    onChange={(e) => setCompFormData({ ...compFormData, isTaxable: e.target.checked })}
                    className="mr-2 rounded text-blue-600"
                  />
                  Is Taxable
                </label>
                <label className="flex items-center text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compFormData.isStatutory}
                    onChange={(e) => setCompFormData({ ...compFormData, isStatutory: e.target.checked })}
                    className="mr-2 rounded text-blue-600"
                  />
                  Is Statutory
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCompModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Save Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CUSTOMIZE EMPLOYEE STRUCTURE */}
      {/* --------------------------------------------------------------------- */}
      {structModalOpen && selectedEmpForStruct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Salary Structure: {selectedEmpForStruct.first_name} {selectedEmpForStruct.last_name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{selectedEmpForStruct.employee_id}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Basic Salary (₹)
                </label>
                <input
                  type="number"
                  value={empBasicSalary}
                  onChange={(e) => setEmpBasicSalary(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-bold p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                  Assigned Components
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {empStructure.map((comp, idx) => (
                    <div
                      key={comp.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <span className="font-semibold text-slate-900 dark:text-white">{comp.name}</span>
                        <span className="block text-[10px] text-slate-400 capitalize">
                          {comp.type} &bull; {comp.calculation_type}
                        </span>
                      </div>
                      <div className="w-36">
                        {comp.calculation_type === 'percentage' ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              step="0.1"
                              value={comp.assigned_percentage}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setEmpStructure((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, assigned_percentage: val } : item))
                                );
                              }}
                              className="w-20 p-1.5 text-xs text-right font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <span className="text-xs font-semibold text-slate-500">%</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs font-semibold text-slate-500">₹</span>
                            <input
                              type="number"
                              value={comp.assigned_amount}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setEmpStructure((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, assigned_amount: val } : item))
                                );
                              }}
                              className="w-28 p-1.5 text-xs text-right font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setStructModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployeeStructure}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Save Structure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
