import React, { useState, useEffect } from 'react';
import { meetingsApi, projectsApi, employeesApi } from '../../api/services';
import { Project, Employee } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MeetingModal: React.FC<MeetingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    project_id: '',
    date: new Date().toISOString().substring(0, 10),
    start_time: '10:00',
    end_time: '11:00',
    location: 'Conference Room A',
    meeting_url: '',
    agenda: '',
    participants: [] as number[],
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [pRes, eRes] = await Promise.all([
          projectsApi.getAll({ limit: 100 }),
          employeesApi.getAll({ status: 'active', limit: 100 }),
        ]);
        setProjects(pRes.data.data.projects || pRes.data.data);
        setEmployees(eRes.data.data.employees || eRes.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    if (isOpen) {
      fetchOptions();
    }
  }, [isOpen]);

  const handleParticipantToggle = (empId: number) => {
    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.includes(empId)
        ? prev.participants.filter((id) => id !== empId)
        : [...prev.participants, empId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.start_time) {
      showNotification('error', 'Please fill in mandatory meeting details');
      return;
    }

    setLoading(true);
    try {
      await meetingsApi.create({
        title: formData.title,
        project_id: formData.project_id ? Number(formData.project_id) : undefined,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time || undefined,
        location: formData.location || undefined,
        meeting_url: formData.meeting_url || undefined,
        agenda: formData.agenda || undefined,
        participants: formData.participants,
      });

      showNotification('success', 'Meeting scheduled and participants notified');
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to schedule meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Team Meeting"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Meeting Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Sprint Planning & Architecture Review"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              required
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              End Time
            </label>
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Location / Room
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Conference Room A / Zoom"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Meeting Video Link (Zoom, Meet, Teams)
            </label>
            <input
              type="url"
              value={formData.meeting_url}
              onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
              placeholder="https://meet.google.com/..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        {/* Participants Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Invite Attendees ({formData.participants.length} selected)
          </label>
          <div className="max-h-36 overflow-y-auto p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {employees.map((emp) => (
              <label key={emp.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.participants.includes(Number(emp.id))}
                  onChange={() => handleParticipantToggle(Number(emp.id))}
                  className="rounded text-indigo-600"
                />
                <span className="truncate">{emp.first_name} {emp.last_name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Agenda & Topics
          </label>
          <textarea
            rows={3}
            value={formData.agenda}
            onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
            placeholder="Discuss sprint deliverables, architecture blockers..."
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
            {loading ? 'Scheduling...' : 'Schedule Meeting'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
