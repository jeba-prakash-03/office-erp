import React, { useState, useEffect } from 'react';
import { leadsApi } from '../../api/services';
import { Lead } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LeadModal } from './LeadModal';
import { Plus, Target, UserPlus, Edit2, Trash2 } from 'lucide-react';

export const LeadsList: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const { showToast } = useNotifications();
  const { hasPermission } = useAuth();

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await leadsApi.list({
        page,
        limit: 10,
        search,
        stage: stageFilter,
      });
      if (res.data?.success) {
        setLeads(res.data.data);
        setTotalPages(res.data.pagination.totalPages);
        setTotal(res.data.pagination.total);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, search, stageFilter]);

  const handleCreateOrUpdate = async (formData: any) => {
    setModalLoading(true);
    try {
      if (editingLead) {
        await leadsApi.update(editingLead.id, formData);
        showToast('Lead updated successfully', 'success');
      } else {
        await leadsApi.create(formData);
        showToast('Lead created successfully', 'success');
      }
      setShowModal(false);
      setEditingLead(null);
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || 'Failed to save lead', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!convertingLead) return;
    setModalLoading(true);
    try {
      await leadsApi.convert(convertingLead.id, {});
      showToast('Lead successfully converted to Client account!', 'success');
      setConvertingLead(null);
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || 'Failed to convert lead', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingLead) return;
    setModalLoading(true);
    try {
      await leadsApi.delete(deletingLead.id);
      showToast('Lead deleted successfully', 'success');
      setDeletingLead(null);
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete lead', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead / Prospect',
      render: (l) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">{l.name}</div>
          <div className="text-xs text-slate-400">{l.company || 'Private Lead'} • {l.email || l.phone || 'No direct contact'}</div>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (l) => <StatusBadge status={l.stage} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (l) => <StatusBadge status={l.priority} />,
    },
    {
      key: 'estimated_value',
      header: 'Deal Value',
      render: (l) => <span className="font-bold text-slate-900 dark:text-white">${Number(l.estimated_value).toLocaleString()}</span>,
    },
    {
      key: 'assigned_employee_name',
      header: 'Assigned Rep',
      render: (l) => <span className="text-xs text-slate-600 dark:text-slate-300">{l.assigned_employee_name || 'Unassigned'}</span>,
    },
    {
      key: 'expected_closing_date',
      header: 'Expected Close',
      render: (l) => <span className="text-xs text-slate-500">{l.expected_closing_date ? l.expected_closing_date.split('T')[0] : 'Open'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (l) => (
        <div className="flex items-center justify-end gap-1.5">
          {!l.converted_to_client_id && (
            <button
              onClick={() => setConvertingLead(l)}
              title="Convert to Client"
              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> Convert
            </button>
          )}
          {hasPermission('leads.manage') && (
            <>
              <button
                onClick={() => {
                  setEditingLead(l);
                  setShowModal(true);
                }}
                title="Edit Lead"
                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeletingLead(l)}
                title="Delete Lead"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="CRM Leads Pipeline"
        description="Track prospective clients, estimated contract values, and conversion pipelines"
        actions={
          hasPermission('leads.manage') && (
            <button
              onClick={() => {
                setEditingLead(null);
                setShowModal(true);
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Lead
            </button>
          )
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
        >
          <option value="">All Stages</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="proposal">Proposal</option>
          <option value="negotiation">Negotiation</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={leads}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by name, company, email..."
        emptyTitle="No leads in pipeline"
        emptyDescription="Add prospective leads to build your sales funnel."
        pagination={{
          page,
          limit: 10,
          total,
          totalPages,
          onPageChange: setPage,
        }}
      />

      <LeadModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingLead(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialData={editingLead}
        loading={modalLoading}
      />

      {/* Convert to Client Dialog */}
      <ConfirmDialog
        isOpen={!!convertingLead}
        onClose={() => setConvertingLead(null)}
        onConfirm={handleConvert}
        title="Convert Lead to Official Client"
        message={`Convert "${convertingLead?.name}" (${convertingLead?.company || 'Organization'}) into an official Client account in MySQL?`}
        confirmText="Convert to Client"
        loading={modalLoading}
      />

      {/* Confirm Deletion */}
      <ConfirmDialog
        isOpen={!!deletingLead}
        onClose={() => setDeletingLead(null)}
        onConfirm={handleDelete}
        title="Delete Lead"
        message={`Are you sure you want to delete lead "${deletingLead?.name}"?`}
        confirmText="Delete"
        isDestructive
        loading={modalLoading}
      />
    </div>
  );
};
