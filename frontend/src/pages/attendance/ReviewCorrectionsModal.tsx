import React, { useState, useEffect } from 'react';
import { attendanceApi } from '../../api/services';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useNotification } from '../../context/NotificationContext';
import { AttendanceCorrection } from '../../types';
import { Check, X, Clock, AlertCircle } from 'lucide-react';

interface ReviewCorrectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewCorrectionsModal: React.FC<ReviewCorrectionsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | number | null>(null);
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});

  const fetchCorrections = async () => {
    try {
      setLoading(true);
      const res = await attendanceApi.listCorrections({ status: 'pending' });
      if (res.data?.success) {
        setCorrections(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load correction requests', err);
      showNotification('error', 'Failed to load pending corrections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCorrections();
    }
  }, [isOpen]);

  const handleDecision = async (id: string | number, status: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      const remarks = remarksMap[String(id)] || '';
      await attendanceApi.reviewCorrection(id, { status, remarks });
      showNotification('success', `Correction request ${status} successfully`);
      fetchCorrections();
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || `Failed to ${status} correction`;
      showNotification('error', msg);
    } finally {
      setProcessingId(null);
    }
  };

  const formatTimeString = (dtStr?: string | null) => {
    if (!dtStr) return '—';
    if (dtStr.length > 10) {
      const d = new Date(dtStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      }
      return dtStr.substring(11, 16);
    }
    return dtStr;
  };

  const formatDateString = (dtStr?: string | null) => {
    if (!dtStr) return '—';
    const clean = String(dtStr).substring(0, 10);
    const d = new Date(clean + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    return clean;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Attendance Corrections"
      size="lg"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Loading pending correction requests...
          </div>
        ) : corrections.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Check className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
              No Pending Correction Requests
            </h4>
            <p className="text-xs text-slate-500">
              All employee punch correction submissions have been processed.
            </p>
          </div>
        ) : (
          corrections.map((corr) => {
            const inVal = corr.requested_clock_in || corr.requested_check_in;
            const outVal = corr.requested_clock_out || corr.requested_check_out;
            const idKey = String(corr.id);

            return (
              <div
                key={corr.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      {corr.employee_name || `Employee #${corr.employee_id}`}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {corr.employee_code && `Code: ${corr.employee_code} • `}
                      {corr.department_name || 'General Staff'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800">
                      Date: {formatDateString(corr.date)}
                    </span>
                    <StatusBadge status={corr.status} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-500 font-medium block">Requested Clock In:</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatTimeString(inVal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Requested Clock Out:</span>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {formatTimeString(outVal)}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-medium block">Reason:</span>
                    <p className="text-slate-800 dark:text-slate-200 italic mt-0.5">
                      "{corr.reason}"
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    placeholder="Reviewer remarks / feedback (optional)..."
                    value={remarksMap[idKey] || ''}
                    onChange={(e) =>
                      setRemarksMap({ ...remarksMap, [idKey]: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={processingId === corr.id}
                      onClick={() => handleDecision(corr.id, 'rejected')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={processingId === corr.id}
                      onClick={() => handleDecision(corr.id, 'approved')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve & Update Attendance
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};
