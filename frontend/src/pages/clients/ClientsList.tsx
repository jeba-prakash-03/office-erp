import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientsApi } from '../../api/services';
import { Client } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ClientModal } from './ClientModal';
import { Plus, Eye, Edit2, Trash2, Building, DollarSign } from 'lucide-react';

export const ClientsList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const { showToast } = useNotifications();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await clientsApi.list({
        page,
        limit: 10,
        search,
        status: statusFilter,
      });
      if (res.data?.success) {
        setClients(res.data.data);
        setTotalPages(res.data.pagination.totalPages);
        setTotal(res.data.pagination.total);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch clients', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [page, search, statusFilter]);

  const handleCreateOrUpdate = async (formData: any) => {
    setModalLoading(true);
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, formData);
        showToast('Client updated successfully', 'success');
      } else {
        await clientsApi.create(formData);
        showToast('Client created successfully', 'success');
      }
      setShowModal(false);
      setEditingClient(null);
      fetchClients();
    } catch (err: any) {
      showToast(err.message || 'Failed to save client', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingClient) return;
    setModalLoading(true);
    try {
      await clientsApi.delete(deletingClient.id);
      showToast('Client deleted successfully', 'success');
      setDeletingClient(null);
      fetchClients();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete client', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const columns: Column<Client>[] = [
    {
      key: 'company_name',
      header: 'Company / Client',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <Link
              to={`/clients/${c.id}`}
              className="font-semibold text-slate-900 dark:text-white hover:text-brand-600 transition"
            >
              {c.company_name}
            </Link>
            <div className="text-xs text-slate-400">{c.contact_person} • {c.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'client_code',
      header: 'Client ID',
      render: (c) => <span className="font-mono text-xs font-semibold text-slate-500">{c.client_code}</span>,
    },
    {
      key: 'industry',
      header: 'Industry',
      render: (c) => <span className="text-xs text-slate-600 dark:text-slate-300">{c.industry || 'General'}</span>,
    },
    {
      key: 'projects',
      header: 'Projects',
      render: (c) => <span className="font-semibold text-slate-700 dark:text-slate-300">{c.project_count || 0} active</span>,
    },
    {
      key: 'financials',
      header: 'Total Invoiced / Paid',
      render: (c) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">
            ${Number(c.total_invoiced || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            Paid: ${Number(c.total_paid || 0).toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => navigate(`/clients/${c.id}`)}
            title="View Details"
            className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg transition"
          >
            <Eye className="w-4 h-4" />
          </button>
          {hasPermission('clients.edit') && (
            <button
              onClick={() => {
                setEditingClient(c);
                setShowModal(true);
              }}
              title="Edit Client"
              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {hasPermission('clients.delete') && (
            <button
              onClick={() => setDeletingClient(c)}
              title="Delete"
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clients Roster"
        description="CRM client accounts, contracts, project linkages, and billing overviews"
        actions={
          hasPermission('clients.create') && (
            <button
              onClick={() => {
                setEditingClient(null);
                setShowModal(true);
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Client
            </button>
          )
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="lead">Lead</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={clients}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search clients by company name, contact, email..."
        emptyTitle="No clients found"
        emptyDescription="Create a client record to start tracking contracts, projects, and invoices."
        pagination={{
          page,
          limit: 10,
          total,
          totalPages,
          onPageChange: setPage,
        }}
      />

      <ClientModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingClient(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialData={editingClient}
        loading={modalLoading}
      />

      <ConfirmDialog
        isOpen={!!deletingClient}
        onClose={() => setDeletingClient(null)}
        onConfirm={handleDelete}
        title="Delete Client Account"
        message={`Are you sure you want to delete "${deletingClient?.company_name}"?`}
        confirmText="Delete"
        isDestructive
        loading={modalLoading}
      />
    </div>
  );
};
