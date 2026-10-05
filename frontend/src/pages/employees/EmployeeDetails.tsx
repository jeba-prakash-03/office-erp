import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { employeesApi, companyApi } from '../../api/services';
import { Employee, CompanySettings } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { formatCurrency, formatDate, getInitials } from '../../utils/formatters';
import {
  User,
  Briefcase,
  Clock,
  CalendarCheck,
  CreditCard,
  TrendingUp,
  CheckSquare,
  FolderOpen,
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Upload,
  Trash2,
  Download,
  Calendar,
  DollarSign,
  FileText,
} from 'lucide-react';

export const EmployeeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Document upload state
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('Identification');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const { showToast } = useNotifications();
  const { hasPermission } = useAuth();

  const fetchEmployee = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [empRes, compRes] = await Promise.all([
        employeesApi.getById(id),
        companyApi.getSettings().catch(() => ({ data: { data: null } })),
      ]);
      if (empRes.data?.success) {
        setEmployee(empRes.data.data);
      }
      if (compRes.data?.data) {
        setCompanySettings(compRes.data.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load employee profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !docFile || !docTitle) {
      showToast('Please provide a document title and file', 'error');
      return;
    }

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('title', docTitle);
    formData.append('documentType', docType);
    formData.append('file', docFile);

    try {
      await employeesApi.uploadDocument(id, formData);
      showToast('Document uploaded successfully', 'success');
      setDocTitle('');
      setDocFile(null);
      fetchEmployee();
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string | number) => {
    if (!id) return;
    try {
      await employeesApi.deleteDocument(id, docId);
      showToast('Document removed', 'success');
      fetchEmployee();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete document', 'error');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <LoadingState message="Loading employee full profile & records..." />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-500">Employee not found.</p>
        <Link to="/employees" className="mt-4 inline-block text-brand-600 hover:underline text-sm font-semibold">
          ← Back to Employee Directory
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'personal', label: 'Personal Details', icon: User },
    { id: 'employment', label: 'Employment & Role', icon: Briefcase },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leave', label: 'Leaves & Balances', icon: CalendarCheck },
    { id: 'payroll', label: 'Payroll & Payslips', icon: CreditCard },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'tasks', label: 'Assigned Tasks', icon: CheckSquare },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'documents', label: 'Documents Vault', icon: FolderOpen },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back button & Breadcrumb */}
      <div>
        <Link
          to="/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Employee Roster
        </Link>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-bold text-xl flex items-center justify-center shadow-lg shadow-brand-500/20 flex-shrink-0 overflow-hidden">
              {employee.profile_photo ? (
                <img src={employee.profile_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(employee.first_name, employee.last_name)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {employee.first_name} {employee.last_name}
                </h1>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {employee.employee_id}
                </span>
                <StatusBadge status={employee.employment_status || 'active'} />
              </div>
              <p className="text-sm font-medium text-brand-600 dark:text-brand-400 mt-0.5">
                {employee.designation} • {employee.department_name || 'Unassigned Department'}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {employee.email}</span>
                {employee.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {employee.phone}</span>}
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {formatDate(employee.joining_date)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-6">
              <span className="text-[11px] text-slate-400 block font-medium">Base Salary</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(employee.basic_salary, companySettings?.currency || 'INR', companySettings?.currency_symbol || '₹')}
              </span>
              <span className="text-[11px] text-slate-400 block capitalize">{employee.employment_type?.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm min-h-[400px]">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Core Profile</h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-500">Employee ID:</span>
                  <span className="font-semibold text-slate-900 dark:text-white font-mono">{employee.employee_id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{employee.department_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-500">Designation:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{employee.designation}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-500">Reporting Manager:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{employee.reporting_manager_name || 'Direct to CEO'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Experience:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{employee.experience_years} Years</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Leave Balance Highlights</h3>
              <div className="grid grid-cols-2 gap-3">
                {(employee.leaveBalances || []).slice(0, 4).map((lb) => (
                  <div key={lb.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[11px] text-slate-500 font-medium truncate">{lb.leave_type_name}</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {lb.remaining_days} <span className="text-xs text-slate-400 font-normal">/ {lb.total_days} days</span>
                    </p>
                  </div>
                ))}
              </div>

              {employee.skills && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-500 mb-2">Technical Skills & Expertise</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {employee.skills.split(',').map((skill, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-300 rounded-lg text-xs font-medium border border-brand-200 dark:border-brand-800">
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PERSONAL DETAILS */}
        {activeTab === 'personal' && (
          <div className="max-w-2xl space-y-4 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Personal & Emergency Contact</h3>
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl">
              <div>
                <span className="text-slate-500 block">Date of Birth</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">{employee.date_of_birth ? employee.date_of_birth.split('T')[0] : 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Gender</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block capitalize">{employee.gender}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Residential Address</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">{employee.address || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Emergency Contact Name</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">{employee.emergency_contact_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Emergency Contact Phone</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">{employee.emergency_contact_phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EMPLOYMENT & SALARY STRUCTURE */}
        {activeTab === 'employment' && (
          <div className="space-y-6 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Salary Structure & Banking Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Monthly Earnings Breakdown</h4>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Basic Pay:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(employee.basic_salary, companySettings?.currency || 'INR', companySettings?.currency_symbol || '₹')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">House Rent Allowance (HRA):</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(employee.salaryStructure?.hra || 0, companySettings?.currency || 'INR', companySettings?.currency_symbol || '₹')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Special Allowance:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(employee.salaryStructure?.special_allowance || 0, companySettings?.currency || 'INR', companySettings?.currency_symbol || '₹')}</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-600 font-bold">
                  <span>Gross Monthly Earning:</span>
                  <span>{formatCurrency((Number(employee.basic_salary) + Number(employee.salaryStructure?.hra || 0) + Number(employee.salaryStructure?.special_allowance || 0)), companySettings?.currency || 'INR', companySettings?.currency_symbol || '₹')}</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Bank & Statutory Accounts</h4>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Bank Name:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{employee.bank_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Account Number:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{employee.bank_account_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Routing / IFSC:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{employee.bank_ifsc || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">PAN / Tax ID:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{employee.pan_number || employee.tax_id || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Attendance Log (Last 30 days)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Check In</th>
                    <th className="py-2.5 px-3">Check Out</th>
                    <th className="py-2.5 px-3">Working Hours</th>
                    <th className="py-2.5 px-3">Overtime</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(employee.attendance || []).length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">No attendance entries recorded yet.</td></tr>
                  ) : (
                    (employee.attendance || []).map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{att.date}</td>
                        <td className="py-2.5 px-3 text-slate-500">{att.check_in ? new Date(att.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{att.check_out ? new Date(att.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{att.total_hours} hrs</td>
                        <td className="py-2.5 px-3 text-emerald-600 font-semibold">{att.overtime_hours} hrs</td>
                        <td className="py-2.5 px-3"><StatusBadge status={att.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: LEAVE */}
        {activeTab === 'leave' && (
          <div className="space-y-6 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Leave Balance & Requests</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(employee.leaveBalances || []).map((b) => (
                <div key={b.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-slate-500 font-medium truncate">{b.leave_type_name}</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{b.remaining_days} <span className="text-xs text-slate-400 font-normal">left</span></p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Used: {b.used_days} • Pending: {b.pending_days}</p>
                </div>
              ))}
            </div>

            <h4 className="font-bold text-slate-900 dark:text-white pt-4">Recent Leave Applications</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Start Date</th>
                    <th className="py-2.5 px-3">End Date</th>
                    <th className="py-2.5 px-3">Days</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(employee.leaveRequests || []).length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-slate-400">No leave applications filed.</td></tr>
                  ) : (
                    (employee.leaveRequests || []).map((lr) => (
                      <tr key={lr.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{lr.leave_type_name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{lr.start_date}</td>
                        <td className="py-2.5 px-3 text-slate-500">{lr.end_date}</td>
                        <td className="py-2.5 px-3 font-bold">{lr.total_days}</td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{lr.reason}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={lr.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: PAYROLL */}
        {activeTab === 'payroll' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Generated Payslips & Salary Records</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Pay Period</th>
                    <th className="py-2.5 px-3">Gross Salary</th>
                    <th className="py-2.5 px-3">Deductions</th>
                    <th className="py-2.5 px-3">Net Take Home</th>
                    <th className="py-2.5 px-3">Payment Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(employee.payslips || []).length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-slate-400">No payslips generated for this employee yet.</td></tr>
                  ) : (
                    (employee.payslips || []).map((ps) => (
                      <tr key={ps.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{ps.month}/{ps.year}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{formatCurrency(ps.gross_salary, companySettings?.currency || 'INR', companySettings?.currency_symbol || '₹')}</td>
                        <td className="py-2.5 px-3 text-rose-500">-{formatCurrency((Number(ps.tax_deductions) + Number(ps.pf_deductions) + Number(ps.unpaid_leave_deductions)), companySettings?.currency || 'INR', companySettings?.currency_symbol || '₹')}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">{formatCurrency(ps.net_salary, companySettings?.currency || 'INR', companySettings?.currency_symbol || '₹')}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={ps.payment_status} /></td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            to={`/payroll/payslip/${ps.id}`}
                            className="px-2.5 py-1 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-md font-semibold transition"
                          >
                            View Payslip
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Performance Review History</h3>
            <div className="space-y-3">
              {(employee.performanceReviews || []).length === 0 ? (
                <p className="py-8 text-center text-slate-400">No performance reviews conducted yet.</p>
              ) : (
                (employee.performanceReviews || []).map((pr) => (
                  <div key={pr.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white capitalize">{pr.period} Review ({pr.cycle})</span>
                      <span className="px-2.5 py-1 bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-300 font-bold rounded-lg text-xs">
                        Overall Score: {pr.overall_score} / 5.0
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 italic">{pr.manager_feedback || 'No written comments.'}</p>
                    <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-400">
                      <span>Reviewer: {pr.reviewer_name || 'HR'}</span>
                      <span>Productivity: {pr.productivity ?? 'N/A'}</span>
                      <span>Quality: {pr.quality_rating || pr.overall_rating || 'N/A'}</span>
                      <span>Technical: {pr.technical_skills ?? 'N/A'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 8: TASKS & PROJECTS */}
        {activeTab === 'tasks' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Assigned Tasks</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Task</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(employee.tasks || []).length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-slate-400">No assigned tasks currently.</td></tr>
                  ) : (
                    (employee.tasks || []).map((tsk) => (
                      <tr key={tsk.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{tsk.title}</td>
                        <td className="py-2.5 px-3 text-slate-500">{tsk.project_name}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={tsk.priority} /></td>
                        <td className="py-2.5 px-3 text-slate-500">{tsk.due_date || 'N/A'}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={tsk.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 9: PROJECTS */}
        {activeTab === 'projects' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Project Memberships</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(employee.projects || []).length === 0 ? (
                <p className="py-6 text-slate-400 col-span-2 text-center">No assigned project memberships.</p>
              ) : (
                (employee.projects || []).map((prj) => (
                  <div key={prj.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <Link to={`/projects/${prj.id}`} className="font-bold text-slate-900 dark:text-white hover:text-brand-600 transition">
                        {prj.name}
                      </Link>
                      <StatusBadge status={prj.status} />
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">{prj.project_code}</p>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{prj.description || 'No description provided'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 10: DOCUMENTS VAULT */}
        {activeTab === 'documents' && (
          <div className="space-y-6 text-xs">
            {/* Upload Document Form */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-brand-500" /> Upload Employee Document
              </h4>
              <form onSubmit={handleUploadDocument} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Document Title (e.g. Passport, Degree)"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="Identification">Identification (ID / Passport)</option>
                  <option value="Contract">Employment Contract</option>
                  <option value="Certificate">Certificate / Degree</option>
                  <option value="Tax">Tax Document</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="file"
                  required
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
                <button
                  type="submit"
                  disabled={uploadingDoc}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {uploadingDoc ? 'Uploading...' : 'Save File'}
                </button>
              </form>
            </div>

            {/* Document List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(employee.documents || []).length === 0 ? (
                <p className="py-8 text-center text-slate-400">No documents uploaded for this employee yet.</p>
              ) : (
                (employee.documents || []).map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-brand-600 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-slate-900 dark:text-white hover:text-brand-600 transition"
                        >
                          {doc.title}
                        </a>
                        <p className="text-[11px] text-slate-400">{doc.document_type} • Uploaded {new Date(doc.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
