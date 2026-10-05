import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, MessageSquare, Clock, User, Calendar, 
  Send, Trash2, Check, AlertCircle, Paperclip 
} from 'lucide-react';
import { tasksApi } from '../../api/services';
import { Task, TaskComment, TaskChecklist } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: number | string | null;
  onTaskUpdated?: () => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  isOpen,
  onClose,
  taskId,
  onTaskUpdated,
}) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');

  const fetchTaskDetails = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await tasksApi.getById(taskId);
      setTask(res.data.data);
    } catch (err: any) {
      showNotification('error', 'Failed to load task details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTaskDetails();
    }
  }, [isOpen, taskId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await tasksApi.addComment(taskId, { comment: newComment.trim() });
      setNewComment('');
      fetchTaskDetails();
      if (onTaskUpdated) onTaskUpdated();
    } catch (err: any) {
      showNotification('error', 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !newChecklistTitle.trim()) return;

    try {
      await tasksApi.addChecklistItem(taskId, { title: newChecklistTitle.trim() });
      setNewChecklistTitle('');
      fetchTaskDetails();
    } catch (err: any) {
      showNotification('error', 'Failed to add checklist item');
    }
  };

  const handleToggleChecklist = async (item: TaskChecklist) => {
    if (!taskId) return;
    try {
      await tasksApi.updateChecklistItem(taskId, item.id, { is_completed: !item.is_completed });
      fetchTaskDetails();
    } catch (err: any) {
      showNotification('error', 'Failed to update checklist item');
    }
  };

  const handleDeleteChecklist = async (itemId: number | string) => {
    if (!taskId) return;
    try {
      await tasksApi.deleteChecklistItem(taskId, itemId);
      fetchTaskDetails();
    } catch (err: any) {
      showNotification('error', 'Failed to delete checklist item');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!taskId) return;
    try {
      await tasksApi.update(taskId, { status: newStatus });
      fetchTaskDetails();
      if (onTaskUpdated) onTaskUpdated();
      showNotification('success', `Status changed to ${newStatus}`);
    } catch (err: any) {
      showNotification('error', 'Failed to update status');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? task.title : 'Task Details'}
      size="xl"
    >
      {loading || !task ? (
        <div className="py-12 text-center text-slate-500">Loading task data...</div>
      ) : (
        <div className="space-y-6">
          {/* Header meta */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Project:</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {task.project_name || 'Internal'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Under Review</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <StatusBadge status={task.priority} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left 2 Cols: Description, Checklists, Comments */}
            <div className="md:col-span-2 space-y-6">
              {/* Description */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Description</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line bg-slate-50 dark:bg-slate-700/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  {task.description || 'No description provided.'}
                </p>
              </div>

              {/* Checklist */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-500" />
                  Checklist
                </h4>
                <div className="space-y-2 mb-3">
                  {task.checklists && task.checklists.length > 0 ? (
                    task.checklists.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(item)}
                          className="flex items-center gap-2 text-left text-sm text-slate-700 dark:text-slate-200 flex-1"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              item.is_completed
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-400 bg-white dark:bg-slate-800'
                            }`}
                          >
                            {item.is_completed && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                          <span className={item.is_completed ? 'line-through text-slate-400' : ''}>
                            {item.title}
                          </span>
                        </button>
                        <button
                          onClick={() => handleDeleteChecklist(item.id)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No checklist items yet.</p>
                  )}
                </div>
                <form onSubmit={handleAddChecklist} className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="Add item..."
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newChecklistTitle.trim()}
                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                  >
                    Add
                  </button>
                </form>
              </div>

              {/* Comments Feed */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  Activity & Comments ({task.comments?.length || 0})
                </h4>

                <div className="space-y-3 mb-4 max-h-56 overflow-y-auto pr-1">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((comm) => (
                      <div key={comm.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {comm.user_name || 'Team Member'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {comm.created_at ? new Date(comm.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {comm.comment}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No comments posted yet.</p>
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment or update..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !newComment.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Post
                  </button>
                </form>
              </div>
            </div>

            {/* Right Meta Column */}
            <div className="space-y-4 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="text-slate-400 block mb-1 font-medium">Assigned To</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    {task.assignee_name ? task.assignee_name[0] : 'U'}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {task.assignee_name || 'Unassigned'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 font-medium">Due Date</span>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{task.due_date ? task.due_date.substring(0, 10) : 'Not specified'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 font-medium">Time Tracking</span>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {task.logged_hours || 0} hrs logged / {task.estimated_hours || 0} hrs est.
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 font-medium">Created On</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
