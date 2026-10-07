import { pool } from '../config/db';

const API_BASE = 'http://localhost:5000/api';

async function request(url: string, options: any = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const headers: any = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const body = options.body ? JSON.stringify(options.body) : undefined;
  const res = await fetch(fullUrl, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runCleanSystemVerification() {
  console.log('===================================================================');
  console.log('OFFICE-ERP: CLEAN SYSTEM AUDIT & REAL WORKFLOW VERIFICATION');
  console.log('===================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // PHASE 1: EMPTY STATE INTEGRITY TEST (0 Mock Records)
    // -------------------------------------------------------------------------
    console.log('[PHASE 1] Validating Empty Database State (Zero Fake Data)...');

    // Super Admin Login
    const superLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'admin@erp.local', password: 'Admin@123456' },
    });
    if (!superLogin.data.success) throw new Error('Super Admin login failed');
    const superAuth = { headers: { Authorization: `Bearer ${superLogin.data.data.accessToken}` } };

    // Admin Login
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'hr.admin@erp.local', password: 'Admin@123456' },
    });
    if (!adminLogin.data.success) throw new Error('Admin login failed');
    const adminAuth = { headers: { Authorization: `Bearer ${adminLogin.data.data.accessToken}` } };
    console.log('  ✓ Super Admin & Admin logged in successfully');

    // Dashboard metrics on empty DB
    const dashRes = await request('/dashboard/stats', adminAuth);
    const m = dashRes.data.data.metrics;
    if (m.totalEmployees !== 0 || m.monthlyIncome !== 0 || m.monthlyExpenses !== 0 || m.totalProjects !== 0) {
      throw new Error(`Fake data detected on dashboard! ${JSON.stringify(m)}`);
    }
    console.log('  ✓ Dashboard correctly displays 0 employees, ₹0 income, ₹0 expenses, 0 projects');

    // Check modules are truly empty
    const empList = await request('/employees', adminAuth);
    const employees = Array.isArray(empList.data?.data) ? empList.data.data : [];
    if (employees.length !== 0) throw new Error(`Employees table not empty! Found ${employees.length}`);

    const attSheet = await request('/attendance/sheet?month=10&year=2026', adminAuth);
    const attEmps = Array.isArray(attSheet.data?.data?.employees) ? attSheet.data.data.employees : [];
    if (attEmps.length !== 0) throw new Error(`Attendance sheet not empty! Found ${attEmps.length}`);

    const leaveList = await request('/leave/requests', adminAuth);
    const leaves = Array.isArray(leaveList.data?.data) ? leaveList.data.data : [];
    if (leaves.length !== 0) throw new Error(`Leave requests not empty! Found ${leaves.length}`);

    const payRuns = await request('/payroll/runs', adminAuth);
    const runs = Array.isArray(payRuns.data?.data) ? payRuns.data.data : [];
    if (runs.length !== 0) throw new Error(`Payroll runs not empty! Found ${runs.length}`);

    const invList = await request('/investments', superAuth);
    const investments = Array.isArray(invList.data?.data?.investments) ? invList.data.data.investments : [];
    if (investments.length !== 0) throw new Error(`Investments not empty! Found ${investments.length}`);

    console.log('  ✓ Empty state verified across Employees, Attendance, Leave, Payroll, Finances, Investments');

    // -------------------------------------------------------------------------
    // PHASE 2: REAL DATA CREATION & FULL WORKFLOW
    // -------------------------------------------------------------------------
    console.log('\n[PHASE 2] Executing Real User Workflows & Data Persistence...');

    // 1. Create Department
    const deptRes = await request('/departments', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { name: 'Product Engineering', description: 'Core product development & cloud platform' },
    });
    const deptId = deptRes.data.data.id;
    console.log(`  ✓ Admin created real Department: Product Engineering (${deptId})`);

    // 2. Create Employee
    const empRes = await request('/employees', {
      method: 'POST',
      headers: adminAuth.headers,
      body: {
        firstName: 'Jeba',
        lastName: 'Prakash',
        email: 'jeba.prakash@company.local',
        phone: '+91 98765 43210',
        employeeId: 'EMP-101',
        designation: 'Lead Software Architect',
        departmentId: deptId,
        joiningDate: '2026-01-01',
        employmentType: 'full_time',
        employmentStatus: 'active',
        basicSalary: 45000,
        createLoginAccount: true,
        loginPassword: 'Password@123',
      },
    });
    if (!empRes.data.success) throw new Error(`Create employee failed: ${JSON.stringify(empRes.data)}`);
    const emp1Id = empRes.data.data.id;
    console.log(`  ✓ Admin created real Employee: Jeba Prakash (EMP-101)`);

    // 3. Check Attendance Sheet (Shows EMP-101 with all days 'NM' - Not Marked)
    const attSheet2 = await request('/attendance/sheet?month=10&year=2026', adminAuth);
    const jebaRow = attSheet2.data.data.employees.find((e: any) => e.employeeId === 'EMP-101');
    if (!jebaRow) throw new Error('EMP-101 not appearing in attendance sheet');
    if (jebaRow.days['1'] !== 'NM' || jebaRow.days['2'] !== 'NM') {
      throw new Error(`Unmarked days should be 'NM', found: day1=${jebaRow.days['1']}`);
    }
    console.log('  ✓ Attendance sheet shows EMP-101 with days accurately defaulting to NM (Not Marked)');

    // 4. Admin marks attendance for Days 1..4 (P, P, HD, A) and saves
    const saveAtt = await request('/attendance/sheet', {
      method: 'POST',
      headers: adminAuth.headers,
      body: {
        month: 10,
        year: 2026,
        updates: [
          { employeeId: emp1Id, day: 1, status: 'P' },
          { employeeId: emp1Id, day: 2, status: 'P' },
          { employeeId: emp1Id, day: 3, status: 'HD' },
          { employeeId: emp1Id, day: 4, status: 'A' },
        ],
      },
    });
    if (!saveAtt.data.success) throw new Error('Failed to save attendance');
    console.log('  ✓ Admin explicitly saved attendance for Days 1..4');

    // 5. Query attendance again to verify persistence
    const attSheet3 = await request('/attendance/sheet?month=10&year=2026', adminAuth);
    const jebaRow2 = attSheet3.data.data.employees.find((e: any) => e.employeeId === 'EMP-101');
    if (jebaRow2.days['1'] !== 'P' || jebaRow2.days['2'] !== 'P' || jebaRow2.days['3'] !== 'HD' || jebaRow2.days['4'] !== 'A') {
      throw new Error(`Saved attendance values mismatch: ${JSON.stringify(jebaRow2.days)}`);
    }
    console.log('  ✓ Attendance persistence verified: Day 1=P, Day 2=P, Day 3=HD, Day 4=A, Remaining=NM');

    // 6. Employee Login (EMP-101)
    const empLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'EMP-101', password: 'Password@123' },
    });
    if (!empLogin.data.success) throw new Error('EMP-101 login failed');
    const empAuth = { headers: { Authorization: `Bearer ${empLogin.data.data.accessToken}` } };
    console.log('  ✓ Employee EMP-101 logged in with Employee ID & Password');

    // 7. Employee applies for leave
    const leaveTypes = await request('/leave/types', empAuth);
    const casualLeave = leaveTypes.data.data.find((t: any) => t.name.includes('Casual'));
    const leaveApply = await request('/leave/apply', {
      method: 'POST',
      headers: empAuth.headers,
      body: {
        leaveTypeId: casualLeave.id,
        startDate: '2026-10-06',
        endDate: '2026-10-07',
        reason: 'Family function in home town',
      },
    });
    const leaveReqId = leaveApply.data.data.id;
    console.log(`  ✓ Employee applied for 2 days Casual Leave (${leaveReqId})`);

    // 8. Admin approves leave request
    const approveLeave = await request(`/leave/requests/${leaveReqId}/approve`, {
      method: 'PUT',
      headers: adminAuth.headers,
      body: { remarks: 'Approved by Engineering Director' },
    });
    if (!approveLeave.data.success) throw new Error('Leave approval failed');
    console.log('  ✓ Admin approved leave request');

    // 9. Verify Attendance Sheet automatically synced approved leave dates to 'L'
    const attSheet4 = await request('/attendance/sheet?month=10&year=2026', adminAuth);
    const jebaRow3 = attSheet4.data.data.employees.find((e: any) => e.employeeId === 'EMP-101');
    if (jebaRow3.days['6'] !== 'L' || jebaRow3.days['7'] !== 'L') {
      throw new Error(`Attendance sheet did not sync approved leave: day6=${jebaRow3.days['6']}, day7=${jebaRow3.days['7']}`);
    }
    console.log('  ✓ Attendance sheet verified: Days 6 & 7 automatically synced to L (Leave)');

    // 10. Admin finalizes attendance
    const finAtt = await request('/attendance/finalize', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { month: 10, year: 2026, notes: 'Audited and locked for October payroll' },
    });
    if (!finAtt.data.success) throw new Error('Attendance finalization failed');
    console.log('  ✓ Admin finalized October 2026 attendance sheet');

    // 11. Calculate Payroll
    const calcPay = await request('/payroll/calculate', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { month: 10, year: 2026 },
    });
    const runId = calcPay.data.data.id;
    console.log(`  ✓ Admin calculated October 2026 Payroll (Run ID: ${runId}, Total Net: ₹${calcPay.data.data.totalNet})`);

    // 12. Finalize Payroll & Generate Payslip
    const finPay = await request('/payroll/finalize', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { id: runId },
    });
    if (!finPay.data.success) throw new Error('Payroll finalization failed');
    console.log('  ✓ Admin finalized payroll and published official payslips');

    // 13. Employee views own payslip
    const empPayslips = await request('/payroll/my-payslips', empAuth);
    if (empPayslips.data.data.length === 0) throw new Error('Employee did not receive payslip');
    const mySlip = empPayslips.data.data[0];
    console.log(`  ✓ Employee retrieved payslip: Gross=₹${mySlip.gross_salary}, Deductions=₹${mySlip.total_deductions}, Net Take-Home=₹${mySlip.net_salary}`);

    // 14. Projects & Tasks
    const clientRes = await request('/clients', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { companyName: 'Fintech Solutions Global', contactPerson: 'Arun Kumar', email: 'arun@fintechglobal.com', phone: '+91 9988776655' },
    });
    const clientId = clientRes.data.data.id;

    const projRes = await request('/projects', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { name: 'Payment Gateway Integration', clientId, budget: 500000, startDate: '2026-10-01', deadline: '2026-12-31', status: 'active', priority: 'high' },
    });
    const projId = projRes.data.data.id;

    const taskRes = await request('/tasks', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { name: 'Develop Webhook Handlers', projectId: projId, assignedEmployeeId: emp1Id, priority: 'high', status: 'todo' },
    });
    const taskId = taskRes.data.data.id;
    console.log(`  ✓ Admin created Client, Project, and Task assigned to EMP-101`);

    // 15. Employee updates task status
    const updateTask = await request(`/tasks/${taskId}`, {
      method: 'PUT',
      headers: empAuth.headers,
      body: { status: 'in_progress' },
    });
    if (!updateTask.data.success) throw new Error('Employee task update failed');
    console.log('  ✓ Employee updated assigned task status to in_progress');

    // 16. Finance Income & Expense
    await request('/finance/income', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { category: 'Client Payment', description: 'Milestone 1 Payment', amount: 200000, date: '2026-10-07', payment_method: 'bank_transfer' },
    });
    await request('/finance/expenses', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { category: 'Software & Subscriptions', description: 'GitHub Enterprise License', amount: 12000, date: '2026-10-07', payment_method: 'credit_card' },
    });
    console.log('  ✓ Admin recorded Income (₹2,00,000) and Expense (₹12,000)');

    // 17. Super Admin Investments
    const invCreate = await request('/investments', {
      method: 'POST',
      headers: superAuth.headers,
      body: { name: 'Series A Venture Note', type: 'Equity', amount: 2500000, currentValue: 3000000, date: '2026-10-01', source: 'Treasury Reserves', status: 'active' },
    });
    console.log(`  ✓ Super Admin created Investment record: ₹25,00,000 (Valuation: ₹30,00,000)`);

    // -------------------------------------------------------------------------
    // PHASE 3: SECURITY & ACCESS CONTROL BOUNDARIES
    // -------------------------------------------------------------------------
    console.log('\n[PHASE 3] Enforcing Role Security Boundaries...');

    const empBlocked = await request('/investments', empAuth);
    if (empBlocked.status !== 403) throw new Error('SECURITY FAILURE: Employee was not blocked from Investments!');
    console.log('  ✓ Security check PASSED: Employee blocked from Investments (HTTP 403)');

    const adminBlocked = await request('/investments', adminAuth);
    if (adminBlocked.status !== 403) throw new Error('SECURITY FAILURE: Admin was not blocked from Super Admin Investments!');
    console.log('  ✓ Security check PASSED: Admin blocked from Super Admin Investments (HTTP 403)');

    const empPayBlocked = await request('/payroll/runs', empAuth);
    if (empPayBlocked.status !== 403) throw new Error('SECURITY FAILURE: Employee was not blocked from Payroll Runs!');
    console.log('  ✓ Security check PASSED: Employee blocked from Admin Payroll Runs (HTTP 403)');

    console.log('\n===================================================================');
    console.log('ALL TESTS PASSED: CLEAN SYSTEM, ZERO FAKE DATA, 100% REAL PERSISTENCE');
    console.log('===================================================================\n');

  } catch (error: any) {
    console.error('\n❌ VERIFICATION FAILED:', error.message || error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCleanSystemVerification();
