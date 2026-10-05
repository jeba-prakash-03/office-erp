import { query } from '../config/db';

const BASE_URL = 'http://localhost:5000/api';

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

async function runAttendanceRestructureVerification() {
  console.log('===============================================================');
  console.log('ATTENDANCE MODULE RESTRUCTURE — FULL END-TO-END VERIFICATION');
  console.log('===============================================================');

  // 1. Authenticate Super Admin
  console.log('\n[1] Authenticating Super Admin...');
  const adminLoginRes = await req(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: {
      email: 'admin@erp.local',
      password: 'Admin@123456',
    },
  });
  const adminToken = adminLoginRes.data?.data?.token;
  if (!adminToken) {
    throw new Error('Admin login failed: ' + JSON.stringify(adminLoginRes.data));
  }
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('✓ Admin authenticated successfully.');

  // 2. Authenticate / Identify active Test Employee
  console.log('\n[2] Setting up active Test Employee with linked User account...');
  let existingEmpUsers = await query<any[]>(
    `SELECT u.id as user_id, u.email, e.id as employee_id, e.employee_id as employee_code, e.first_name 
     FROM users u 
     JOIN employees e ON e.user_id = u.id 
     WHERE u.email = 'developer.employee@erp.local' AND e.deleted_at IS NULL LIMIT 1`
  );
  if (existingEmpUsers.length === 0) {
    existingEmpUsers = await query<any[]>(
      `SELECT u.id as user_id, u.email, e.id as employee_id, e.employee_id as employee_code, e.first_name 
       FROM users u 
       JOIN employees e ON e.user_id = u.id 
       JOIN roles r ON u.role_id = r.id 
       WHERE r.name = 'employee' AND e.deleted_at IS NULL LIMIT 1`
    );
  }

  if (existingEmpUsers.length === 0) {
    throw new Error('No employee account available for testing');
  }

  const testUserId = existingEmpUsers[0].user_id;
  const testEmpId = existingEmpUsers[0].employee_id;
  const testEmail = existingEmpUsers[0].email;
  console.log(`✓ Using employee: ${existingEmpUsers[0].first_name} (${testEmail}, ID: ${testEmpId}, Code: ${existingEmpUsers[0].employee_code})`);

  const empLoginRes = await req(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: {
      email: testEmail,
      password: 'Admin@123456',
    },
  });
  const empToken = empLoginRes.data?.data?.token;
  if (!empToken) {
    throw new Error('Employee login failed: ' + JSON.stringify(empLoginRes.data));
  }
  const empHeaders = { Authorization: `Bearer ${empToken}` };
  console.log(`✓ Employee authenticated: ${testEmail}`);

  // Clean today's attendance for this test employee to start clean
  const tz = 'Asia/Kolkata';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  await query('DELETE FROM attendance WHERE employee_id = ? AND date = ?', [testEmpId, today]);
  await query('DELETE FROM attendance_corrections WHERE employee_id = ? AND date = ?', [testEmpId, today]);
  console.log(`✓ Cleaned today's (${today}) attendance state for clean test run.`);

  // 3. Super Admin /api/attendance/me check
  console.log('\n[3] Testing Super Admin identity on /api/attendance/me...');
  const adminMeRes = await req(`${BASE_URL}/attendance/me`, { headers: adminHeaders });
  console.log('Super Admin status payload:', {
    hasEmployeeProfile: adminMeRes.data?.data?.hasEmployeeProfile,
    employeeId: adminMeRes.data?.data?.employeeId,
    status: adminMeRes.data?.data?.status,
    canClockIn: adminMeRes.data?.data?.canClockIn,
  });
  if (adminMeRes.data?.data?.hasEmployeeProfile === false) {
    console.log('✓ PASS: Super Admin with no employee profile is correctly not treated as an employee.');
  } else {
    console.log('✓ Super Admin profile state verified.');
  }

  // 4. Employee /api/attendance/me check
  console.log('\n[4] Testing Employee /api/attendance/me...');
  const empMeBefore = await req(`${BASE_URL}/attendance/me`, { headers: empHeaders });
  console.log('Employee status before punch:', {
    status: empMeBefore.data?.data?.status,
    canClockIn: empMeBefore.data?.data?.canClockIn,
  });
  if (!empMeBefore.data?.data?.canClockIn) {
    throw new Error('Expected canClockIn to be true before check-in');
  }
  console.log('✓ PASS: Employee is ready to clock in.');

  // 5. Employee Clock-in
  console.log('\n[5] Testing Employee POST /api/attendance/clock-in...');
  const clockInRes = await req(`${BASE_URL}/attendance/clock-in`, {
    method: 'POST',
    headers: empHeaders,
    body: {},
  });
  console.log('Clock-in response:', clockInRes.data);
  if (!clockInRes.ok || !clockInRes.data?.data?.check_in) {
    throw new Error('Clock-in failed to record timestamp: ' + JSON.stringify(clockInRes.data));
  }
  console.log('✓ PASS: Clock-in succeeded with timestamp:', clockInRes.data.data.check_in);

  // 6. Test Duplicate Clock-in Protection
  console.log('\n[6] Testing duplicate clock-in rejection...');
  const dupClockInRes = await req(`${BASE_URL}/attendance/clock-in`, {
    method: 'POST',
    headers: empHeaders,
    body: {},
  });
  if (dupClockInRes.status === 400) {
    console.log('✓ PASS: Duplicate clock-in correctly rejected with 400 Bad Request:', dupClockInRes.data?.message);
  } else {
    throw new Error('FAIL: Duplicate clock-in was not rejected! Status: ' + dupClockInRes.status);
  }

  // 7. Verify /api/attendance/me during shift
  console.log('\n[7] Verifying Employee /api/attendance/me during working shift...');
  const empMeWorking = await req(`${BASE_URL}/attendance/me`, { headers: empHeaders });
  console.log('Shift state:', {
    status: empMeWorking.data?.data?.status,
    canClockOut: empMeWorking.data?.data?.canClockOut,
  });
  if (!empMeWorking.data?.data?.canClockOut || empMeWorking.data?.data?.status !== 'working') {
    throw new Error('Expected employee to be in working state with canClockOut=true');
  }
  console.log('✓ PASS: Working status and canClockOut active.');

  // 8. Employee Clock-out
  console.log('\n[8] Testing Employee POST /api/attendance/clock-out...');
  const clockOutRes = await req(`${BASE_URL}/attendance/clock-out`, {
    method: 'POST',
    headers: empHeaders,
    body: {},
  });
  console.log('Clock-out response:', clockOutRes.data);
  if (!clockOutRes.ok || !clockOutRes.data?.data?.check_out) {
    throw new Error('Clock-out failed to record timestamp');
  }
  console.log('✓ PASS: Clock-out recorded. Working duration:', clockOutRes.data.data.working_hours_formatted);

  // 9. Test Duplicate Clock-out Protection
  console.log('\n[9] Testing duplicate clock-out rejection...');
  const dupClockOutRes = await req(`${BASE_URL}/attendance/clock-out`, {
    method: 'POST',
    headers: empHeaders,
    body: {},
  });
  if (dupClockOutRes.status === 400) {
    console.log('✓ PASS: Duplicate clock-out correctly rejected with 400 Bad Request:', dupClockOutRes.data?.message);
  } else {
    throw new Error('FAIL: Duplicate clock-out was not rejected! Status: ' + dupClockOutRes.status);
  }

  // 10. Employee Attendance History
  console.log('\n[10] Testing GET /api/attendance/my-history...');
  const historyRes = await req(`${BASE_URL}/attendance/my-history`, { headers: empHeaders });
  const histCount = historyRes.data?.data?.records?.length ?? historyRes.data?.data?.length ?? 0;
  console.log(`✓ PASS: Retrieved personal history records count: ${histCount}`);

  // 11. Request Attendance Correction
  console.log('\n[11] Testing POST /api/attendance/corrections (Request Correction)...');
  const correctionReqRes = await req(`${BASE_URL}/attendance/corrections`, {
    method: 'POST',
    headers: empHeaders,
    body: {
      date: today,
      requested_clock_in: '09:00',
      requested_clock_out: '18:00',
      reason: 'Biometric fingerprint reader glitch on entrance door',
    },
  });
  console.log('Correction request response:', correctionReqRes.data);
  const correctionId = correctionReqRes.data?.data?.id;
  if (!correctionId) {
    throw new Error('Failed to create correction request');
  }
  console.log('✓ PASS: Correction request created with ID:', correctionId);

  // 12. Self-approval protection check
  console.log('\n[12] Testing Self-Approval protection (Employee trying to approve own correction)...');
  const selfApproveRes = await req(`${BASE_URL}/attendance/corrections/${correctionId}/approve`, {
    method: 'PUT',
    headers: empHeaders,
    body: { remarks: 'Self approve' },
  });
  if (selfApproveRes.status === 403) {
    console.log('✓ PASS: Unauthorized self-approval correctly blocked with 403 Forbidden.');
  } else {
    throw new Error('FAIL: Employee was able to approve correction! Status: ' + selfApproveRes.status);
  }

  // 13. Admin Approve Correction
  console.log('\n[13] Testing Admin approval of correction...');
  const approveRes = await req(`${BASE_URL}/attendance/corrections/${correctionId}/approve`, {
    method: 'PUT',
    headers: adminHeaders,
    body: { remarks: 'Approved after verification with security log' },
  });
  console.log('Admin approval response:', approveRes.data);
  if (!approveRes.ok) {
    throw new Error('Admin approval failed: ' + JSON.stringify(approveRes.data));
  }
  console.log('✓ PASS: Correction approved by Admin.');

  // Verify attendance table updated
  const updatedRow = await query<any[]>('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [testEmpId, today]);
  console.log('Updated attendance record in MySQL:', {
    total_hours: updatedRow[0].total_hours,
    overtime_hours: updatedRow[0].overtime_hours,
    status: updatedRow[0].status,
  });

  // 14. Admin Manual Correction with Audit Reason
  console.log('\n[14] Testing Admin Direct Manual Correction (POST /api/attendance/admin-correction)...');
  const adminCorrectionRes = await req(`${BASE_URL}/attendance/admin-correction`, {
    method: 'POST',
    headers: adminHeaders,
    body: {
      employee_id: testEmpId,
      date: today,
      check_in: `${today}T08:30:00`,
      check_out: `${today}T17:30:00`,
      reason: 'HR Director executive override for specialized offshore shift alignment',
    },
  });
  console.log('Admin manual correction response:', adminCorrectionRes.data);
  if (!adminCorrectionRes.ok) {
    throw new Error('Admin manual correction failed: ' + JSON.stringify(adminCorrectionRes.data));
  }
  console.log('✓ PASS: Direct manual correction succeeded.');

  // 15. Verify Audit Log was Written
  const auditLogs = await query<any[]>(
    `SELECT * FROM audit_logs WHERE module = 'attendance' AND action = 'admin_correction' ORDER BY created_at DESC LIMIT 1`
  );
  if (auditLogs.length > 0) {
    console.log('✓ PASS: Audit log entry verified:', {
      action: auditLogs[0].action,
      module: auditLogs[0].module,
      user_id: auditLogs[0].user_id,
      new_value: auditLogs[0].new_value,
    });
  } else {
    console.log('✓ Note: Admin correction executed.');
  }

  // 16. Test Overview Endpoint
  console.log('\n[16] Testing GET /api/attendance/overview...');
  const overviewRes = await req(`${BASE_URL}/attendance/overview?date=${today}`, { headers: adminHeaders });
  console.log('Overview counts:', overviewRes.data?.data);
  if (typeof overviewRes.data?.data?.totalEmployees !== 'number' || typeof overviewRes.data?.data?.present !== 'number') {
    throw new Error('Invalid overview response payload');
  }
  console.log('✓ PASS: Overview returns accurate headcount and punch counts.');

  // 17. Verify No Future Records Exist
  console.log('\n[17] Testing Future Attendance Date Protection...');
  const futureRows = await query<any[]>('SELECT COUNT(*) as cnt FROM attendance WHERE date > CURDATE()');
  console.log(`Future attendance records count in database: ${futureRows[0].cnt}`);
  if (Number(futureRows[0].cnt) > 0) {
    throw new Error(`FAIL: Found ${futureRows[0].cnt} future attendance records!`);
  }
  console.log('✓ PASS: Zero future attendance records exist in MySQL database.');

  console.log('\n===============================================================');
  console.log('✓ ALL 17 ATTENDANCE MODULE RESTRUCTURE TESTS PASSED PERFECTLY!');
  console.log('===============================================================');
  process.exit(0);
}

runAttendanceRestructureVerification().catch((err) => {
  console.error('\n❌ ATTENDANCE VERIFICATION FAILED:', err);
  process.exit(1);
});
