import React, { useState, useEffect } from 'react';
import { leaveApi } from '../../api/services';
import { LeaveType } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_type: 'first_half',
    reason: '',
  });

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const res = await leaveApi.getTypes();
        setLeaveTypes(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    if (isOpen) {
      fetchTypes();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date || !formData.reason.trim()) {
      showNotification('error', 'Please fill in all mandatory leave details');
      return;
    }

    setLoading(true);
    try {
      await leaveApi.apply({
        leave_type_id: Number(formData.leave_type_id),
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_half_day: formData.is_half_day,
        half_day_type: formData.is_half_day ? formData.half_day_type : undefined,
        reason: formData.reason,
      });
      showNotification('success', 'Leave application submitted for approval');
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to submit leave application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Leave Category <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.leave_type_id}
            onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          >
            <option value="">-- Select Leave Type --</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.days_per_year} days/yr {t.is_paid ? '• Paid' : '• Unpaid'})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-lg">
          <input
            type="checkbox"
            id="is_half_day"
            checked={formData.is_half_day}
            onChange={(e) => setFormData({ ...formData, is_half_day: e.target.checked })}
            className="w-4 h-4 text-indigo-600 rounded"
          />
          <label htmlFor="is_half_day" className="text-sm text-slate-700 dark:text-slate-300 font-medium">
            This is a half-day leave
          </label>
        </div>

        {formData.is_half_day && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Half Day Session
            </label>
            <select
              value={formData.half_day_type}
              onChange={(e) => setFormData({ ...formData, half_day_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="first_half">First Half (Morning)</option>
              <option value="second_half">Second Half (Afternoon)</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Reason for Leave <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Please provide details for the approval manager..."
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
            {loading ? 'Submitting...' : 'Apply Leave'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
