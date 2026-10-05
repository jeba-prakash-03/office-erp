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

async function testCrmReportsSlice() {
  console.log('--- Starting Slice 3.9: CRM & Reports E2E Test ---');

  // 1. Authenticate Admin
  const adminLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'admin@erp.local', password: 'Admin@123456' },
  });
  const adminHeaders = { Authorization: `Bearer ${adminLogin.data.data.token}` };
  console.log('✔ Authenticated as Admin');

  // Clean previous test lead if exists
  await query('DELETE FROM leads WHERE name = "Vikram Sharma" OR company = "NextGen Robotics Test Corp"');

  // 2. Create Lead
  console.log('2. Creating CRM Lead...');
  const createLeadRes = await req(`${API}/leads`, {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'Vikram Sharma',
      company: 'NextGen Robotics Test Corp',
      email: 'vikram.sharma@nextgenrobotics.test',
      phone: '+91 9876501234',
      source: 'LinkedIn Referral',
      stage: 'new',
      priority: 'high',
      estimatedValue: 1200000.00,
      expectedClosingDate: '2026-11-30',
      notes: 'Interested in enterprise warehouse automation backend software.',
    },
  });
  if (!createLeadRes.ok) throw new Error(`Create lead failed: ${JSON.stringify(createLeadRes.data)}`);
  const leadId = createLeadRes.data.data.id;
  console.log(`✔ Created Lead: ${leadId}`);

  // 3. Update Lead Pipeline Stage
  console.log('3. Updating Lead Stage to Proposal...');
  const updateLeadRes = await req(`${API}/leads/${leadId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: { stage: 'proposal', estimatedValue: 1350000.00 },
  });
  if (!updateLeadRes.ok) throw new Error(`Update lead failed: ${JSON.stringify(updateLeadRes.data)}`);
  console.log('✔ Updated lead stage to proposal');

  // 4. Convert Lead to Client
  console.log('4. Converting Lead to Client...');
  const convertRes = await req(`${API}/leads/${leadId}/convert`, {
    method: 'POST',
    headers: adminHeaders,
    body: { clientCode: 'CLI-ROBOT-01' },
  });
  if (!convertRes.ok) throw new Error(`Convert lead failed: ${JSON.stringify(convertRes.data)}`);
  const clientId = convertRes.data.data.clientId;
  console.log(`✔ Converted Lead to Client: ${clientId}`);

  // Verify client and contact records in MySQL
  const clientRows = await query<any[]>('SELECT * FROM clients WHERE id = ?', [clientId]);
  const contactRows = await query<any[]>('SELECT * FROM client_contacts WHERE client_id = ?', [clientId]);
  if (clientRows.length === 0 || contactRows.length === 0) {
    throw new Error('Client or primary contact record was not created during conversion');
  }
  console.log(`✔ Verified Client "${clientRows[0].company_name}" created with primary contact "${contactRows[0].name}"`);

  // 5. Test Enterprise Reports API
  console.log('5. Testing Enterprise Reports Endpoints...');
  const reportTypes = ['employees', 'attendance', 'leave', 'payroll', 'projects', 'tasks', 'invoices', 'income', 'expenses', 'assets'];
  for (const rType of reportTypes) {
    const rRes = await req(`${API}/reports/${rType}`, {
      headers: adminHeaders,
    });
    if (!rRes.ok) throw new Error(`Report for ${rType} failed: ${JSON.stringify(rRes.data)}`);
    console.log(`  ✔ Report '${rType}': ${rRes.data.rowCount} rows retrieved.`);
  }

  // Cleanup
  await query('DELETE FROM client_contacts WHERE client_id = ?', [clientId]);
  await query('DELETE FROM clients WHERE id = ?', [clientId]);
  await query('DELETE FROM leads WHERE id = ?', [leadId]);

  console.log('--- SLICE 3.9 (CRM & REPORTS) PASSED ALL TESTS ---');
  process.exit(0);
}

testCrmReportsSlice().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
