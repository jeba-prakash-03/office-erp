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

async function testAttendanceSlice() {
  console.log('--- Starting Slice 3.2: Attendance Module E2E Test ---');

  // 1. Authenticate Developer Employee (EMP-0007)
  const empLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'developer.employee@erp.local', password: 'Admin@123456' },
  });
  const empToken = empLogin.data.data.token;
  const empHeaders = { Authorization: `Bearer ${empToken}` };
  console.log('✔ Authenticated as Developer Employee');

  // 2. Authenticate HR Manager (EMP-0003)
  const hrLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'hr.manager@erp.local', password: 'Admin@123456' },
  });
  const hrToken = hrLogin.data.data.token;
  const hrHeaders = { Authorization: `Bearer ${hrToken}` };
  console.log('✔ Authenticated as HR Manager');

  const empRows = await query<any[]>('SELECT id FROM employees WHERE employee_id = "EMP-0007"');
  const empId = empRows[0].id;
  const today = new Date().toISOString().split('T')[0];

  // Clean existing attendance for today
  await query('DELETE FROM attendance WHERE employee_id = ? AND date = ?', [empId, today]);

  // 3. Test Clock In
  console.log('3. Testing Clock In...');
  const clockInRes = await req(`${API}/attendance/check-in`, {
    method: 'POST',
    headers: empHeaders,
  });
  if (!clockInRes.ok) throw new Error(`Clock in failed: ${JSON.stringify(clockInRes.data)}`);
  console.log('✔ Clock in succeeded. Status:', clockInRes.data.data.status);

  // 4. Duplicate Clock In Protection
  console.log('4. Testing Duplicate Clock In Protection...');
  const dupClockIn = await req(`${API}/attendance/check-in`, {
    method: 'POST',
    headers: empHeaders,
  });
  if (dupClockIn.status !== 400) {
    throw new Error(`Expected 400 on duplicate clock in, got ${dupClockIn.status}`);
  }
  console.log('✔ Duplicate clock in correctly prevented with 400 Bad Request');

  // 5. Test Clock Out
  console.log('5. Testing Clock Out...');
  const clockOutRes = await req(`${API}/attendance/check-out`, {
    method: 'POST',
    headers: empHeaders,
  });
  if (!clockOutRes.ok) throw new Error(`Clock out failed: ${JSON.stringify(clockOutRes.data)}`);
  console.log('✔ Clock out succeeded. Total Hours:', clockOutRes.data.data.totalHours);

  // 6. Duplicate Clock Out Protection
  console.log('6. Testing Duplicate Clock Out Protection...');
  const dupClockOut = await req(`${API}/attendance/check-out`, {
    method: 'POST',
    headers: empHeaders,
  });
  if (dupClockOut.status !== 400) {
    throw new Error(`Expected 400 on duplicate clock out, got ${dupClockOut.status}`);
  }
  console.log('✔ Duplicate clock out correctly prevented with 400 Bad Request');

  // 7. Attendance Correction Request
  console.log('7. Testing Attendance Correction Request...');
  const yesterday = '2026-10-04';
  const corrRes = await req(`${API}/attendance/corrections`, {
    method: 'POST',
    headers: empHeaders,
    body: {
      date: yesterday,
      requestedCheckIn: '2026-10-04T09:00:00.000Z',
      requestedCheckOut: '2026-10-04T18:00:00.000Z',
      reason: 'Forgot to clock out due to offsite client meeting',
    },
  });
  if (!corrRes.ok) throw new Error(`Correction submission failed: ${JSON.stringify(corrRes.data)}`);
  const correctionId = corrRes.data.data.id;
  console.log('✔ Submitted correction request:', correctionId);

  // 8. Self-Approval Guard on Correction
  console.log('8. Testing Self-Approval Guard on Correction...');
  const selfApproveCorr = await req(`${API}/attendance/corrections/${correctionId}/approve`, {
    method: 'PUT',
    headers: empHeaders,
    body: { status: 'approved', remarks: 'Self approve' },
  });
  if (selfApproveCorr.status === 403) {
    console.log('✔ Self-approval correctly blocked with 403 Forbidden');
  } else {
    throw new Error(`Expected 403 for self-approval, got ${selfApproveCorr.status}`);
  }

  // 9. HR Manager Approves Correction
  console.log('9. HR Manager Approving Correction...');
  const hrApproveCorr = await req(`${API}/attendance/corrections/${correctionId}/approve`, {
    method: 'PUT',
    headers: hrHeaders,
    body: { status: 'approved', remarks: 'Verified offsite meeting' },
  });
  if (!hrApproveCorr.ok) throw new Error(`HR correction approval failed: ${JSON.stringify(hrApproveCorr.data)}`);
  console.log('✔ HR Manager approved attendance correction');

  // 10. Verify MySQL State
  const verifiedAtt = await query<any[]>('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [empId, yesterday]);
  if (verifiedAtt.length === 0 || Number(verifiedAtt[0].total_hours) <= 0) {
    throw new Error(`Correction did not populate attendance table: ${JSON.stringify(verifiedAtt)}`);
  }
  console.log(`✔ Verified attendance updated in MySQL: date=${verifiedAtt[0].date}, hours=${verifiedAtt[0].total_hours}`);

  // Cleanup test data
  await query('DELETE FROM attendance WHERE employee_id = ? AND date IN (?, ?)', [empId, today, yesterday]);
  await query('DELETE FROM approval_history WHERE request_id IN (SELECT id FROM approval_requests WHERE entity_id = ?)', [correctionId]);
  await query('DELETE FROM approval_requests WHERE entity_id = ?', [correctionId]);
  await query('DELETE FROM attendance_corrections WHERE id = ?', [correctionId]);

  console.log('--- SLICE 3.2 (ATTENDANCE) PASSED ALL TESTS ---');
}

testAttendanceSlice().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
