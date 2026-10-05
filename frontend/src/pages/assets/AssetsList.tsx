import React, { useState, useEffect } from 'react';
import { 
  Laptop, Plus, Search, Filter, UserCheck, RotateCcw, 
  Edit, Trash2, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import { assetsApi } from '../../api/services';
import { Asset } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatsCard } from '../../components/ui/StatsCard';
import { AssetModal } from './AssetModal';
import { AssignAssetModal } from './AssignAssetModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const AssetsList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assetToAssign, setAssetToAssign] = useState<Asset | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await assetsApi.getAll({
        search: search || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        page,
        limit: 15,
      });
      setAssets(res.data.data.assets || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [search, statusFilter, categoryFilter, page]);

  const handleReturn = async (asset: Asset) => {
    try {
      await assetsApi.return(asset.id, { return_date: new Date().toISOString().substring(0, 10), condition: 'good' });
      showNotification('success', 'Asset marked as returned to inventory');
      fetchAssets();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to return asset');
    }
  };

  const handleDelete = async () => {
    if (!assetToDelete) return;
    try {
      await assetsApi.delete(assetToDelete.id);
      showNotification('success', 'Asset deleted successfully');
      fetchAssets();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to delete asset');
    }
  };

  const totalValue = assets.reduce((acc, a) => acc + Number(a.purchase_cost || 0), 0);

  const columns: Column<Asset>[] = [
    {
      header: 'Asset Name & Code',
      accessor: (a) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white">{a.name}</span>
          <div className="text-xs text-slate-500 font-mono">{a.asset_code || `AST-#${a.id}`} • SN: {a.serial_number || 'N/A'}</div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: (a) => (
        <span className="text-xs capitalize px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
          {a.category}
        </span>
      ),
    },
    {
      header: 'Assigned To',
      accessor: (a) => (
        a.assigned_to_name ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[9px]">
              {a.assigned_to_name[0]}
            </div>
            <span>{a.assigned_to_name}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Unassigned (In Stock)</span>
        )
      ),
    },
    {
      header: 'Value ($)',
      accessor: (a) => (
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          ${Number(a.purchase_cost || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Condition',
      accessor: (a) => (
        <span className="text-xs capitalize text-slate-600 dark:text-slate-300">
          {a.condition.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (a) => <StatusBadge status={a.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (a) => (
        <div className="flex items-center justify-end gap-1.5">
          {a.status === 'available' && hasPermission('assets.edit') && (
            <button
              onClick={() => {
                setAssetToAssign(a);
                setAssignModalOpen(true);
              }}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
              title="Assign to Employee"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}

          {a.status === 'assigned' && hasPermission('assets.edit') && (
            <button
              onClick={() => handleReturn(a)}
              className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors"
              title="Return to Stock"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {hasPermission('assets.edit') && (
            <button
              onClick={() => {
                setSelectedAsset(a);
                setAssetModalOpen(true);
              }}
              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded transition-colors"
              title="Edit Asset"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}

          {hasPermission('assets.delete') && (
            <button
              onClick={() => {
                setAssetToDelete(a);
                setDeleteDialogOpen(true);
              }}
              className="p-1.5 text-slate-500 hover:text-red-600 rounded transition-colors"
              title="Delete Asset"
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
        title="Asset Inventory & Equipment"
        subtitle="Manage company hardware, devices, software licenses, and employee allocations"
        action={
          hasPermission('assets.create') && (
            <button
              onClick={() => {
                setSelectedAsset(null);
                setAssetModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Asset
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard
          title="Total Registered Assets"
          value={totalRecords.toString()}
          icon={<Laptop className="w-6 h-6" />}
        />
        <StatsCard
          title="Total Inventory Value"
          value={`$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={<ShieldCheck className="w-6 h-6" />}
        />
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search asset name, code, serial..."
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
          <option value="hardware">Hardware</option>
          <option value="software">Software</option>
          <option value="furniture">Furniture</option>
          <option value="vehicle">Vehicle</option>
          <option value="electronics">Electronics</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
        >
          <option value="">All Statuses</option>
          <option value="available">Available (In Stock)</option>
          <option value="assigned">Assigned</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={assets}
        keyField="id"
        loading={loading}
        emptyMessage="No assets found."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {assetModalOpen && (
        <AssetModal
          isOpen={assetModalOpen}
          onClose={() => {
            setAssetModalOpen(false);
            setSelectedAsset(null);
          }}
          asset={selectedAsset}
          onSuccess={fetchAssets}
        />
      )}

      {assignModalOpen && (
        <AssignAssetModal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setAssetToAssign(null);
          }}
          asset={assetToAssign}
          onSuccess={fetchAssets}
        />
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setAssetToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Asset"
        message={`Are you sure you want to delete "${assetToDelete?.name}"?`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};
