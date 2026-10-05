import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Plus, Filter, List, CheckSquare, Clock, Calendar, 
  User, AlertCircle, ArrowRight 
} from 'lucide-react';
import { tasksApi, projectsApi, employeesApi } from '../../api/services';
import { Task, Project, Employee } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { TaskModal } from './TaskModal';
import { TaskDetailsModal } from './TaskDetailsModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40' },
  { id: 'in_progress', title: 'In Progress', color: 'border-blue-300 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20' },
  { id: 'review', title: 'Under Review', color: 'border-amber-300 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20' },
  { id: 'completed', title: 'Completed', color: 'border-emerald-300 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20' },
];

export const TaskKanban: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const selectedProjectId = searchParams.get('project_id') || '';
  const selectedAssigneeId = searchParams.get('assigned_to') || '';

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [targetStatusForCreate, setTargetStatusForCreate] = useState('todo');
  const [activeDetailsTaskId, setActiveDetailsTaskId] = useState<number | string | null>(null);

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<number | string | null>(null);

  const fetchKanbanData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedProjectId) params.project_id = selectedProjectId;
      if (selectedAssigneeId) params.assigned_to = selectedAssigneeId;

      const [taskRes, projRes, empRes] = await Promise.all([
        tasksApi.getKanban(params),
        projectsApi.getAll({ limit: 100 }),
        employeesApi.getAll({ status: 'active', limit: 100 }),
      ]);

      const kanbanGrouped = taskRes.data.data;
      const flatList: Task[] = [
        ...(kanbanGrouped.todo || []),
        ...(kanbanGrouped.in_progress || []),
        ...(kanbanGrouped.review || []),
        ...(kanbanGrouped.completed || []),
      ];
      setTasks(flatList);
      setProjects(projRes.data.data.projects || projRes.data.data);
      setEmployees(empRes.data.data.employees || empRes.data.data);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load Kanban tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKanbanData();
  }, [selectedProjectId, selectedAssigneeId]);

  const handleDragStart = (e: React.DragEvent, id: number | string) => {
    e.dataTransfer.setData('text/plain', String(id));
    setDraggedTaskId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('text/plain');
    if (!taskIdStr) return;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (String(t.id) === taskIdStr ? { ...t, status: newStatus as any } : t))
    );

    try {
      await tasksApi.update(taskIdStr, { status: newStatus });
      showNotification('success', `Task moved to ${newStatus.replace('_', ' ')}`);
    } catch (err: any) {
      showNotification('error', 'Failed to update task position');
      fetchKanbanData();
    } finally {
      setDraggedTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks Kanban Board"
        subtitle="Visual workflow management and sprint tracking across all projects"
        action={
          <div className="flex items-center gap-3">
            <Link
              to="/tasks"
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <List className="w-4 h-4" />
              List View
            </Link>
            {hasPermission('tasks.create') && (
              <button
                onClick={() => {
                  setTargetStatusForCreate('todo');
                  setCreateModalOpen(true);
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
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Filter className="w-4 h-4" />
          <span>Filters:</span>
        </div>

        <select
          value={selectedProjectId}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            if (e.target.value) next.set('project_id', e.target.value);
            else next.delete('project_id');
            setSearchParams(next);
          }}
          className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none min-w-[180px]"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={selectedAssigneeId}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            if (e.target.value) next.set('assigned_to', e.target.value);
            else next.delete('assigned_to');
            setSearchParams(next);
          }}
          className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none min-w-[180px]"
        >
          <option value="">All Assignees</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.first_name} {emp.last_name}
            </option>
          ))}
        </select>

        {(selectedProjectId || selectedAssigneeId) && (
          <button
            onClick={() => setSearchParams({})}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState text="Loading Kanban boards..." />
      ) : (
        /* Columns Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
          {COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`rounded-xl border p-3 flex flex-col min-h-[550px] transition-colors ${col.color}`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{col.title}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {columnTasks.length}
                    </span>
                  </div>
                  {hasPermission('tasks.create') && (
                    <button
                      onClick={() => {
                        setTargetStatusForCreate(col.id);
                        setCreateModalOpen(true);
                      }}
                      className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors"
                      title="Add task to this column"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => setActiveDetailsTaskId(task.id)}
                      className={`p-3.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all ${
                        draggedTaskId === task.id ? 'opacity-40 ring-2 ring-indigo-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 tracking-wide uppercase truncate max-w-[140px]">
                          {task.project_name || 'General'}
                        </span>
                        <StatusBadge status={task.priority} />
                      </div>

                      <h4 className="text-xs font-medium text-slate-900 dark:text-slate-100 mb-2 line-clamp-2">
                        {task.title}
                      </h4>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-1.5">
                          {task.assignee_name ? (
                            <div
                              className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[9px]"
                              title={task.assignee_name}
                            >
                              {task.assignee_name[0]}
                            </div>
                          ) : (
                            <User className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span className="truncate max-w-[80px]">
                            {task.assignee_name || 'Unassigned'}
                          </span>
                        </div>

                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{task.due_date.substring(5, 10)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-slate-200 dark:border-slate-700/60 rounded-lg flex items-center justify-center text-xs text-slate-400">
                      Drag tasks here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Creation Modal */}
      {createModalOpen && (
        <TaskModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          defaultStatus={targetStatusForCreate}
          defaultProjectId={selectedProjectId ? Number(selectedProjectId) : undefined}
          onSuccess={fetchKanbanData}
        />
      )}

      {/* Task Details Drawer/Modal */}
      {activeDetailsTaskId && (
        <TaskDetailsModal
          isOpen={!!activeDetailsTaskId}
          onClose={() => setActiveDetailsTaskId(null)}
          taskId={activeDetailsTaskId}
          onTaskUpdated={fetchKanbanData}
        />
      )}
    </div>
  );
};
