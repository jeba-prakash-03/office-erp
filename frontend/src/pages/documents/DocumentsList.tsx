import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Search, Filter, Download, Trash2, 
  Folder, Lock, Globe 
} from 'lucide-react';
import { documentsApi } from '../../api/services';
import { CompanyDocument } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { DocumentModal } from './DocumentModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const DocumentsList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<CompanyDocument | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await documentsApi.getAll({
        search: search || undefined,
        category: categoryFilter || undefined,
        page,
        limit: 15,
      });
      setDocuments(res.data.data.documents || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [search, categoryFilter, page]);

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      await documentsApi.delete(docToDelete.id);
      showNotification('success', 'Document removed successfully');
      fetchDocuments();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to delete document');
    }
  };

  const columns: Column<CompanyDocument>[] = [
    {
      header: 'Document Name',
      accessor: (d) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">{d.title}</span>
            <div className="text-xs text-slate-500 line-clamp-1">{d.description || d.file_name}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: (d) => (
        <span className="text-xs capitalize px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
          {d.category.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Visibility',
      accessor: (d) => (
        d.is_public ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <Globe className="w-3.5 h-3.5" />
            Company-Wide
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
            <Lock className="w-3.5 h-3.5" />
            Restricted
          </span>
        )
      ),
    },
    {
      header: 'Uploaded By',
      accessor: (d) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {d.uploaded_by_name || 'Management'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (d) => (
        <div className="flex items-center justify-end gap-1.5">
          <a
            href={d.file_url?.startsWith('http') ? d.file_url : `http://localhost:5000/${d.file_url}`}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
            title="Download Document"
          >
            <Download className="w-4 h-4" />
          </a>

          {hasPermission('documents.delete') && (
            <button
              onClick={() => {
                setDocToDelete(d);
                setDeleteDialogOpen(true);
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
              title="Delete Document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Vault"
        subtitle="Secure central repository for company policies, contracts, templates, and NDA files"
        action={
          hasPermission('documents.create') && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Upload Document
            </button>
          )
        }
      />

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search document title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
        >
          <option value="">All Categories</option>
          <option value="company_policy">Company Policy</option>
          <option value="contract">Contracts</option>
          <option value="template">Templates</option>
          <option value="financial">Financial</option>
          <option value="technical">Technical</option>
          <option value="other">General</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={documents}
        keyField="id"
        loading={loading}
        emptyMessage="No documents found in vault."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {modalOpen && (
        <DocumentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchDocuments}
        />
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDocToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Are you sure you want to permanently delete "${docToDelete?.title}"?`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};
