import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsApi } from '../../api/services';
import { Project } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ProjectModal } from './ProjectModal';
import { Plus, Briefcase, Users, CheckSquare, DollarSign, Calendar, Edit2, Trash2 } from 'lucide-react';

export const ProjectsList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const { showToast } = useNotifications();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await projectsApi.list({
        search,
        status: statusFilter,
        limit: 50,
      });
      if (res.data?.success) {
        setProjects(res.data.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [search, statusFilter]);

  const handleCreateOrUpdate = async (formData: any) => {
    setModalLoading(true);
    try {
      if (editingProject) {
        await projectsApi.update(editingProject.id, formData);
        showToast('Project updated successfully', 'success');
      } else {
        await projectsApi.create(formData);
        showToast('Project created successfully', 'success');
      }
      setShowModal(false);
      setEditingProject(null);
      fetchProjects();
    } catch (err: any) {
      showToast(err.message || 'Failed to save project', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProject) return;
    setModalLoading(true);
    try {
      await projectsApi.delete(deletingProject.id);
      showToast('Project deleted successfully', 'success');
      setDeletingProject(null);
      fetchProjects();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete project', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects Portfolio"
        description="Active delivery projects, milestones, task progress, and budget burn-rates"
        actions={
          hasPermission('projects.create') && (
            <button
              onClick={() => {
                setEditingProject(null);
                setShowModal(true);
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 w-64 focus:outline-none"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <LoadingState message="Loading projects portfolio..." />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects found"
          description="Create your first client or internal project to start assigning tasks and tracking budgets."
          action={
            hasPermission('projects.create') && (
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl"
              >
                Create Project
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((prj) => {
            const totalTasks = prj.total_tasks || 0;
            const completedTasks = prj.completed_tasks || 0;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div
                key={prj.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-400">{prj.project_code}</span>
                    <StatusBadge status={prj.status} />
                  </div>

                  <Link
                    to={`/projects/${prj.id}`}
                    className="font-bold text-slate-900 dark:text-white text-base hover:text-brand-600 dark:hover:text-brand-400 transition line-clamp-1"
                  >
                    {prj.name}
                  </Link>
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-0.5">
                    {prj.client_name ? `Client: ${prj.client_name}` : 'Internal Initiative'}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 my-3">
                    {prj.description || 'No detailed scope description.'}
                  </p>

                  {/* Task Progress Bar */}
                  <div className="my-3">
                    <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                      <span>Tasks ({completedTasks}/{totalTasks})</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Budget / Spent</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      ${Number(prj.budget).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {hasPermission('projects.edit') && (
                      <button
                        onClick={() => {
                          setEditingProject(prj);
                          setShowModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {hasPermission('projects.delete') && (
                      <button
                        onClick={() => setDeletingProject(prj)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProjectModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingProject(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialData={editingProject}
        loading={modalLoading}
      />

      <ConfirmDialog
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete project "${deletingProject?.name}"?`}
        confirmText="Delete"
        isDestructive
        loading={modalLoading}
      />
    </div>
  );
};
