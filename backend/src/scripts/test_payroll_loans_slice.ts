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

async function testPayrollLoansSlice() {
  console.log('--- Starting Slice 3.6: Payroll & Loans E2E Test ---');

  // 1. Authenticate HR Manager
  const hrLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'hr.manager@erp.local', password: 'Admin@123456' },
  });
  const hrHeaders = { Authorization: `Bearer ${hrLogin.data.data.token}` };
  console.log('✔ Authenticated as HR Manager');

  // 2. Authenticate Finance Manager
  const finLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'finance.manager@erp.local', password: 'Admin@123456' },
  });
  const finHeaders = { Authorization: `Bearer ${finLogin.data.data.token}` };
  console.log('✔ Authenticated as Finance Manager');

  // 3. Authenticate Developer Employee
  const empLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'developer.employee@erp.local', password: 'Admin@123456' },
  });
  const empHeaders = { Authorization: `Bearer ${empLogin.data.data.token}` };
  console.log('✔ Authenticated as Developer Employee');

  const empRows = await query<any[]>('SELECT id FROM employees WHERE employee_id = "EMP-0007"');
  const empId = empRows[0].id;

  // Clean existing payroll for month 11 / 2026 if any
  const testMonth = 11;
  const testYear = 2026;
  await query('DELETE FROM payroll WHERE month = ? AND year = ?', [testMonth, testYear]);
  await query('DELETE FROM employee_loans WHERE employee_id = ? AND reason LIKE "%Test Advance%"', [empId]);

  // 4. Employee Applies for Salary Advance
  console.log('4. Employee applying for salary advance...');
  const loanRes = await req(`${API}/loans`, {
    method: 'POST',
    headers: empHeaders,
    body: {
      type: 'advance',
      amount: 10000.00,
      totalTenureMonths: 2,
      reason: 'Automated Test Advance Application',
    },
  });
  if (!loanRes.ok) throw new Error(`Loan apply failed: ${JSON.stringify(loanRes.data)}`);
  const loanId = loanRes.data.data.id;
  console.log(`✔ Applied for Advance: ${loanId}`);

  // 5. Finance Manager Approves Advance (sets status to active)
  console.log('5. Finance Manager approving advance...');
  const approveLoanRes = await req(`${API}/loans/${loanId}/review`, {
    method: 'PUT',
    headers: finHeaders,
    body: { status: 'active' },
  });
  if (!approveLoanRes.ok) throw new Error(`Approve loan failed: ${JSON.stringify(approveLoanRes.data)}`);
  console.log('✔ Finance Manager approved advance');

  // 6. HR Manager Generates Monthly Payroll
  console.log(`6. HR Manager generating payroll for ${testMonth}/${testYear}...`);
  const processRes = await req(`${API}/payroll/process`, {
    method: 'POST',
    headers: hrHeaders,
    body: {
      month: testMonth,
      year: testYear,
    },
  });
  if (!processRes.ok) throw new Error(`Payroll process failed: ${JSON.stringify(processRes.data)}`);
  const payrollId = processRes.data.data.payrollId;
  console.log(`✔ Processed payroll: ${payrollId}`);

  // 7. Verify Loan EMI deduction is included in Employee's payroll item
  const getPayrollRes = await req(`${API}/payroll/${payrollId}`, {
    headers: hrHeaders,
  });
  if (!getPayrollRes.ok) throw new Error(`Get payroll failed: ${JSON.stringify(getPayrollRes.data)}`);
  const payrollData = getPayrollRes.data.data;
  const empItem = payrollData.items.find((i: any) => i.employee_id === empId);
  if (!empItem) throw new Error('Employee item not found in generated payroll');
  if (Number(empItem.loan_deductions) !== 5000) {
    throw new Error(`Expected loan_deductions = 5000, got ${empItem.loan_deductions}`);
  }
  console.log(`✔ Verified Advance EMI deduction (₹${empItem.loan_deductions}) integrated into payroll item.`);

  // 8. Finance Manager Approves & Locks Payroll
  console.log('8. Finance Manager approving and locking payroll...');
  const approvePayrollRes = await req(`${API}/payroll/${payrollId}/approve`, {
    method: 'PUT',
    headers: finHeaders,
  });
  if (!approvePayrollRes.ok) throw new Error(`Approve payroll failed: ${JSON.stringify(approvePayrollRes.data)}`);
  console.log('✔ Finance Manager approved and locked payroll run');

  // 9. Employee Views Payslip
  console.log('9. Employee retrieving generated payslip...');
  const payslipRes = await req(`${API}/payroll/payslip/${empItem.id}`, {
    headers: empHeaders,
  });
  if (!payslipRes.ok) throw new Error(`Payslip retrieval failed: ${JSON.stringify(payslipRes.data)}`);
  const payslip = payslipRes.data.data.payslip;
  console.log(`✔ Employee retrieved payslip: Gross=₹${payslip.gross_salary}, Deductions=₹${payslip.loan_deductions + payslip.pf_deductions + payslip.tax_deductions}, Net=₹${payslip.net_salary}`);

  // Cleanup
  await query('DELETE FROM expenses WHERE expense_code = ?', [`EXP-PAY-${testMonth}-${testYear}`]);
  await query('DELETE FROM payroll WHERE id = ?', [payrollId]);
  await query('DELETE FROM employee_loans WHERE id = ?', [loanId]);

  console.log('--- SLICE 3.6 (PAYROLL & LOANS) PASSED ALL TESTS ---');
}

testPayrollLoansSlice().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
