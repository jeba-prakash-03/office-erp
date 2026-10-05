import { query } from '../config/db';

const API = 'http://localhost:5000/api';

async function req(url: string, options: any = {}): Promise<{ status: number; ok: boolean; data: any }> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function testFinanceSlice() {
  console.log('--- Starting Slice 3.8: Finance & Invoices E2E Test ---');

  // 1. Authenticate Finance Manager
  const finLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'finance.manager@erp.local', password: 'Admin@123456' },
  });
  const finHeaders = { Authorization: `Bearer ${finLogin.data.data.token}` };
  console.log('✔ Authenticated as Finance Manager');

  // 2. Authenticate Client User
  const clientLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'client.contact@acmecorp.test', password: 'Admin@123456' },
  });
  const clientHeaders = { Authorization: `Bearer ${clientLogin.data.data.token}` };
  console.log('✔ Authenticated as Client');

  const clientRows = await query<any[]>('SELECT id FROM clients WHERE client_code = "CLI-ACME-001"');
  const clientId = clientRows[0].id;
  const invNumber = 'INV-TEST-' + Math.floor(1000 + Math.random() * 9000);

  // 3. Create Invoice with Items
  console.log('3. Finance Manager creating invoice...');
  const createInvRes = await req(`${API}/invoices`, {
    method: 'POST',
    headers: finHeaders,
    body: {
      invoiceNumber: invNumber,
      clientId,
      invoiceDate: '2026-10-01',
      dueDate: '2026-10-31',
      taxRate: 18.0,
      notes: 'Monthly deliverables for engineering sprint',
      items: [
        { description: 'Sprint Engineering Services (40 hrs)', quantity: 40, unitPrice: 2500 },
        { description: 'Cloud Infra Setup & Security Audit', quantity: 1, unitPrice: 20000 },
      ],
    },
  });
  if (!createInvRes.ok) throw new Error(`Invoice create failed: ${JSON.stringify(createInvRes.data)}`);
  const invoiceId = createInvRes.data.data.id;
  console.log(`✔ Created Invoice: ${invoiceId} (${invNumber})`);

  // Verify Calculations: 100,000 + 20,000 = 120,000 + 18% (21,600) = 141,600
  const getInv = await query<any[]>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (Number(getInv[0].grand_total) !== 141600 || Number(getInv[0].remaining_balance) !== 141600) {
    throw new Error(`Invoice math mismatch: Expected 141600, got total=${getInv[0].grand_total}, balance=${getInv[0].remaining_balance}`);
  }
  console.log('✔ Verified invoice math: Subtotal=₹120,000, Tax=₹21,600, Grand Total=₹141,600');

  // 4. Record Partial Payment (₹50,000)
  console.log('4. Recording partial payment of ₹50,000...');
  const pay1Res = await req(`${API}/payments`, {
    method: 'POST',
    headers: finHeaders,
    body: {
      invoiceId,
      amount: 50000.00,
      paymentDate: '2026-10-05',
      paymentMethod: 'NEFT / RTGS',
      transactionReference: 'TXN-ACME-001',
    },
  });
  if (!pay1Res.ok) throw new Error(`Payment 1 failed: ${JSON.stringify(pay1Res.data)}`);

  const invAfterPay1 = await query<any[]>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (invAfterPay1[0].status !== 'partially_paid' || Number(invAfterPay1[0].remaining_balance) !== 91600) {
    throw new Error(`Payment 1 balance state invalid: ${JSON.stringify(invAfterPay1[0])}`);
  }
  console.log('✔ Payment 1 recorded: Status is "partially_paid", Remaining=₹91,600');

  // 5. Excess Payment Guard (Attempt to pay ₹100,000 when remaining is ₹91,600)
  console.log('5. Testing excess payment protection...');
  const excessPay = await req(`${API}/payments`, {
    method: 'POST',
    headers: finHeaders,
    body: {
      invoiceId,
      amount: 100000.00,
      paymentDate: '2026-10-05',
      paymentMethod: 'Bank Transfer',
    },
  });
  if (excessPay.status !== 400) {
    throw new Error(`Expected 400 on excess payment, got ${excessPay.status}`);
  }
  console.log('✔ Excess payment correctly rejected with 400 Bad Request');

  // 6. Record Full Remaining Payment (₹91,600)
  console.log('6. Recording full remaining payment of ₹91,600...');
  const pay2Res = await req(`${API}/payments`, {
    method: 'POST',
    headers: finHeaders,
    body: {
      invoiceId,
      amount: 91600.00,
      paymentDate: '2026-10-06',
      paymentMethod: 'NEFT / RTGS',
      transactionReference: 'TXN-ACME-002',
    },
  });
  if (!pay2Res.ok) throw new Error(`Payment 2 failed: ${JSON.stringify(pay2Res.data)}`);

  const invAfterPay2 = await query<any[]>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (invAfterPay2[0].status !== 'paid' || Number(invAfterPay2[0].remaining_balance) !== 0) {
    throw new Error(`Payment 2 balance state invalid: ${JSON.stringify(invAfterPay2[0])}`);
  }
  console.log('✔ Payment 2 recorded: Status is "paid", Remaining=₹0.00');

  // 7. Verify Accounting Income Mirroring
  const incomes = await query<any[]>('SELECT * FROM incomes WHERE invoice_id = ?', [invoiceId]);
  if (incomes.length !== 2) {
    throw new Error(`Expected 2 income entries mirrored for accounting, got ${incomes.length}`);
  }
  console.log('✔ Verified automated income ledger entries for accounting reconciliation');

  // 8. Client Verifies Invoices and Payments
  console.log('8. Client verifying invoice and payment ledger...');
  const clientInvRes = await req(`${API}/invoices/${invoiceId}`, {
    headers: clientHeaders,
  });
  if (!clientInvRes.ok) throw new Error(`Client invoice view failed: ${JSON.stringify(clientInvRes.data)}`);
  const clientInvoice = clientInvRes.data.data;
  if (clientInvoice.payments.length !== 2) {
    throw new Error('Client cannot view invoice payment breakdown');
  }
  console.log(`✔ Client verified paid invoice ${clientInvoice.invoice_number} with ${clientInvoice.payments.length} payment receipts`);

  // Cleanup
  await query('DELETE FROM incomes WHERE invoice_id = ?', [invoiceId]);
  await query('DELETE FROM payments WHERE invoice_id = ?', [invoiceId]);
  await query('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
  await query('DELETE FROM invoices WHERE id = ?', [invoiceId]);

  console.log('--- SLICE 3.8 (FINANCE & INVOICES) PASSED ALL TESTS ---');
}

testFinanceSlice().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
