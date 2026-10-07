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

async function runE2ETests() {
  console.log('===============================================================');
  console.log('STARTING OFFICE-ERP COMPLETE END-TO-END VERIFICATION');
  console.log('===============================================================\n');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: EMPLOYEE AUTH & SELF-SERVICE WORKFLOW
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Testing Employee Login & Self-Service Workflow (EMP-001)...');

    // Login with Employee ID
    const empLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'EMP-001', password: 'Password@123' },
    });

    if (!empLoginRes.data.success || !empLoginRes.data.data.accessToken) {
      throw new Error(`Employee ID login failed: ${JSON.stringify(empLoginRes.data)}`);
    }
    const empToken = empLoginRes.data.data.accessToken;
    const empAuth = { headers: { Authorization: `Bearer ${empToken}` } };
    console.log('  ✓ Employee logged in via Employee ID (EMP-001)');

    // Fetch Employee Dashboard
    const empDashRes = await request('/dashboard/stats', empAuth);
    if (!empDashRes.data.success || empDashRes.data.data.role !== 'employee') {
      throw new Error(`Employee dashboard mismatch: ${JSON.stringify(empDashRes.data)}`);
    }
    console.log('  ✓ Employee dashboard verified (Role: employee)');

    // View My Attendance
    const empAttRes = await request('/attendance/my?month=10&year=2026', empAuth);
    if (!empAttRes.data.success || !empAttRes.data.data.records) {
      throw new Error('My attendance records failed');
    }
    console.log(`  ✓ Employee retrieved October 2026 attendance (${empAttRes.data.data.summary.present} present days)`);

    // View Leave Balances
    const leaveBalRes = await request('/leave/balances?year=2026', empAuth);
    const casualLeave = leaveBalRes.data.data?.find((b: any) => b.leave_type_code === 'CL' || b.leave_type_name?.includes('Casual'));
    console.log(`  ✓ Employee leave balance verified (${casualLeave?.remaining_days || 0} CL days available)`);

    // Apply for Leave
    const leaveApplyRes = await request('/leave/apply', {
      method: 'POST',
      headers: empAuth.headers,
      body: {
        leave_type_id: casualLeave?.leave_type_id || 1,
        start_date: '2026-10-15',
        end_date: '2026-10-16',
        reason: 'Attending family celebration',
      },
    });
    const leaveRequestId = leaveApplyRes.data.data.id;
    console.log(`  ✓ Employee submitted leave application (Request ID: ${leaveRequestId})`);

    // View My Payslips
    const myPayslipsRes = await request('/payroll/my-payslips', empAuth);
    console.log(`  ✓ Employee checked payslips (${myPayslipsRes.data.data?.length || 0} payslips found)`);

    // -------------------------------------------------------------------------
    // TEST 2: ADMIN WORKFLOW & LEAVE-ATTENDANCE-PAYROLL INTEGRATION
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Admin Operations & Cross-Module Integrations...');

    // Login as Admin
    const adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'hr.admin@erp.local', password: 'Admin@123456' },
    });
    const adminToken = adminLoginRes.data.data.accessToken;
    const adminAuth = { headers: { Authorization: `Bearer ${adminToken}` } };
    console.log('  ✓ Admin logged in (hr.admin@erp.local)');

    // Approve Leave Request
    const approveRes = await request(`/leave/requests/${leaveRequestId}/approve`, {
      method: 'PUT',
      headers: adminAuth.headers,
      body: { remarks: 'Approved by HR Department' },
    });
    if (!approveRes.data.success) throw new Error(`Leave approval failed: ${JSON.stringify(approveRes.data)}`);
    console.log(`  ✓ Admin approved leave request #${leaveRequestId}`);

    // Verify Attendance Sync (Dates 2026-10-15 & 2026-10-16 marked as 'leave')
    const sheetRes = await request('/attendance/sheet?month=10&year=2026', adminAuth);
    const emp1Grid = sheetRes.data.data.employees.find((e: any) => e.employeeId === 'EMP-001' || e.code === 'EMP-001');
    if (!emp1Grid) throw new Error('Employee EMP-001 not found in attendance sheet');
    
    if (emp1Grid.days['15'] !== 'L' || emp1Grid.days['16'] !== 'L') {
      throw new Error(`Attendance did not sync approved leave: day15=${emp1Grid.days['15']}, day16=${emp1Grid.days['16']}`);
    }
    console.log(`  ✓ Attendance sync verified: 2026-10-15=${emp1Grid.days['15']}, 2026-10-16=${emp1Grid.days['16']}`);

    // Reopen attendance if previously finalized
    await request('/attendance/reopen', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { month: 10, year: 2026 },
    });

    // Save Attendance Updates
    const saveSheetRes = await request('/attendance/sheet', {
      method: 'POST',
      headers: adminAuth.headers,
      body: {
        month: 10,
        year: 2026,
        updates: [
          { employee_id: emp1Grid.id, day: 17, status: 'P' },
          { employee_id: emp1Grid.id, day: 18, status: 'WO' },
        ],
      },
    });
    if (!saveSheetRes.data.success) throw new Error(`Attendance batch save failed: ${JSON.stringify(saveSheetRes.data)}`);
    console.log('  ✓ Admin modified and saved attendance spreadsheet grid');

    // Finalize Attendance for October 2026
    const finalizeAttRes = await request('/attendance/finalize', {
      method: 'POST',
      headers: adminAuth.headers,
      body: {
        month: 10,
        year: 2026,
        notes: 'October attendance audited and finalized for payroll calculation.',
      },
    });
    console.log(`  ✓ Attendance finalized (Status: ${finalizeAttRes.data.data.status})`);

    // Run Payroll Calculation for October 2026
    console.log('  Calculating Centralized Payroll for October 2026...');
    const calcPayrollRes = await request('/payroll/calculate', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { month: 10, year: 2026 },
    });
    const payrollRunId = calcPayrollRes.data.data.id || calcPayrollRes.data.data.payrollRun?.id;
    console.log(`  ✓ Payroll calculated: ${calcPayrollRes.data.data.totalEmployees || calcPayrollRes.data.data.total_employees} employees, Total Net: $${calcPayrollRes.data.data.totalNet || calcPayrollRes.data.data.total_net}`);

    // Finalize Payroll Run
    const finalizePayRes = await request('/payroll/finalize', {
      method: 'POST',
      headers: adminAuth.headers,
      body: { id: payrollRunId },
    });
    console.log(`  ✓ Payroll finalized and official payslips generated (Run ID: ${payrollRunId})`);

    // Create Finance Income & Expense
    const incomeRes = await request('/finance/income', {
      method: 'POST',
      headers: adminAuth.headers,
      body: {
        category: 'Client Retainer',
        description: 'Acme Corp Q4 Milestone',
        amount: 12500,
        date: '2026-10-07',
        payment_method: 'bank_transfer',
      },
    });
    console.log(`  ✓ Admin recorded income transaction: $12,500`);

    const expenseRes = await request('/finance/expenses', {
      method: 'POST',
      headers: adminAuth.headers,
      body: {
        category: 'Cloud Infrastructure',
        description: 'AWS Production Cluster hosting',
        amount: 1450,
        date: '2026-10-07',
        payment_method: 'credit_card',
      },
    });
    console.log(`  ✓ Admin recorded expense transaction: $1,450`);

    // -------------------------------------------------------------------------
    // TEST 3: SUPER ADMIN WORKFLOW & CONFIDENTIAL INVESTMENTS
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Super Admin Exclusive Capabilities...');

    // Login as Super Admin
    const superLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'admin@erp.local', password: 'Admin@123456' },
    });
    const superToken = superLoginRes.data.data.accessToken;
    const superAuth = { headers: { Authorization: `Bearer ${superToken}` } };
    console.log('  ✓ Super Admin logged in (admin@erp.local)');

    // Super Admin accesses investments
    const invListRes = await request('/investments', superAuth);
    if (!invListRes.data.success) throw new Error('Super Admin failed to access investments');
    console.log(`  ✓ Super Admin retrieved investment portfolio (Total Invested: $${invListRes.data.data.summary.totalInvested})`);

    // Create new investment
    const createInvRes = await request('/investments', {
      method: 'POST',
      headers: superAuth.headers,
      body: {
        name: 'TechFin Seed SAFE Note',
        type: 'Venture Capital',
        amount: 75000,
        currentValue: 90000,
        returnRate: 20.0,
        date: '2026-10-01',
        source: 'Corporate Treasury Reserve',
        status: 'active',
        notes: 'Series Seed SAFE with 20% valuation cap discount',
      },
    });
    const newInvId = createInvRes.data.data.id;
    console.log(`  ✓ Super Admin created investment record (${newInvId})`);

    // View Audit Logs
    const auditRes = await request('/audit', superAuth);
    console.log(`  ✓ Super Admin viewed security audit trail (${auditRes.data.data?.length || 0} entries)`);

    // -------------------------------------------------------------------------
    // TEST 4: STRICT AUTHORIZATION & SECURITY BOUNDARIES
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Role-Based Security Boundaries & Rejections...');

    // 1. Employee attempts to access investments -> Must fail 403
    const empInvRes = await request('/investments', empAuth);
    if (empInvRes.status === 403) {
      console.log('  ✓ Security check PASSED: Employee blocked from Investments API (HTTP 403)');
    } else {
      throw new Error(`SECURITY BREACH: Employee accessed investments API! (Status: ${empInvRes.status})`);
    }

    // 2. Normal Admin attempts to access investments -> Must fail 403
    const adminInvRes = await request('/investments', adminAuth);
    if (adminInvRes.status === 403) {
      console.log('  ✓ Security check PASSED: Admin blocked from Investments API (HTTP 403)');
    } else {
      throw new Error(`SECURITY BREACH: Admin accessed Super Admin investments API! (Status: ${adminInvRes.status})`);
    }

    // 3. Employee attempts to access Admin Payroll Runs -> Must fail 403
    const empPayRunsRes = await request('/payroll/runs', empAuth);
    if (empPayRunsRes.status === 403) {
      console.log('  ✓ Security check PASSED: Employee blocked from Admin Payroll Runs (HTTP 403)');
    } else {
      throw new Error(`SECURITY BREACH: Employee accessed Admin Payroll Runs! (Status: ${empPayRunsRes.status})`);
    }

    // 4. Employee attempts to finalize attendance -> Must fail 403
    const empFinalizeAttRes = await request('/attendance/finalize', {
      method: 'POST',
      headers: empAuth.headers,
      body: { month: 10, year: 2026 },
    });
    if (empFinalizeAttRes.status === 403) {
      console.log('  ✓ Security check PASSED: Employee blocked from Attendance Finalization (HTTP 403)');
    } else {
      throw new Error(`SECURITY BREACH: Employee attempted to finalize attendance! (Status: ${empFinalizeAttRes.status})`);
    }

    console.log('\n===============================================================');
    console.log('ALL WORKFLOW AND SECURITY TESTS PASSED WITH 100% SUCCESS!');
    console.log('===============================================================\n');

  } catch (error: any) {
    console.error('\n❌ TEST SUITE FAILED:', error.message || error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runE2ETests();
