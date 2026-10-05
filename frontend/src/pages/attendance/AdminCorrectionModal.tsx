import React, { useState, useEffect } from 'react';
import { attendanceApi, employeesApi } from '../../api/services';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';
import { Attendance, Employee } from '../../types';

interface AdminCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialAttendance?: Attendance | null;
}

export const AdminCorrectionModal: React.FC<AdminCorrectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialAttendance,
}) => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: '',
    date: new Date().toISOString().substring(0, 10),
    check_in: '09:00',
    check_out: '18:00',
    reason: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      if (initialAttendance) {
        const inTime = initialAttendance.check_in || initialAttendance.clock_in;
        const outTime = initialAttendance.check_out || initialAttendance.clock_out;
        setFormData({
          employee_id: String(initialAttendance.employee_id),
          date: initialAttendance.date ? String(initialAttendance.date).substring(0, 10) : new Date().toISOString().substring(0, 10),
          check_in: inTime ? (String(inTime).length > 10 ? String(inTime).substring(11, 16) : inTime) : '09:00',
          check_out: outTime ? (String(outTime).length > 10 ? String(outTime).substring(11, 16) : outTime) : '18:00',
          reason: '',
        });
      } else {
        setFormData({
          employee_id: '',
          date: new Date().toISOString().substring(0, 10),
          check_in: '09:00',
          check_out: '18:00',
          reason: '',
        });
      }
    }
  }, [isOpen, initialAttendance]);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const res = await employeesApi.getAll({ limit: 500 });
      setEmployees(res.data.data.records || res.data.data || []);
    } catch (err) {
      console.error('Failed to load employees for correction modal', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id) {
      showNotification('error', 'Please select an employee');
      return;
    }
    if (!formData.reason.trim()) {
      showNotification('error', 'Please provide an audit justification reason');
      return;
    }

    setLoading(true);
    try {
      const checkInDateTime = `${formData.date}T${formData.check_in}:00`;
      const checkOutDateTime = formData.check_out ? `${formData.date}T${formData.check_out}:00` : null;

      await attendanceApi.adminCorrection({
        employee_id: formData.employee_id,
        date: formData.date,
        check_in: checkInDateTime,
        check_out: checkOutDateTime,
        reason: formData.reason.trim(),
      });

      showNotification('success', 'Attendance record corrected successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update attendance';
      showNotification('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialAttendance ? `Edit Attendance Record` : `Admin Attendance Manual Entry`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Employee <span className="text-red-500">*</span>
          </label>
          <select
            required
            disabled={!!initialAttendance || loadingEmployees}
            value={formData.employee_id}
            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
          >
            <option value="">Select Employee...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name || ''} ({emp.employee_code || `ID: ${emp.id}`})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Attendance Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            disabled={!!initialAttendance}
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Clock In Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              required
              value={formData.check_in}
              onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Clock Out Time
            </label>
            <input
              type="time"
              value={formData.check_out}
              onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Audit Reason for Correction / Manual Entry <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Mandatory administrative justification (e.g., Authorized biometric failure adjustment per HR policy)..."
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving Changes...' : 'Save & Record Audit'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
