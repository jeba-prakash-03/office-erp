import React, { useState } from 'react';
import { payrollApi } from '../../api/services';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

interface ProcessPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProcessPayrollModal: React.FC<ProcessPayrollModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);

  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await payrollApi.generateMonthly({
        month: Number(month),
        year: Number(year),
      });
      showNotification('success', res.data.message || 'Payroll generated successfully for all eligible employees');
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to generate payroll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Monthly Payroll"
      size="sm"
    >
      <form onSubmit={handleProcess} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This operation will calculate base salaries, allowances, attendance deductions, tax withholding, and loans for all active employees for the selected billing cycle.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2026, i, 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Year
            </label>
            <input
              type="number"
              value={year}
              min="2020"
              max="2035"
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {loading ? 'Calculating...' : 'Run Payroll'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
