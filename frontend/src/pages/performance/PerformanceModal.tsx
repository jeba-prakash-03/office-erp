import React, { useState, useEffect } from 'react';
import { performanceApi, employeesApi } from '../../api/services';
import { Employee } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';
import { Star, Award, CheckCircle2 } from 'lucide-react';

interface PerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const RATING_LEVELS = [
  { value: 1, label: '1 - Poor', short: 'Poor', color: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-400', active: 'bg-red-600 text-white border-red-600 shadow-sm' },
  { value: 2, label: '2 - Needs Improvement', short: 'Needs Work', color: 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400', active: 'bg-amber-600 text-white border-amber-600 shadow-sm' },
  { value: 3, label: '3 - Meets Expectations', short: 'Meets Exp.', color: 'border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400', active: 'bg-blue-600 text-white border-blue-600 shadow-sm' },
  { value: 4, label: '4 - Very Good', short: 'Very Good', color: 'border-indigo-300 text-indigo-700 dark:border-indigo-800 dark:text-indigo-400', active: 'bg-indigo-600 text-white border-indigo-600 shadow-sm' },
  { value: 5, label: '5 - Excellent', short: 'Outstanding', color: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400', active: 'bg-emerald-600 text-white border-emerald-600 shadow-sm' },
];

interface CompetencyItem {
  key: 'technical_skills' | 'productivity' | 'communication' | 'teamwork' | 'punctuality';
  title: string;
  description: string;
}

const COMPETENCIES: CompetencyItem[] = [
  { key: 'technical_skills', title: 'Technical Execution', description: 'Domain competence, code/work quality, accuracy, problem solving' },
  { key: 'productivity', title: 'Productivity & Output', description: 'Volume of work, velocity, milestone delivery, efficiency' },
  { key: 'communication', title: 'Communication', description: 'Clarity, responsiveness, stakeholder coordination, proactive updates' },
  { key: 'teamwork', title: 'Team Collaboration', description: 'Peer support, knowledge sharing, positive culture, cross-functional synergy' },
  { key: 'punctuality', title: 'Punctuality & Reliability', description: 'Attendance, deadline adherence, dependable ownership' },
];

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

  const overallScore = (
    (formData.technical_skills +
      formData.productivity +
      formData.communication +
      formData.teamwork +
      formData.punctuality) /
    5
  ).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id) {
      showNotification('error', 'Please select an employee');
      return;
    }

    setLoading(true);
    try {
      await performanceApi.create({
        employee_id: Number(formData.employee_id),
        review_period: formData.review_period,
        technical_skills: Number(formData.technical_skills),
        productivity: Number(formData.productivity),
        communication: Number(formData.communication),
        teamwork: Number(formData.teamwork),
        punctuality: Number(formData.punctuality),
        overall_rating: Number(overallScore),
        strengths: formData.strengths,
        areas_for_improvement: formData.areas_for_improvement,
        goals: formData.goals,
        feedback: formData.feedback,
      });

      showNotification('success', 'Performance appraisal review submitted successfully');
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
      title="Create Employee Performance Appraisal"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Employee & Period Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Employee <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select Employee for Review --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_code || `EMP-${emp.id}`} • {emp.designation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Review Period <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.review_period}
              onChange={(e) => setFormData({ ...formData, review_period: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Q1 2026, Q2 2026, Annual 2026"
            />
          </div>
        </div>

        {/* Section 2: Competency Rating Matrix (1 to 5) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Core Competency Evaluation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Score each domain from 1 (Poor) to 5 (Outstanding)
              </p>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Overall Rating: <strong className="text-indigo-600 dark:text-indigo-400 text-sm">{overallScore} / 5.0</strong>
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {COMPETENCIES.map((comp) => {
              const currentValue = formData[comp.key];
              return (
                <div
                  key={comp.key}
                  className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {comp.title}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {comp.description}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                      {currentValue} / 5
                    </span>
                  </div>

                  {/* 1 to 5 Buttons */}
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                    {RATING_LEVELS.map((lvl) => {
                      const isSelected = currentValue === lvl.value;
                      return (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, [comp.key]: lvl.value })}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                            isSelected
                              ? lvl.active
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                        >
                          <span className="font-bold text-xs">{lvl.value}</span>
                          <span className="hidden sm:inline text-[10px] opacity-90 truncate max-w-full">
                            {lvl.short}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Qualitative Feedback */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-1 border-b border-slate-200 dark:border-slate-700">
            Qualitative Assessment & Action Plan
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Key Strengths & Notable Achievements
              </label>
              <textarea
                rows={3}
                value={formData.strengths}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                placeholder="Specific high points, leadership demonstrated, positive impact..."
                className="w-full p-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Areas for Growth & Targeted Goals
              </label>
              <textarea
                rows={3}
                value={formData.areas_for_improvement}
                onChange={(e) => setFormData({ ...formData, areas_for_improvement: e.target.value })}
                placeholder="Skills to develop, upcoming certifications, measurable milestones..."
                className="w-full p-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Manager / Reviewer Summary Comments
            </label>
            <textarea
              rows={2}
              value={formData.feedback}
              onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
              placeholder="Concluding summary, compensation adjustment recommendation or career progression notes..."
              className="w-full p-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500">
            Calculated score will be published to the employee's appraisal history.
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Submitting Review...' : 'Submit Appraisal Review'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

