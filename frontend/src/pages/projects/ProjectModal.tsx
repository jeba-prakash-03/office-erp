import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Project, Client, Employee } from '../../types';
import { clientsApi, employeesApi, projectsApi } from '../../api/services';
import { useNotification } from '../../context/NotificationContext';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => Promise<void>;
  onSuccess?: () => void;
  initialData?: Project | null;
  project?: Project | null;
  loading?: boolean;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
  initialData,
  project,
  loading = false,
}) => {
  const { showNotification } = useNotification();
  const currentProject = project || initialData;
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    projectCode: '',
    name: '',
    clientId: '',
    description: '',
    projectManagerId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    budget: 50000,
    status: 'planning',
    priority: 'medium',
    technology: 'React, Node.js, MySQL',
    repositoryUrl: '',
    productionUrl: '',
    notes: '',
    memberIds: [] as (string | number)[],
  });

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        clientsApi.list({ limit: 100 }),
        employeesApi.list({ limit: 100 }),
      ]).then(([cRes, eRes]) => {
        if (cRes.data?.data) setClients(cRes.data.data.clients || cRes.data.data);
        if (eRes.data?.data) setEmployees(eRes.data.data.employees || eRes.data.data);
      });

      if (currentProject) {
        setFormData({
          projectCode: currentProject.code || currentProject.project_code || '',
          name: currentProject.name || '',
          clientId: currentProject.client_id ? String(currentProject.client_id) : '',
          description: currentProject.description || '',
          projectManagerId: currentProject.project_manager_id ? String(currentProject.project_manager_id) : '',
          startDate: currentProject.start_date ? currentProject.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
          endDate: currentProject.deadline ? currentProject.deadline.split('T')[0] : currentProject.end_date ? currentProject.end_date.split('T')[0] : '',
          budget: Number(currentProject.budget) || 0,
          status: currentProject.status || 'planning',
          priority: currentProject.priority || 'medium',
          technology: currentProject.technology || '',
          repositoryUrl: currentProject.repository_url || '',
          productionUrl: currentProject.production_url || '',
          notes: currentProject.notes || '',
          memberIds: currentProject.members ? currentProject.members.map((m: any) => m.employee_id || m.id) : [],
        });
      } else {
        const autoCode = `PRJ-${Math.floor(1000 + Math.random() * 9000)}`;
        setFormData({
          projectCode: autoCode,
          name: '',
          clientId: '',
          description: '',
          projectManagerId: '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          budget: 50000,
          status: 'planning',
          priority: 'medium',
          technology: 'React, Node.js, MySQL',
          repositoryUrl: '',
          productionUrl: '',
          notes: '',
          memberIds: [],
        });
      }
    }
  }, [isOpen, currentProject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      await onSubmit(formData);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        code: formData.projectCode,
        client_id: formData.clientId ? Number(formData.clientId) : undefined,
        description: formData.description,
        project_manager_id: formData.projectManagerId ? Number(formData.projectManagerId) : undefined,
        start_date: formData.startDate,
        deadline: formData.endDate || undefined,
        budget: Number(formData.budget),
        status: formData.status,
        priority: formData.priority,
        technology: formData.technology,
        repository_url: formData.repositoryUrl || undefined,
        production_url: formData.productionUrl || undefined,
        notes: formData.notes || undefined,
      };

      if (currentProject) {
        await projectsApi.update(currentProject.id, payload);
        showNotification('success', 'Project updated successfully');
      } else {
        await projectsApi.create(payload);
        showNotification('success', 'Project created successfully');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleMember = (empId: string | number) => {
    setFormData((prev) => ({
      ...prev,
      memberIds: prev.memberIds.some((id) => String(id) === String(empId))
        ? prev.memberIds.filter((id) => String(id) !== String(empId))
        : [...prev.memberIds, empId],
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentProject ? `Edit Project: ${currentProject.name}` : 'Create New Project'}
      description="Set up project scope, timeline, manager, budget, and assigned team"
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Project Code *
            </label>
            <input
              type="text"
              required
              value={formData.projectCode}
              onChange={(e) => setFormData({ ...formData, projectCode: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Healthcare Mobile App"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Client
            </label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            >
              <option value="">Internal Project (No Client)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} ({c.client_code || 'Client'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Project Manager
            </label>
            <select
              value={formData.projectManagerId}
              onChange={(e) => setFormData({ ...formData, projectManagerId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            >
              <option value="">Select Project Manager</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.designation})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Completion Date
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Total Budget ($)
            </label>
            <input
              type="number"
              min="0"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Technology Stack
            </label>
            <input
              type="text"
              value={formData.technology}
              onChange={(e) => setFormData({ ...formData, technology: e.target.value })}
              placeholder="e.g. React, TypeScript, Python, AWS"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Project Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief project background, objectives..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Team Members Assignment */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Assign Team Members ({formData.memberIds.length} selected)
          </label>
          <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            {employees.map((emp) => {
              const isSelected = formData.memberIds.some((id) => String(id) === String(emp.id));
              return (
                <label
                  key={emp.id}
                  className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-xs transition ${
                    isSelected ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleMember(emp.id)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="truncate">{emp.first_name} {emp.last_name} ({emp.designation})</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || submitting}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            {(loading || submitting) && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
            {currentProject ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
