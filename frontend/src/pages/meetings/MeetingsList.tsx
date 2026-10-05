import React, { useState, useEffect } from 'react';
import { 
  Video, Plus, Calendar, Clock, MapPin, Users, 
  ExternalLink, Trash2, CheckCircle2 
} from 'lucide-react';
import { meetingsApi } from '../../api/services';
import { Meeting } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MeetingModal } from './MeetingModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const MeetingsList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const res = await meetingsApi.getAll({ limit: 50 });
      setMeetings(res.data.data.meetings || res.data.data);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleDelete = async () => {
    if (!meetingToDelete) return;
    try {
      await meetingsApi.delete(meetingToDelete.id);
      showNotification('success', 'Meeting cancelled successfully');
      fetchMeetings();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to delete meeting');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings & Video Conferences"
        subtitle="Schedule sprint rituals, client demos, 1-on-1 appraisals, and room bookings"
        action={
          hasPermission('meetings.create') && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Schedule Meeting
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {meetings.map((m) => (
          <div
            key={m.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {m.title}
                </h3>
                <StatusBadge status={m.status} />
              </div>

              {m.project_name && (
                <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
                  Project: {m.project_name}
                </div>
              )}

              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-4">
                {m.agenda || 'No formal agenda provided.'}
              </p>

              <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{m.date ? m.date.substring(0, 10) : 'Today'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{m.start_time} {m.end_time ? `- ${m.end_time}` : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{m.location || 'Online Video Conference'}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              {m.meeting_url ? (
                <a
                  href={m.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors"
                >
                  <Video className="w-3.5 h-3.5" />
                  Join Call
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-xs text-slate-400">In-person session</span>
              )}

              {hasPermission('meetings.delete') && (
                <button
                  onClick={() => {
                    setMeetingToDelete(m);
                    setDeleteDialogOpen(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                  title="Cancel Meeting"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {meetings.length === 0 && !loading && (
          <div className="col-span-full py-16 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <Video className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
            <p className="text-sm font-medium">No meetings scheduled for this period.</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <MeetingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchMeetings}
        />
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setMeetingToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Cancel Meeting"
        message={`Are you sure you want to cancel the meeting "${meetingToDelete?.title}"?`}
        confirmText="Cancel Meeting"
        type="danger"
      />
    </div>
  );
};
