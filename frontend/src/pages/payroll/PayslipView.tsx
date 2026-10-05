import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Download, Building2, CheckCircle } from 'lucide-react';
import { payrollApi, companyApi } from '../../api/services';
import { Payroll, CompanySettings } from '../../types';
import { LoadingState } from '../../components/ui/LoadingState';
import { useNotification } from '../../context/NotificationContext';

export const PayslipView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [payRes, compRes] = await Promise.all([
          payrollApi.getById(Number(id)),
          companyApi.getSettings(),
        ]);
        setPayroll(payRes.data.data);
        setCompany(compRes.data.data);
      } catch (err: any) {
        showNotification('error', 'Failed to load payslip details');
        navigate('/payroll');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <LoadingState text="Generating payslip document..." />;
  if (!payroll) return null;

  const monthName = new Date(2026, Number(payroll.month) - 1, 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Action Bar (Hidden when printing) */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/payroll')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Payroll
        </button>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </div>

      {/* Official Payslip Printable Paper Document */}
      <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-200 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">
              {company?.company_name || 'ERP Systems Inc.'}
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-xs">
              {company?.address || 'Corporate Headquarters'}<br />
              Email: {company?.email || 'hr@company.local'} • Phone: {company?.phone || '+1 (555) 000-0000'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-lg font-bold text-indigo-700 uppercase tracking-widest block">
              Salary Payslip
            </span>
            <span className="text-sm font-semibold text-slate-800 mt-1 block">
              {monthName} {payroll.year}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Slip ID: #PAY-{payroll.id.toString().padStart(5, '0')}
            </span>
          </div>
        </div>

        {/* Employee Summary Details */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs mb-6">
          <div>
            <p className="mb-1"><strong className="text-slate-700">Employee Name:</strong> {payroll.employee_name}</p>
            <p className="mb-1"><strong className="text-slate-700">Employee ID:</strong> {payroll.employee_code || 'EMP-' + payroll.employee_id}</p>
            <p><strong className="text-slate-700">Designation:</strong> {payroll.designation || 'Staff Member'}</p>
          </div>
          <div>
            <p className="mb-1"><strong className="text-slate-700">Department:</strong> {payroll.department_name || 'General'}</p>
            <p className="mb-1"><strong className="text-slate-700">Payment Status:</strong> <span className="uppercase font-bold text-emerald-700">{payroll.status}</span></p>
            <p><strong className="text-slate-700">Paid Days:</strong> {payroll.working_days || 30} Days</p>
          </div>
        </div>

        {/* Earnings & Deductions Tables */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Earnings */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-200">
              Earnings
            </div>
            <div className="p-4 space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Basic Salary</span>
                <span className="font-semibold">${Number(payroll.basic_salary || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Allowances & Bonuses</span>
                <span className="font-semibold">${Number(payroll.allowances || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Overtime Pay</span>
                <span className="font-semibold">${Number(payroll.overtime_pay || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 font-bold text-slate-900 border-t border-slate-300">
                <span>Gross Earnings</span>
                <span>${Number(payroll.gross_salary || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-200">
              Deductions
            </div>
            <div className="p-4 space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Tax / Withholding</span>
                <span className="font-semibold">${Number(payroll.tax_deduction || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Leave / Attendance Deductions</span>
                <span className="font-semibold">${Number(payroll.attendance_deduction || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Loan / Advance Repayment</span>
                <span className="font-semibold">${Number(payroll.loan_deduction || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 font-bold text-slate-900 border-t border-slate-300">
                <span>Total Deductions</span>
                <span className="text-red-600">-${Number(payroll.total_deductions || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Net Salary Highlight */}
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-5 flex items-center justify-between mb-12">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 block">
              Net Take Home Salary
            </span>
            <span className="text-xs text-indigo-700">
              Transferred via direct company bank deposit
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-900">
            ${Number(payroll.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-200 text-center text-xs text-slate-600">
          <div>
            <div className="border-b border-slate-400 pb-8 mb-2"></div>
            <span className="font-semibold">Employer / Authorized Signatory</span>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-8 mb-2"></div>
            <span className="font-semibold">Employee Signature & Date</span>
          </div>
        </div>
      </div>
    </div>
  );
};
