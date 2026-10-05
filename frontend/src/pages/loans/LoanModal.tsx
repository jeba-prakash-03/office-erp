import React, { useState, useEffect } from 'react';
import { loansApi, employeesApi } from '../../api/services';
import { Employee } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

interface LoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoanModal: React.FC<LoanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: '',
    amount: '',
    type: 'loan',
    repayment_months: '12',
    monthly_deduction: '',
    reason: '',
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await employeesApi.getAll({ status: 'active', limit: 100 });
        setEmployees(res.data.data.employees || res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen]);

  // Recalculate monthly deduction when amount or tenure changes
  const handleAmountOrMonthsChange = (amountVal: string, monthsVal: string) => {
    const amt = Number(amountVal) || 0;
    const months = Number(monthsVal) || 1;
    const deduction = months > 0 ? (amt / months).toFixed(2) : '0';
    setFormData((prev) => ({
      ...prev,
      amount: amountVal,
      repayment_months: monthsVal,
      monthly_deduction: deduction,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.amount || !formData.reason.trim()) {
      showNotification('error', 'Please fill in all loan details');
      return;
    }

    setLoading(true);
    try {
      await loansApi.apply({
        employee_id: Number(formData.employee_id),
        amount: Number(formData.amount),
        type: formData.type,
        repayment_months: Number(formData.repayment_months),
        monthly_deduction: Number(formData.monthly_deduction),
        reason: formData.reason,
      });
      showNotification('success', 'Loan request submitted successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to submit loan application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Loan or Advance"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Employee <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.employee_id}
            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          >
            <option value="">-- Choose Employee --</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name} ({emp.employee_code}) - Base: ${emp.basic_salary || 0}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="loan">Long-term Loan</option>
              <option value="salary_advance">Salary Advance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Total Amount ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.amount}
              onChange={(e) => handleAmountOrMonthsChange(e.target.value, formData.repayment_months)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
              placeholder="e.g. 5000"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Repayment (Months)
            </label>
            <input
              type="number"
              required
              min="1"
              max="60"
              value={formData.repayment_months}
              onChange={(e) => handleAmountOrMonthsChange(formData.amount, e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Monthly Deduction ($)
            </label>
            <input
              type="text"
              readOnly
              value={formData.monthly_deduction}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 outline-none font-semibold"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Reason / Justification <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="State the purpose of the loan..."
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Loan Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
