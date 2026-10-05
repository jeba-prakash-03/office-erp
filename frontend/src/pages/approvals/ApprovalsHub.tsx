import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Clock, ShieldCheck, Filter, Search, 
  RotateCcw, AlertCircle, Check, X, Eye, FileText, UserCheck
} from 'lucide-react';
import { approvalsApi } from '../../api/services';
import { ApprovalRequest, ApprovalOverview } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCard } from '../../components/ui/StatsCard';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const ApprovalsHub: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [overview, setOverview] = useState<ApprovalOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Decision Modal
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [decisionAction, setDecisionAction] = useState<'approve' | 'reject' | 'return'>('approve');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  // History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await approvalsApi.list({
        status: activeTab === 'pending' ? 'pending' : (statusFilter === 'all' ? undefined : statusFilter),
        entity_type: entityTypeFilter === 'all' ? undefined : entityTypeFilter,
        search: search || undefined,
        page,
        limit: 15,
      });

      if (res.data?.success) {
        const payload = res.data.data;
        setRequests(payload.records || []);
        setOverview(payload.overview || null);
        if (payload.pagination) {
          setTotalPages(payload.pagination.totalPages || 1);
          setTotalRecords(payload.pagination.total || 0);
        }
      }
    } catch (err: any) {
      console.error('Failed to load approvals', err);
      showNotification('error', err.response?.data?.message || 'Failed to load approvals list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [activeTab, statusFilter, entityTypeFilter, search, page]);

  const handleTabChange = (tab: 'pending' | 'history') => {
    setActiveTab(tab);
    if (tab === 'pending') {
      setStatusFilter('pending');
    } else {
      setStatusFilter('all');
    }
    setPage(1);
  };

  const openDecisionModal = (req: ApprovalRequest, action: 'approve' | 'reject' | 'return') => {
    setSelectedRequest(req);
    setDecisionAction(action);
    setDecisionRemarks('');
    setDecisionModalOpen(true);
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    if (decisionAction === 'reject' && !decisionRemarks.trim()) {
      showNotification('error', 'Please provide a justification remark for rejecting this request');
      return;
    }

    setProcessing(true);
    try {
      await approvalsApi.decision(selectedRequest.id, {
        action: decisionAction,
        remarks: decisionRemarks.trim() || undefined,
      });

      showNotification('success', `Request successfully ${decisionAction}d`);
      setDecisionModalOpen(false);
      fetchApprovals();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || `Failed to ${decisionAction} request`;
      showNotification('error', msg);
    } finally {
      setProcessing(false);
    }
  };

  const viewHistory = async (req: ApprovalRequest) => {
    setSelectedRequest(req);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await approvalsApi.getHistory(req.id);
      if (res.data?.success) {
        setHistoryItems(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load approval history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatEntityType = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'leave':
        return { label: 'Leave Request', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
      case 'timesheet':
        return { label: 'Timesheet Log', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
      case 'attendance_correction':
        return { label: 'Attendance Correction', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      case 'expense':
        return { label: 'Expense Claim', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
      case 'loan':
        return { label: 'Loan Advance', color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' };
      default:
        return { label: type?.replace('_', ' ').toUpperCase() || 'Request', color: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  const columns: Column<ApprovalRequest>[] = [
    {
      header: 'Request Type',
      accessor: (item: ApprovalRequest) => {
        const badge = formatEntityType(item.entity_type);
        return (
          <div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
              {badge.label}
            </span>
            <div className="text-[11px] font-mono text-slate-400 mt-1">ID: {item.id.substring(0, 13)}</div>
          </div>
        );
      },
    },
    {
      header: 'Requester',
      accessor: (item: ApprovalRequest) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
            {(item.requester_name || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="font-semibold text-slate-900 dark:text-white text-xs block">
              {item.requester_name || 'Requester'}
            </span>
            <div className="text-[11px] text-slate-500">
              {item.requester_employee_code ? `${item.requester_employee_code} • ` : ''}
              {item.department_name || 'Staff'}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Submission Details',
      accessor: (item: ApprovalRequest) => (
        <div className="max-w-md">
          <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2">
            {item.comments || 'No submission details provided.'}
          </p>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Submitted {new Date(item.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (item: ApprovalRequest) => <StatusBadge status={item.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (item: ApprovalRequest) => (
        <div className="flex items-center justify-end gap-1.5">
          {item.status === 'pending' ? (
            <>
              <button
                onClick={() => openDecisionModal(item, 'approve')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                title="Approve Request"
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                onClick={() => openDecisionModal(item, 'reject')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold transition-colors"
                title="Reject Request"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          ) : (
            <button
              onClick={() => viewHistory(item)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              History
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals Hub"
        subtitle="Centralized management of pending organizational requests, workflow decisions, and audit history"
        action={
          <button
            onClick={fetchApprovals}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard
          title="Pending Review"
          value={overview?.pendingCount ?? 0}
          icon={Clock}
          subtitle="Awaiting your decision"
        />
        <StatsCard
          title="Approved"
          value={overview?.approvedCount ?? 0}
          icon={CheckCircle}
          subtitle="Processed successfully"
        />
        <StatsCard
          title="Rejected"
          value={overview?.rejectedCount ?? 0}
          icon={XCircle}
          subtitle="Declined submissions"
        />
        <StatsCard
          title="Total Workflows"
          value={overview?.totalCount ?? 0}
          icon={ShieldCheck}
          subtitle="All recorded requests"
        />
      </div>

      {/* Tabs & Filtering Area */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          {/* Main Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTabChange('pending')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Pending Queue
              {overview?.pendingCount ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono">
                  {overview.pendingCount}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => handleTabChange('history')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Decision History
            </button>
          </div>

          {/* Sub Filters */}
          <div className="flex items-center gap-3">
            {activeTab === 'history' && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
              >
                <option value="all">All Decisions</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="returned">Returned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}

            <select
              value={entityTypeFilter}
              onChange={(e) => {
                setEntityTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
            >
              <option value="all">All Request Types</option>
              <option value="leave">Leave Requests</option>
              <option value="timesheet">Timesheets</option>
              <option value="attendance_correction">Attendance Corrections</option>
              <option value="expense">Expenses</option>
              <option value="loan">Loan Advances</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by requester name, employee code, or remarks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
          />
        </div>
      </div>

      {/* Approvals Table */}
      <DataTable
        columns={columns}
        data={requests}
        keyField="id"
        loading={loading}
        emptyMessage={
          activeTab === 'pending'
            ? 'No pending approval requests requiring your review.'
            : 'No historical approval records found matching selected filters.'
        }
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: (p) => setPage(p),
        }}
      />

      {/* Decision Modal (Approve / Reject / Return) */}
      <Modal
        isOpen={decisionModalOpen}
        onClose={() => setDecisionModalOpen(false)}
        title={`${decisionAction === 'approve' ? 'Approve' : decisionAction === 'reject' ? 'Reject' : 'Return'} Request`}
        size="md"
      >
        <form onSubmit={submitDecision} className="space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Request Type:</span>
              <span className="font-semibold text-slate-900 dark:text-white capitalize">
                {selectedRequest?.entity_type.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Requester:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {selectedRequest?.requester_name} ({selectedRequest?.requester_employee_code || 'EMP'})
              </span>
            </div>
            <div className="text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 font-medium block">Comments:</span>
              <p className="text-slate-700 dark:text-slate-300 italic mt-0.5">
                "{selectedRequest?.comments || 'No comment'}"
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reviewer Feedback / Justification {decisionAction === 'reject' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={3}
              required={decisionAction === 'reject'}
              value={decisionRemarks}
              onChange={(e) => setDecisionRemarks(e.target.value)}
              placeholder={
                decisionAction === 'reject'
                  ? 'Mandatory reason for rejection...'
                  : 'Optional note or approval remarks...'
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setDecisionModalOpen(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm disabled:opacity-50 ${
                decisionAction === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {processing ? 'Submitting...' : `Confirm ${decisionAction.toUpperCase()}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Approval Workflow History"
        size="md"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {loadingHistory ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading audit history...</div>
          ) : historyItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No step history recorded.</div>
          ) : (
            <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-6 py-2">
              {historyItems.map((item, idx) => (
                <div key={idx} className="relative pl-6">
                  <span className="absolute -left-2 top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                        Step {item.step_number || idx + 1}: {item.action}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      By: <strong>{item.actor_name || item.actor_role || 'System'}</strong>
                    </p>
                    {item.remarks && (
                      <p className="text-xs italic text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded-md">
                        "{item.remarks}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
