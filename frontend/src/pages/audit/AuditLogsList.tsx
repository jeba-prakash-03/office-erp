import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Search, Filter, Calendar, User, 
  Terminal, Eye, Clock 
} from 'lucide-react';
import { auditApi } from '../../api/services';
import { AuditLog } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

export const AuditLogsList: React.FC = () => {
  const { showNotification } = useNotification();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  // Log Payload Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await auditApi.getAll({
        search: search || undefined,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        page,
        limit: 20,
      });
      setLogs(res.data.data.logs || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load audit trail records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [search, actionFilter, entityFilter, page]);

  const columns: Column<AuditLog>[] = [
    {
      header: 'Timestamp',
      accessor: (l) => (
        <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
          {l.created_at ? new Date(l.created_at).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      header: 'Actor',
      accessor: (l) => (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
            {l.user_name ? l.user_name[0] : 'S'}
          </div>
          <span className="text-xs font-semibold text-slate-900 dark:text-white">
            {l.user_name || 'System Auto'}
          </span>
        </div>
      ),
    },
    {
      header: 'Action',
      accessor: (l) => (
        <span className={`text-xs font-mono font-bold uppercase px-2 py-0.5 rounded ${
          l.action.includes('delete')
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : l.action.includes('create') || l.action.includes('register')
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        }`}>
          {l.action}
        </span>
      ),
    },
    {
      header: 'Entity',
      accessor: (l) => (
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          {l.entity_type} {l.entity_id ? `(#${l.entity_id})` : ''}
        </span>
      ),
    },
    {
      header: 'IP Address',
      accessor: (l) => (
        <span className="text-xs font-mono text-slate-500">
          {l.ip_address || '127.0.0.1'}
        </span>
      ),
    },
    {
      header: 'Details',
      align: 'right',
      accessor: (l) => (
        <button
          onClick={() => setSelectedLog(l)}
          className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded inline-flex items-center gap-1 text-xs font-medium"
        >
          <Eye className="w-3.5 h-3.5" />
          Inspect
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & System Audit Logs"
        subtitle="Immutable security trail of administrative actions, data modifications, logins, and API access"
      />

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search actor or IP address..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
        >
          <option value="">All Entities</option>
          <option value="auth">Authentication</option>
          <option value="employees">Employees</option>
          <option value="payroll">Payroll</option>
          <option value="invoices">Invoices</option>
          <option value="projects">Projects</option>
          <option value="finance">Finance</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        keyField="id"
        loading={loading}
        emptyMessage="No audit records captured yet."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {/* Inspect Payload Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log #${selectedLog.id} Inspector`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-700/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <p><strong>Actor:</strong> {selectedLog.user_name || 'System'}</p>
              <p><strong>Action:</strong> <span className="font-mono">{selectedLog.action}</span></p>
              <p><strong>Entity:</strong> {selectedLog.entity_type} #{selectedLog.entity_id}</p>
              <p><strong>IP:</strong> <span className="font-mono">{selectedLog.ip_address}</span></p>
              <p className="col-span-2"><strong>User Agent:</strong> <span className="font-mono text-[10px]">{selectedLog.user_agent}</span></p>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">State Payload & Differences</h4>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto max-h-60">
                {JSON.stringify(
                  typeof selectedLog.details === 'string'
                    ? JSON.parse(selectedLog.details || '{}')
                    : selectedLog.details || {},
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
