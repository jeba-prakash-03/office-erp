import React, { useState, useEffect } from 'react';
import { assetsApi } from '../../api/services';
import { Asset } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: Asset | null;
  onSuccess: () => void;
}

export const AssetModal: React.FC<AssetModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    asset_code: '',
    category: 'hardware',
    serial_number: '',
    purchase_date: new Date().toISOString().substring(0, 10),
    purchase_cost: '',
    warranty_expiry: '',
    status: 'available',
    condition: 'good',
    description: '',
  });

  useEffect(() => {
    if (asset) {
      setFormData({
        name: asset.name || '',
        asset_code: asset.asset_code || '',
        category: asset.category || 'hardware',
        serial_number: asset.serial_number || '',
        purchase_date: asset.purchase_date ? asset.purchase_date.substring(0, 10) : '',
        purchase_cost: asset.purchase_cost ? String(asset.purchase_cost) : '',
        warranty_expiry: asset.warranty_expiry ? asset.warranty_expiry.substring(0, 10) : '',
        status: asset.status || 'available',
        condition: asset.condition || 'good',
        description: asset.description || '',
      });
    } else {
      setFormData({
        name: '',
        asset_code: '',
        category: 'hardware',
        serial_number: '',
        purchase_date: new Date().toISOString().substring(0, 10),
        purchase_cost: '',
        warranty_expiry: '',
        status: 'available',
        condition: 'good',
        description: '',
      });
    }
  }, [isOpen, asset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      showNotification('error', 'Asset name is required');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: formData.name,
        asset_code: formData.asset_code || undefined,
        category: formData.category,
        serial_number: formData.serial_number || undefined,
        purchase_date: formData.purchase_date || undefined,
        purchase_cost: formData.purchase_cost ? Number(formData.purchase_cost) : undefined,
        warranty_expiry: formData.warranty_expiry || undefined,
        status: formData.status,
        condition: formData.condition,
        description: formData.description || undefined,
      };

      if (asset) {
        await assetsApi.update(asset.id, payload);
        showNotification('success', 'Asset updated successfully');
      } else {
        await assetsApi.create(payload);
        showNotification('success', 'Asset created successfully');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to save asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={asset ? 'Edit Asset' : 'Add New Company Asset'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Asset Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. MacBook Pro M3 Max"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Asset Tag / Code
            </label>
            <input
              type="text"
              value={formData.asset_code}
              onChange={(e) => setFormData({ ...formData, asset_code: e.target.value })}
              placeholder="e.g. AST-00912"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="hardware">Hardware / Laptop</option>
              <option value="software">Software License</option>
              <option value="furniture">Office Furniture</option>
              <option value="vehicle">Company Vehicle</option>
              <option value="electronics">Electronics / Display</option>
              <option value="other">Other Asset</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Serial Number
            </label>
            <input
              type="text"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              placeholder="e.g. C02G410..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Purchase Cost ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.purchase_cost}
              onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })}
              placeholder="e.g. 2499"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Purchase Date
            </label>
            <input
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Warranty Expiry
            </label>
            <input
              type="date"
              value={formData.warranty_expiry}
              onChange={(e) => setFormData({ ...formData, warranty_expiry: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Condition
            </label>
            <select
              value={formData.condition}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="brand_new">Brand New</option>
              <option value="good">Good / Working</option>
              <option value="fair">Fair</option>
              <option value="damaged">Damaged / Needs Repair</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="available">Available (In Stock)</option>
              <option value="assigned">Assigned</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="retired">Retired / Disposed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Description / Specs
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Asset specifications, configuration, notes..."
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
            {loading ? 'Saving...' : asset ? 'Update Asset' : 'Create Asset'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
