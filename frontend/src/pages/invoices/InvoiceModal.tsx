import React, { useState, useEffect } from 'react';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { invoicesApi, clientsApi, projectsApi } from '../../api/services';
import { Client, Project } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface InvoiceItemRow {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    project_id: '',
    issue_date: new Date().toISOString().substring(0, 10),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    tax_rate: 0,
    discount_amount: 0,
    notes: 'Thank you for your business. Please remit payment within 30 days.',
    terms: 'Payment is due within 30 days of invoice date. Overdue balances may incur a 1.5% monthly interest fee.',
  });

  const [items, setItems] = useState<InvoiceItemRow[]>([
    { description: 'Software Development & Architecture Services', quantity: 1, unit_price: 2500, amount: 2500 },
  ]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          clientsApi.getAll({ limit: 100 }),
          projectsApi.getAll({ limit: 100 }),
        ]);
        setClients(cRes.data.data.clients || cRes.data.data);
        setProjects(pRes.data.data.projects || pRes.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    if (isOpen) {
      fetchOptions();
    }
  }, [isOpen]);

  const handleItemChange = (index: number, field: keyof InvoiceItemRow, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      const q = Number(next[index].quantity) || 0;
      const p = Number(next[index].unit_price) || 0;
      next[index].amount = Number((q * p).toFixed(2));
    }
    setItems(next);
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Computations
  const subtotal = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  const taxAmount = (subtotal * (Number(formData.tax_rate) || 0)) / 100;
  const totalAmount = Math.max(0, subtotal + taxAmount - (Number(formData.discount_amount) || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || items.length === 0 || items.some((i) => !i.description.trim())) {
      showNotification('error', 'Please select a client and provide valid line item descriptions');
      return;
    }

    setLoading(true);
    try {
      await invoicesApi.create({
        client_id: Number(formData.client_id),
        project_id: formData.project_id ? Number(formData.project_id) : undefined,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        subtotal,
        tax_rate: Number(formData.tax_rate),
        tax_amount: taxAmount,
        discount_amount: Number(formData.discount_amount),
        total_amount: totalAmount,
        notes: formData.notes,
        terms: formData.terms,
        items,
      });

      showNotification('success', 'Invoice generated successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Client Invoice"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="">-- Choose Client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} ({c.contact_person})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Associated Project (Optional)
            </label>
            <select
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="">-- No Project Linked --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Invoice Issue Date
            </label>
            <input
              type="date"
              required
              value={formData.issue_date}
              onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Payment Due Date
            </label>
            <input
              type="date"
              required
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-900 dark:text-white">
              Invoice Line Items
            </label>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Service / Deliverable description..."
                  value={it.description}
                  onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                  className="flex-[3] px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={it.quantity}
                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                  className="w-16 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none text-center"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Rate ($)"
                  value={it.unit_price}
                  onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                  className="w-24 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none text-right"
                />
                <span className="w-24 text-xs font-semibold text-slate-800 dark:text-slate-200 text-right pr-1">
                  ${it.amount.toFixed(2)}
                </span>
                <button
                  type="button"
                  disabled={items.length <= 1}
                  onClick={() => handleRemoveItem(idx)}
                  className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Calculation summary */}
        <div className="bg-slate-50 dark:bg-slate-700/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.tax_rate}
                onChange={(e) => setFormData({ ...formData, tax_rate: Number(e.target.value) })}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Discount Amount ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.discount_amount}
                onChange={(e) => setFormData({ ...formData, discount_amount: Number(e.target.value) })}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-200 dark:divide-slate-700">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Subtotal:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Tax ({formData.tax_rate}%):</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">+${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Discount:</span>
              <span className="font-semibold text-red-500">-${Number(formData.discount_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 text-sm font-bold text-slate-900 dark:text-white">
              <span>Grand Total:</span>
              <span className="text-indigo-600 dark:text-indigo-400">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
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
            {loading ? 'Creating...' : 'Issue Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
