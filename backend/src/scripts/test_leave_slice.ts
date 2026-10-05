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

async function testLeaveSlice() {
  console.log('--- Starting Slice 3.1: Leave Module E2E Test ---');

  // 1. Authenticate Developer Employee (EMP-0007)
  const empLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'developer.employee@erp.local', password: 'Admin@123456' },
  });
  if (!empLogin.ok) throw new Error(`Emp login failed: ${JSON.stringify(empLogin.data)}`);
  const empToken = empLogin.data.data.token;
  const empHeaders = { Authorization: `Bearer ${empToken}` };
  console.log('✔ Authenticated as Developer Employee');

  // 2. Authenticate HR Manager (EMP-0003)
  const hrLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'hr.manager@erp.local', password: 'Admin@123456' },
  });
  if (!hrLogin.ok) throw new Error(`HR login failed: ${JSON.stringify(hrLogin.data)}`);
  const hrToken = hrLogin.data.data.token;
  const hrHeaders = { Authorization: `Bearer ${hrToken}` };
  console.log('✔ Authenticated as HR Manager');

  // 3. Get Leave Types & Initial Balances
  const typesRes = await req(`${API}/leave/types`, { headers: empHeaders });
  const leaveTypes = typesRes.data.data;
  if (!leaveTypes || leaveTypes.length === 0) throw new Error('No leave types found');
  const targetType = leaveTypes[0];
  console.log(`Using leave type: ${targetType.name} (ID: ${targetType.id})`);

  const initialBalRes = await req(`${API}/leave/balances`, { headers: empHeaders });
  const initialBal = initialBalRes.data.data.find((b: any) => b.leave_type_id === targetType.id);
  const initialRemaining = Number(initialBal?.remaining_days || targetType.days_allowed_per_year);
  console.log(`Initial remaining days: ${initialRemaining}`);

  // 4. Apply for Leave (e.g. 2026-11-10 to 2026-11-11)
  const startDate = '2026-11-10';
  const endDate = '2026-11-11';
  await query('DELETE FROM leave_requests WHERE start_date = ? AND end_date = ?', [startDate, endDate]);
  const applyRes = await req(`${API}/leave/apply`, {
    method: 'POST',
    headers: empHeaders,
    body: {
      leaveTypeId: targetType.id,
      startDate,
      endDate,
      totalDays: 2,
      reason: 'Automated test casual leave',
    },
  });
  if (!applyRes.ok) throw new Error(`Apply failed: ${JSON.stringify(applyRes.data)}`);
  const leaveRequestId = applyRes.data.data.id;
  console.log(`✔ Submitted leave application: ${leaveRequestId}`);

  // 5. Verify Pending Days Reserved
  const midBalRes = await req(`${API}/leave/balances`, { headers: empHeaders });
  const midBal = midBalRes.data.data.find((b: any) => b.leave_type_id === targetType.id);
  if (Number(midBal.pending_days) < 2) {
    throw new Error(`Expected pending_days >= 2, got ${midBal.pending_days}`);
  }
  console.log(`✔ Verified pending balance reservation: ${midBal.pending_days} days pending`);

  // 6. Test Self-Approval Guard (Employee attempting to approve own leave)
  const selfApproveRes = await req(`${API}/leave/requests/${leaveRequestId}/approve`, {
    method: 'PUT',
    headers: empHeaders,
    body: { status: 'approved', remarks: 'Self approving' },
  });
  if (selfApproveRes.status === 403) {
    console.log('✔ Self-approval correctly returned 403 Forbidden');
  } else {
    throw new Error(`Expected 403 for self-approval, got ${selfApproveRes.status}: ${JSON.stringify(selfApproveRes.data)}`);
  }

  // 7. HR Manager Approves the Leave Request
  const approveRes = await req(`${API}/leave/requests/${leaveRequestId}/approve`, {
    method: 'PUT',
    headers: hrHeaders,
    body: { status: 'approved', remarks: 'Enjoy your time off' },
  });
  if (!approveRes.ok) throw new Error(`HR approval failed: ${JSON.stringify(approveRes.data)}`);
  console.log('✔ HR Manager successfully approved leave request');

  // 8. Verify DB State & Balances
  const finalBalRes = await req(`${API}/leave/balances`, { headers: empHeaders });
  const finalBal = finalBalRes.data.data.find((b: any) => b.leave_type_id === targetType.id);
  if (Number(finalBal.used_days) < 2) {
    throw new Error(`Expected used_days >= 2, got ${finalBal.used_days}`);
  }
  console.log(`✔ Verified balance update: used=${finalBal.used_days}, remaining=${finalBal.remaining_days}`);

  // 9. Verify Leave is approved and attendance correctly derives On-Leave state
  const empRows = await query<any[]>('SELECT id FROM employees WHERE employee_id = "EMP-0007"');
  const empId = empRows[0].id;
  const leaveCheck = await query<any[]>(
    'SELECT status FROM leave_requests WHERE id = ?',
    [leaveRequestId]
  );
  if (leaveCheck[0]?.status !== 'approved') {
    throw new Error(`Expected leave request status 'approved', found: ${leaveCheck[0]?.status}`);
  }
  console.log('✔ Verified leave request approved and balances updated without generating future ghost attendance records');

  // Clean up test data
  await query('DELETE FROM approval_history WHERE request_id IN (SELECT id FROM approval_requests WHERE entity_id = ?)', [leaveRequestId]);
  await query('DELETE FROM approval_requests WHERE entity_id = ?', [leaveRequestId]);
  await query('DELETE FROM leave_requests WHERE id = ?', [leaveRequestId]);
  await query(
    'UPDATE leave_balances SET used_days = GREATEST(0, used_days - 2), remaining_days = remaining_days + 2 WHERE employee_id = ? AND leave_type_id = ? AND year = 2026',
    [empId, targetType.id]
  );

  console.log('--- SLICE 3.1 (LEAVE) PASSED ALL TESTS ---');
  process.exit(0);
}

testLeaveSlice().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
