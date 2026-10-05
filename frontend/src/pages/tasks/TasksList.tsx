import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Plus, Layers, Search, Filter, Edit, Trash2, CheckSquare, 
  Calendar, User, Clock, Eye 
} from 'lucide-react';
import { tasksApi, projectsApi } from '../../api/services';
import { Task, Project } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TaskModal } from './TaskModal';
import { TaskDetailsModal } from './TaskDetailsModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const TasksList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('project_id') || '');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modals
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [detailsTaskId, setDetailsTaskId] = useState<number | string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 15,
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        project_id: selectedProjectId || undefined,
      };

      const [res, projRes] = await Promise.all([
        tasksApi.getAll(params),
        projectsApi.getAll({ limit: 100 }),
      ]);

      setTasks(res.data.data.tasks || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
      setProjects(projRes.data.data.projects || projRes.data.data);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [page, search, statusFilter, priorityFilter, selectedProjectId]);

  const handleDelete = async () => {
    if (!taskToDelete) return;
    try {
      await tasksApi.delete(taskToDelete.id);
      showNotification('success', 'Task deleted successfully');
      fetchTasks();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to delete task');
    }
  };

  const columns: Column<Task>[] = [
    {
      header: 'Task Title',
      accessor: (t) => (
        <div>
          <button
            onClick={() => setDetailsTaskId(t.id)}
            className="text-left font-medium text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {t.title}
          </button>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t.project_name || 'General Project'}
          </div>
        </div>
      ),
    },
    {
      header: 'Assigned To',
      accessor: (t) => (
        <div className="flex items-center gap-2">
          {t.assignee_name ? (
            <>
              <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                {t.assignee_name[0]}
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">{t.assignee_name}</span>
            </>
          ) : (
            <span className="text-xs text-slate-400 italic">Unassigned</span>
          )}
        </div>
      ),
    },
    {
      header: 'Priority',
      accessor: (t) => <StatusBadge status={t.priority} />,
    },
    {
      header: 'Status',
      accessor: (t) => <StatusBadge status={t.status} />,
    },
    {
      header: 'Due Date',
      accessor: (t) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {t.due_date ? t.due_date.substring(0, 10) : '—'}
        </span>
      ),
    },
    {
      header: 'Logged / Est.',
      accessor: (t) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {t.logged_hours || 0} / {t.estimated_hours || 0} hrs
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setDetailsTaskId(t.id)}
            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {hasPermission('tasks.edit') && (
            <button
              onClick={() => {
                setSelectedTask(t);
                setTaskModalOpen(true);
              }}
              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Edit Task"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {hasPermission('tasks.delete') && (
            <button
              onClick={() => {
                setTaskToDelete(t);
                setDeleteDialogOpen(true);
              }}
              className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Delete Task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks Management"
        subtitle={`Track sprints, assignments, and deliverables (${totalRecords} tasks recorded)`}
        action={
          <div className="flex items-center gap-3">
            <Link
              to="/tasks/kanban"
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Layers className="w-4 h-4" />
              Kanban View
            </Link>
            {hasPermission('tasks.create') && (
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setTaskModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <select
          value={selectedProjectId}
          onChange={(e) => {
            setSelectedProjectId(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
        >
          <option value="">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Under Review</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={tasks}
        keyField="id"
        loading={loading}
        emptyMessage="No tasks found matching current filters."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {/* Task Edit/Create Modal */}
      {taskModalOpen && (
        <TaskModal
          isOpen={taskModalOpen}
          onClose={() => {
            setTaskModalOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          onSuccess={fetchTasks}
        />
      )}

      {/* Task Details Drawer/Modal */}
      {detailsTaskId && (
        <TaskDetailsModal
          isOpen={!!detailsTaskId}
          onClose={() => setDetailsTaskId(null)}
          taskId={detailsTaskId}
          onTaskUpdated={fetchTasks}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setTaskToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Task"
        message={`Are you sure you want to delete task "${taskToDelete?.title}"?`}
        confirmText="Delete Task"
        type="danger"
      />
    </div>
  );
};
