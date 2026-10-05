import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Printer, ArrowLeft, DollarSign, CheckCircle, Clock, 
  Building2, CreditCard, Send, AlertTriangle 
} from 'lucide-react';
import { invoicesApi, paymentsApi, companyApi } from '../../api/services';
import { Invoice, CompanySettings } from '../../types';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const InvoiceDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment Recording Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [trxId, setTrxId] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchInvoice = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [invRes, compRes] = await Promise.all([
        invoicesApi.getById(Number(id)),
        companyApi.getSettings(),
      ]);
      setInvoice(invRes.data.data);
      setCompany(compRes.data.data);
      if (invRes.data.data) {
        const remaining = Number(invRes.data.data.total_amount || 0) - Number(invRes.data.data.paid_amount || 0);
        setPaymentAmount(remaining > 0 ? remaining.toFixed(2) : '0');
      }
    } catch (err: any) {
      showNotification('error', 'Failed to load invoice details');
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !paymentAmount) return;

    setSubmittingPayment(true);
    try {
      await paymentsApi.create({
        invoice_id: invoice.id,
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        transaction_reference: trxId || undefined,
        payment_date: new Date().toISOString().substring(0, 10),
      });

      showNotification('success', 'Payment recorded successfully against invoice');
      setPaymentModalOpen(false);
      fetchInvoice();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) return <LoadingState text="Loading invoice document..." />;
  if (!invoice) return null;

  const remainingBalance = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/invoices')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </button>

        <div className="flex items-center gap-3">
          {remainingBalance > 0 && hasPermission('invoices.edit') && (
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              Record Payment
            </button>
          )}

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Official Printable Invoice Sheet */}
      <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-200 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-8">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">
              {company?.company_name || 'ERP Software Systems'}
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-xs leading-relaxed">
              {company?.address || 'Corporate Business Park'}<br />
              Email: {company?.email || 'billing@company.local'} • Phone: {company?.phone || '+1 (555) 019-2831'}<br />
              Tax ID / VAT: {company?.tax_number || 'US-99382103'}
            </p>
          </div>

          <div className="text-right">
            <h2 className="text-2xl font-black text-indigo-700 uppercase tracking-widest">
              INVOICE
            </h2>
            <div className="mt-2 text-xs text-slate-600 space-y-1">
              <p><strong className="text-slate-800">Invoice No:</strong> {invoice.invoice_number}</p>
              <p><strong className="text-slate-800">Issue Date:</strong> {invoice.issue_date?.substring(0, 10)}</p>
              <p><strong className="text-slate-800">Due Date:</strong> {invoice.due_date?.substring(0, 10)}</p>
              <div className="pt-1">
                <StatusBadge status={invoice.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Bill To Info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Billed To:</h3>
            <p className="text-sm font-bold text-slate-900">{invoice.client?.company_name || invoice.client_name}</p>
            <p className="text-xs text-slate-600 mt-1">
              Attn: {invoice.client?.contact_person || 'Accounts Payable'}<br />
              {invoice.client?.address || 'Client Address'}<br />
              Email: {invoice.client?.email || 'N/A'} • Phone: {invoice.client?.phone || 'N/A'}
            </p>
          </div>

          {invoice.project_name && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Project:</h3>
              <p className="text-sm font-bold text-slate-900">{invoice.project_name}</p>
              <p className="text-xs text-slate-600 mt-1">
                Services Rendered and Milestone Deliverables
              </p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 uppercase tracking-wider font-bold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="p-3">Description</th>
                <th className="p-3 text-center w-16">Qty</th>
                <th className="p-3 text-right w-24">Unit Price</th>
                <th className="p-3 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-medium text-slate-900">{item.description}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">${Number(item.unit_price).toFixed(2)}</td>
                    <td className="p-3 text-right font-semibold">${Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400">No items specified.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Calculations Section */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2 text-xs divide-y divide-slate-200">
            <div className="flex justify-between py-1">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-semibold text-slate-900">${Number(invoice.subtotal || 0).toFixed(2)}</span>
            </div>
            {Number(invoice.tax_amount || 0) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Tax ({invoice.tax_rate}%):</span>
                <span className="font-semibold text-slate-900">+${Number(invoice.tax_amount).toFixed(2)}</span>
              </div>
            )}
            {Number(invoice.discount_amount || 0) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Discount:</span>
                <span className="font-semibold text-red-600">-${Number(invoice.discount_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 text-sm font-bold text-slate-900">
              <span>Total Due:</span>
              <span className="text-indigo-700">${Number(invoice.total_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 text-xs">
              <span className="text-emerald-700">Amount Paid:</span>
              <span className="font-semibold text-emerald-700">${Number(invoice.paid_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 text-xs font-bold text-slate-900">
              <span>Remaining Balance:</span>
              <span className={remainingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                ${remainingBalance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="border-t border-slate-200 pt-6 text-xs text-slate-600 space-y-2">
          {invoice.notes && (
            <p><strong>Notes:</strong> {invoice.notes}</p>
          )}
          {invoice.terms && (
            <p><strong>Terms & Conditions:</strong> {invoice.terms}</p>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Record Payment for Invoice"
        size="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Payment Amount ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingBalance}
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
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
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Transaction Reference / Check No.
            </label>
            <input
              type="text"
              value={trxId}
              onChange={(e) => setTrxId(e.target.value)}
              placeholder="e.g. TRX-902148"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setPaymentModalOpen(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingPayment}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {submittingPayment ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
