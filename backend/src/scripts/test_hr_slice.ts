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

async function testHrSlice() {
  console.log('--- Starting Slice 3.4: HR / Employees / Departments E2E Test ---');

  // 1. Authenticate HR Manager
  const hrLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'hr.manager@erp.local', password: 'Admin@123456' },
  });
  const hrToken = hrLogin.data.data.token;
  const hrHeaders = { Authorization: `Bearer ${hrToken}` };
  console.log('✔ Authenticated as HR Manager');

  // Clean previous test dept / employee if exists
  await query('DELETE FROM employees WHERE employee_id = "EMP-QA-TEST-01"');
  await query('DELETE FROM users WHERE email = "qa.tester@erp.local"');
  await query('DELETE FROM departments WHERE name = "Quality Assurance Test"');

  // 2. Create Department
  console.log('2. Creating Department...');
  const deptRes = await req(`${API}/departments`, {
    method: 'POST',
    headers: hrHeaders,
    body: {
      name: 'Quality Assurance Test',
      description: 'QA & Automation Testing Unit',
      status: 'active',
    },
  });
  if (!deptRes.ok) throw new Error(`Dept create failed: ${JSON.stringify(deptRes.data)}`);
  const deptId = deptRes.data.data.id;
  console.log(`✔ Created Department: ${deptId}`);

  // 3. Create Employee in Department
  console.log('3. Creating Employee...');
  const empRes = await req(`${API}/employees`, {
    method: 'POST',
    headers: hrHeaders,
    body: {
      employeeId: 'EMP-QA-TEST-01',
      firstName: 'Aarav',
      lastName: 'Kumar',
      email: 'qa.tester@erp.local',
      phone: '+91 9876543210',
      designation: 'Senior QA Engineer',
      departmentId: deptId,
      joiningDate: '2026-02-01',
      employmentType: 'full_time',
      basicSalary: 65000.00,
      createUserAccount: true,
      password: 'Tester@123456',
    },
  });
  if (!empRes.ok) throw new Error(`Employee create failed: ${JSON.stringify(empRes.data)}`);
  const newEmpId = empRes.data.data.id;
  console.log(`✔ Created Employee: ${newEmpId}`);

  // 4. Verify Employee Details & Sub-tabs
  console.log('4. Fetching Employee Profile and Sub-tabs...');
  const getEmpRes = await req(`${API}/employees/${newEmpId}`, {
    headers: hrHeaders,
  });
  if (!getEmpRes.ok) throw new Error(`Get employee failed: ${JSON.stringify(getEmpRes.data)}`);
  const empProfile = getEmpRes.data.data;
  if (!empProfile.salaryStructure || Number(empProfile.salaryStructure.basic_salary) !== 65000) {
    throw new Error('Salary structure was not auto-initialized correctly');
  }
  if (!empProfile.leaveBalances || empProfile.leaveBalances.length === 0) {
    throw new Error('Leave balances were not auto-allocated');
  }
  console.log(`✔ Verified Employee profile, salary structure (₹${empProfile.salaryStructure.basic_salary}), and ${empProfile.leaveBalances.length} leave categories`);

  // 5. Update Employee Details
  console.log('5. Updating Employee Details...');
  const updateRes = await req(`${API}/employees/${newEmpId}`, {
    method: 'PUT',
    headers: hrHeaders,
    body: {
      designation: 'Lead QA Architect',
      basicSalary: 80000.00,
    },
  });
  if (!updateRes.ok) throw new Error(`Update employee failed: ${JSON.stringify(updateRes.data)}`);
  console.log('✔ Updated employee designation and salary');

  // 6. Verify Update in MySQL
  const checkEmp = await query<any[]>('SELECT * FROM employees WHERE id = ?', [newEmpId]);
  if (checkEmp[0].designation !== 'Lead QA Architect' || Number(checkEmp[0].basic_salary) !== 80000) {
    throw new Error(`DB verification failed: ${JSON.stringify(checkEmp[0])}`);
  }
  console.log('✔ Verified updated employee record in MySQL');

  // Cleanup
  await query('DELETE FROM leave_balances WHERE employee_id = ?', [newEmpId]);
  await query('DELETE FROM salary_structures WHERE employee_id = ?', [newEmpId]);
  await query('DELETE FROM employees WHERE id = ?', [newEmpId]);
  await query('DELETE FROM users WHERE email = "qa.tester@erp.local"');
  await query('DELETE FROM departments WHERE id = ?', [deptId]);

  console.log('--- SLICE 3.4 (HR & EMPLOYEES) PASSED ALL TESTS ---');
  process.exit(0);
}

testHrSlice().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
