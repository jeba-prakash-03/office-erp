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

async function testTimesheetsSlice() {
  console.log('--- Starting Slice 3.3: Timesheets Module E2E Test ---');

  // 1. Authenticate Developer Employee (EMP-0007)
  const empLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'developer.employee@erp.local', password: 'Admin@123456' },
  });
  const empToken = empLogin.data.data.token;
  const empHeaders = { Authorization: `Bearer ${empToken}` };
  console.log('✔ Authenticated as Developer Employee');

  // 2. Authenticate Project Manager (EMP-0005)
  const pmLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'pm.lead@erp.local', password: 'Admin@123456' },
  });
  const pmToken = pmLogin.data.data.token;
  const pmHeaders = { Authorization: `Bearer ${pmToken}` };
  console.log('✔ Authenticated as Project Manager');

  // 3. Authenticate Client (USR-CLIENT-008)
  const clientLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'client.contact@acmecorp.test', password: 'Admin@123456' },
  });
  const clientToken = clientLogin.data.data.token;
  const clientHeaders = { Authorization: `Bearer ${clientToken}` };
  console.log('✔ Authenticated as Client User');

  // Find Acme Project ID
  const projRows = await query<any[]>('SELECT id FROM projects WHERE project_code = "PRJ-ACME-001"');
  if (projRows.length === 0) throw new Error('Project PRJ-ACME-001 not found');
  const projectId = projRows[0].id;

  // 4. Log 4.5 Hours Timesheet
  console.log('4. Employee logging timesheet...');
  const logRes = await req(`${API}/timesheets`, {
    method: 'POST',
    headers: empHeaders,
    body: {
      projectId,
      date: '2026-10-05',
      hours: 4.5,
      description: 'Implemented frontend user authentication state and session handlers',
      isBillable: true,
    },
  });
  if (!logRes.ok) throw new Error(`Log timesheet failed: ${JSON.stringify(logRes.data)}`);
  const timesheetId = logRes.data.data.id;
  console.log(`✔ Timesheet logged: ${timesheetId}`);

  // 5. Test Self-Approval Guard
  console.log('5. Testing self-approval guard...');
  const selfApproveRes = await req(`${API}/timesheets/${timesheetId}/approve`, {
    method: 'PUT',
    headers: empHeaders,
    body: { status: 'approved' },
  });
  if (selfApproveRes.status === 403) {
    console.log('✔ Self-approval correctly blocked with 403 Forbidden');
  } else {
    throw new Error(`Expected 403 for self-approval, got ${selfApproveRes.status}`);
  }

  // 6. PM Approves Timesheet
  console.log('6. PM approving timesheet...');
  const pmApproveRes = await req(`${API}/timesheets/${timesheetId}/approve`, {
    method: 'PUT',
    headers: pmHeaders,
    body: { status: 'approved', remarks: 'Quality work delivered' },
  });
  if (!pmApproveRes.ok) throw new Error(`PM approval failed: ${JSON.stringify(pmApproveRes.data)}`);
  console.log('✔ PM successfully approved timesheet');

  // 7. Verify Client Visibility
  console.log('7. Verifying Client Portal isolation & visibility...');
  const clientTimesheetsRes = await req(`${API}/timesheets`, {
    headers: clientHeaders,
  });
  if (!clientTimesheetsRes.ok) throw new Error(`Client list timesheets failed: ${JSON.stringify(clientTimesheetsRes.data)}`);
  const clientTimesheets = clientTimesheetsRes.data.data;
  const foundInClient = clientTimesheets.find((ts: any) => ts.id === timesheetId);
  if (!foundInClient) {
    throw new Error('Approved timesheet for Acme project was not visible to Acme client!');
  }
  console.log(`✔ Client correctly sees approved timesheet (${foundInClient.hours} hrs on ${foundInClient.project_name})`);

  // Cleanup
  await query('DELETE FROM timesheets WHERE id = ?', [timesheetId]);
  await query('DELETE FROM approval_history WHERE request_id IN (SELECT id FROM approval_requests WHERE entity_id = ?)', [timesheetId]);
  await query('DELETE FROM approval_requests WHERE entity_id = ?', [timesheetId]);

  console.log('--- SLICE 3.3 (TIMESHEETS) PASSED ALL TESTS ---');
}

testTimesheetsSlice().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
