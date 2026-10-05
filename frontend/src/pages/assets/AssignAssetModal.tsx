import React, { useState, useEffect } from 'react';
import { assetsApi, employeesApi } from '../../api/services';
import { Asset, Employee } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

interface AssignAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSuccess: () => void;
}

export const AssignAssetModal: React.FC<AssignAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: '',
    assigned_date: new Date().toISOString().substring(0, 10),
    notes: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset || !formData.employee_id) {
      showNotification('error', 'Please select an employee to assign this asset');
      return;
    }

    setLoading(true);
    try {
      await assetsApi.assign(asset.id, {
        employee_id: Number(formData.employee_id),
        assigned_date: formData.assigned_date,
        notes: formData.notes,
      });

      showNotification('success', `Asset assigned to employee successfully`);
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to assign asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Asset: ${asset?.name}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Assign To Employee <span className="text-red-500">*</span>
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
                {emp.first_name} {emp.last_name} ({emp.employee_code}) - {emp.designation}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Assignment Date
          </label>
          <input
            type="date"
            required
            value={formData.assigned_date}
            onChange={(e) => setFormData({ ...formData, assigned_date: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Handover Notes / Condition Remarks
          </label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g. Handed over with power brick and carrying case in perfect condition..."
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
            {loading ? 'Assigning...' : 'Assign Asset'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
