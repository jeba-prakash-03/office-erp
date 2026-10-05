import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Briefcase, Calendar, DollarSign, Users, CheckCircle2, Clock, 
  ArrowLeft, Plus, Trash2, Edit, AlertCircle, CheckSquare, Layers 
} from 'lucide-react';
import { projectsApi, employeesApi } from '../../api/services';
import { Project, Employee } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { ProjectModal } from './ProjectModal';

export const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [project, setProject] = useState<Project | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [selectedRole, setSelectedRole] = useState('developer');
  const [submittingMember, setSubmittingMember] = useState(false);

  const fetchProject = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await projectsApi.getById(Number(id));
      setProject(res.data.data);
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to load project details');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await employeesApi.getAll({ status: 'active', limit: 100 });
      setEmployees(res.data.data.employees || res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProject();
    fetchEmployees();
  }, [id]);

  const handleDelete = async () => {
    if (!project) return;
    try {
      await projectsApi.delete(project.id);
      showNotification('success', 'Project deleted successfully');
      navigate('/projects');
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !selectedEmployeeId) return;

    setSubmittingMember(true);
    try {
      await projectsApi.addMember(project.id, {
        employee_id: Number(selectedEmployeeId),
        role: selectedRole
      });
      showNotification('success', 'Team member added successfully');
      setAddMemberModalOpen(false);
      setSelectedEmployeeId('');
      fetchProject();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to add member');
    } finally {
      setSubmittingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!project) return;
    try {
      await projectsApi.removeMember(project.id, memberId);
      showNotification('success', 'Member removed from project');
      fetchProject();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to remove member');
    }
  };

  if (loading) return <LoadingState text="Loading project overview..." />;
  if (!project) return null;

  const totalTasks = (project.task_counts?.todo || 0) + 
                     (project.task_counts?.in_progress || 0) + 
                     (project.task_counts?.review || 0) + 
                     (project.task_counts?.completed || 0);

  const completedTasks = project.task_counts?.completed || 0;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : project.progress || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <PageHeader
          title={project.name}
          subtitle={`Client: ${project.client_name || 'Internal'} • Code: ${project.code || 'PRJ-' + project.id}`}
          action={
            <div className="flex items-center gap-2">
              <Link
                to={`/tasks/kanban?project_id=${project.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Layers className="w-4 h-4" />
                Kanban Board
              </Link>
              {hasPermission('projects.edit') && (
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit Project
                </button>
              )}
              {hasPermission('projects.delete') && (
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-900"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status & Priority</span>
            <StatusBadge status={project.status} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status={project.priority} />
            <span className="text-sm text-slate-500 dark:text-slate-400">Billing: {project.billing_type || 'Fixed'}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Timeline</span>
          <div className="mt-2 text-sm text-slate-900 dark:text-slate-100 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Start: {project.start_date || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Deadline: {project.deadline || 'No deadline'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Financials</span>
          <div className="mt-2">
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              {Number(project.budget || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rate: ${project.hourly_rate || 0}/hr
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overall Progress</span>
          <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{taskProgress}%</span>
              <span className="text-xs text-slate-500">{completedTasks}/{totalTasks} Tasks</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${taskProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Description, Task breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Project Description</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {project.description || 'No detailed description provided for this project.'}
            </p>
          </div>

          {/* Task Metrics */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-500" />
                Task Breakdown
              </h3>
              <Link
                to={`/tasks?project_id=${project.id}`}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View all tasks →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
                <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">{project.task_counts?.todo || 0}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">To Do</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900 text-center">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{project.task_counts?.in_progress || 0}</span>
                <p className="text-xs text-blue-500 dark:text-blue-300 mt-1">In Progress</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-900 text-center">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{project.task_counts?.review || 0}</span>
                <p className="text-xs text-amber-500 dark:text-amber-300 mt-1">Under Review</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900 text-center">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{project.task_counts?.completed || 0}</span>
                <p className="text-xs text-emerald-500 dark:text-emerald-300 mt-1">Completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Team Members & Client */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Team Members ({project.members?.length || 0})
              </h3>
              {hasPermission('projects.edit') && (
                <button
                  onClick={() => setAddMemberModalOpen(true)}
                  className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md hover:bg-indigo-100 transition-colors"
                  title="Add Member"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {project.members && project.members.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {project.members.map((member) => (
                  <div key={member.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                        {member.first_name ? member.first_name[0] : 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                          {member.role || 'Member'} • {member.designation || 'Staff'}
                        </p>
                      </div>
                    </div>
                    {hasPermission('projects.edit') && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                        title="Remove Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                No team members assigned yet.
              </p>
            )}
          </div>

          {/* Client Details */}
          {project.client && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-500" />
                Client Information
              </h3>
              <div className="text-sm space-y-2 text-slate-600 dark:text-slate-300">
                <p><strong className="text-slate-900 dark:text-white">Company:</strong> {project.client.company_name}</p>
                <p><strong className="text-slate-900 dark:text-white">Contact:</strong> {project.client.contact_person}</p>
                <p><strong className="text-slate-900 dark:text-white">Email:</strong> {project.client.email}</p>
                <p><strong className="text-slate-900 dark:text-white">Phone:</strong> {project.client.phone || 'N/A'}</p>
                <Link
                  to={`/clients/${project.client.id}`}
                  className="inline-block mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View Client Profile →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        title="Add Team Member to Project"
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Employee
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">-- Choose Employee --</option>
              {employees
                .filter((emp) => !project.members?.some((m) => m.employee_id === emp.id))
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code}) - {emp.designation}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Project Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="project_manager">Project Manager</option>
              <option value="team_lead">Team Lead</option>
              <option value="developer">Developer</option>
              <option value="designer">UI/UX Designer</option>
              <option value="qa_tester">QA Tester</option>
              <option value="devops">DevOps Engineer</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setAddMemberModalOpen(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingMember || !selectedEmployeeId}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {submittingMember ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      {editModalOpen && (
        <ProjectModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          project={project}
          onSuccess={fetchProject}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? All associated tasks, milestones, and member assignments will be permanently removed.`}
        confirmText="Delete Project"
        type="danger"
      />
    </div>
  );
};
