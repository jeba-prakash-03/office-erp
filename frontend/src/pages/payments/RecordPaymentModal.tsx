import React, { useState, useEffect } from 'react';
import { paymentsApi, invoicesApi } from '../../api/services';
import { Invoice } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showNotification } = useNotification();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    invoice_id: '',
    amount: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().substring(0, 10),
    transaction_reference: '',
    notes: '',
  });

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await invoicesApi.getAll({ limit: 100 });
        const list: Invoice[] = res.data.data.invoices || res.data.data;
        setInvoices(list.filter((inv) => inv.status !== 'paid'));
      } catch (err) {
        console.error(err);
      }
    };
    if (isOpen) {
      fetchInvoices();
    }
  }, [isOpen]);

  const handleInvoiceChange = (invId: string) => {
    const selected = invoices.find((i) => String(i.id) === invId);
    const remaining = selected ? Math.max(0, Number(selected.total_amount) - Number(selected.paid_amount || 0)) : 0;
    setFormData((prev) => ({
      ...prev,
      invoice_id: invId,
      amount: remaining > 0 ? remaining.toFixed(2) : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.invoice_id || !formData.amount) {
      showNotification('error', 'Please select an invoice and enter amount');
      return;
    }

    setLoading(true);
    try {
      await paymentsApi.create({
        invoice_id: Number(formData.invoice_id),
        amount: Number(formData.amount),
        payment_method: formData.payment_method,
        payment_date: formData.payment_date,
        transaction_reference: formData.transaction_reference || undefined,
        notes: formData.notes,
      });

      showNotification('success', 'Payment recorded successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Client Payment"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Select Invoice <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.invoice_id}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          >
            <option value="">-- Choose Unpaid / Partial Invoice --</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number} - {inv.client?.company_name || inv.client_name} (Due: ${Number(inv.total_amount || 0) - Number(inv.paid_amount || 0)})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amount Received ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Payment Method
            </label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="bank_transfer">Bank Transfer (Wire)</option>
              <option value="credit_card">Credit Card</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reference / Trx ID
            </label>
            <input
              type="text"
              value={formData.transaction_reference}
              onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
              placeholder="e.g. WIRE-99214"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Payment notes..."
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
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
