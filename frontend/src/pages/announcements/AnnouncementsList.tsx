import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Plus, Calendar, User, Trash2, AlertCircle, 
  CheckCircle, BellRing 
} from 'lucide-react';
import { announcementsApi } from '../../api/services';
import { Announcement } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AnnouncementModal } from './AnnouncementModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const AnnouncementsList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Announcement | null>(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await announcementsApi.getAll({ limit: 50 });
      setAnnouncements(res.data.data.announcements || res.data.data);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await announcementsApi.delete(itemToDelete.id);
      showNotification('success', 'Announcement removed');
      fetchAnnouncements();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to delete announcement');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Announcements"
        subtitle="Broadcast important notices, operational updates, and celebrations"
        action={
          hasPermission('announcements.create') && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Broadcast Notice
            </button>
          )
        }
      />

      <div className="space-y-4">
        {announcements.map((ann) => (
          <div
            key={ann.id}
            className={`p-6 rounded-xl border bg-white dark:bg-slate-800 shadow-sm transition-all ${
              ann.priority === 'urgent'
                ? 'border-red-300 dark:border-red-900 ring-1 ring-red-400/30'
                : ann.priority === 'important'
                ? 'border-amber-300 dark:border-amber-900'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {ann.title}
                  </h3>
                  <StatusBadge status={ann.priority} />
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{ann.start_date ? ann.start_date.substring(0, 10) : 'Today'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>By {ann.created_by_name || 'Management'}</span>
                  </div>
                  <span className="capitalize">Audience: {ann.target_audience}</span>
                </div>
              </div>

              {hasPermission('announcements.delete') && (
                <button
                  onClick={() => {
                    setItemToDelete(ann);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Delete Announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {ann.message}
            </p>
          </div>
        ))}

        {announcements.length === 0 && !loading && (
          <div className="py-16 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <BellRing className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
            <p className="text-sm font-medium">No announcements published yet.</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <AnnouncementModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchAnnouncements}
        />
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message={`Are you sure you want to delete "${itemToDelete?.title}"?`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};
