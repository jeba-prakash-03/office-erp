import React, { useState, useEffect } from 'react';
import { performanceApi, employeesApi } from '../../api/services';
import { Employee } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

interface PerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PerformanceModal: React.FC<PerformanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: '',
    review_period: 'Q1 2026',
    technical_skills: 4,
    productivity: 4,
    communication: 4,
    teamwork: 4,
    punctuality: 4,
    strengths: '',
    areas_for_improvement: '',
    goals: '',
    feedback: '',
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
    if (!formData.employee_id) {
      showNotification('error', 'Please select an employee');
      return;
    }

    setLoading(true);
    try {
      const overallRating = (
        (formData.technical_skills +
          formData.productivity +
          formData.communication +
          formData.teamwork +
          formData.punctuality) /
        5
      ).toFixed(2);

      await performanceApi.create({
        employee_id: Number(formData.employee_id),
        review_period: formData.review_period,
        technical_skills: Number(formData.technical_skills),
        productivity: Number(formData.productivity),
        communication: Number(formData.communication),
        teamwork: Number(formData.teamwork),
        punctuality: Number(formData.punctuality),
        overall_rating: Number(overallRating),
        strengths: formData.strengths,
        areas_for_improvement: formData.areas_for_improvement,
        goals: formData.goals,
        feedback: formData.feedback,
      });

      showNotification('success', 'Performance review submitted successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Employee Appraisal Review"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
                  {emp.first_name} {emp.last_name} ({emp.designation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Review Period
            </label>
            <input
              type="text"
              required
              value={formData.review_period}
              onChange={(e) => setFormData({ ...formData, review_period: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
              placeholder="e.g. Q1 2026 / Annual 2026"
            />
          </div>
        </div>

        {/* Rating Metrics (1 to 5) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-xl space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Competency Ratings (1 to 5 Scale)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Technical Execution: <strong className="text-indigo-600">{formData.technical_skills}/5</strong>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={formData.technical_skills}
                onChange={(e) => setFormData({ ...formData, technical_skills: Number(e.target.value) })}
                className="w-full cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Productivity & Output: <strong className="text-indigo-600">{formData.productivity}/5</strong>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={formData.productivity}
                onChange={(e) => setFormData({ ...formData, productivity: Number(e.target.value) })}
                className="w-full cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Communication: <strong className="text-indigo-600">{formData.communication}/5</strong>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={formData.communication}
                onChange={(e) => setFormData({ ...formData, communication: Number(e.target.value) })}
                className="w-full cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Team Collaboration: <strong className="text-indigo-600">{formData.teamwork}/5</strong>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={formData.teamwork}
                onChange={(e) => setFormData({ ...formData, teamwork: Number(e.target.value) })}
                className="w-full cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Punctuality & Discipline: <strong className="text-indigo-600">{formData.punctuality}/5</strong>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={formData.punctuality}
                onChange={(e) => setFormData({ ...formData, punctuality: Number(e.target.value) })}
                className="w-full cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Key Strengths
          </label>
          <textarea
            rows={2}
            value={formData.strengths}
            onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
            placeholder="Notable achievements, high performance areas..."
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Areas for Improvement & Actionable Goals
          </label>
          <textarea
            rows={2}
            value={formData.areas_for_improvement}
            onChange={(e) => setFormData({ ...formData, areas_for_improvement: e.target.value })}
            placeholder="Suggested training, milestones for next quarter..."
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
            {loading ? 'Submitting...' : 'Save Appraisal'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
