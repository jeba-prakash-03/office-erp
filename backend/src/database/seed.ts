import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../config/db';
import { logger } from '../utils/logger';

export async function seedSystem() {
  logger.info('Starting system configuration seeding...');

  // 1. Seed Roles
  const roles = [
    { id: 'role-super-admin', name: 'super_admin', display_name: 'Super Admin', description: 'Complete system authority and configuration access', is_system: true },
    { id: 'role-admin', name: 'admin', display_name: 'Admin', description: 'Full organizational administration rights', is_system: true },
    { id: 'role-hr-manager', name: 'hr_manager', display_name: 'HR Manager', description: 'Manages employees, attendance, leave, and payroll processing', is_system: true },
    { id: 'role-finance-manager', name: 'finance_manager', display_name: 'Finance Manager', description: 'Manages company finances, invoices, payments, and payroll approval', is_system: true },
    { id: 'role-project-manager', name: 'project_manager', display_name: 'Project Manager', description: 'Manages projects, milestones, tasks, and timesheet approvals', is_system: true },
    { id: 'role-team-lead', name: 'team_lead', display_name: 'Team Lead', description: 'Manages team members, assigns tasks, and reviews timesheets', is_system: true },
    { id: 'role-employee', name: 'employee', display_name: 'Employee', description: 'Standard employee portal access for attendance, tasks, leaves, and payslips', is_system: true },
    { id: 'role-accountant', name: 'accountant', display_name: 'Accountant', description: 'Handles book-keeping, invoices, expenses, and payments', is_system: true },
    { id: 'role-sales-bd', name: 'sales_bd', display_name: 'Sales / Business Development', description: 'Manages leads, client relationships, and sales pipelines', is_system: true },
    { id: 'role-client', name: 'client', display_name: 'Client', description: 'Client portal access for their specific projects, tasks, and invoices', is_system: true },
  ];

  for (const role of roles) {
    await query(
      `INSERT INTO roles (id, name, display_name, description, is_system)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description)`,
      [role.id, role.name, role.display_name, role.description, role.is_system]
    );
  }

  // 2. Seed Permissions
  const permissions = [
    // Users & Roles
    { id: 'perm-users-view', name: 'users.view', module: 'users', description: 'View system users' },
    { id: 'perm-users-manage', name: 'users.manage', module: 'users', description: 'Create, update, and deactivate users' },
    { id: 'perm-roles-manage', name: 'roles.manage', module: 'roles', description: 'Manage roles and permissions' },

    // Employees
    { id: 'perm-emp-view', name: 'employees.view', module: 'employees', description: 'View employee directory and profiles' },
    { id: 'perm-emp-create', name: 'employees.create', module: 'employees', description: 'Create new employee profiles' },
    { id: 'perm-emp-edit', name: 'employees.edit', module: 'employees', description: 'Edit employee details' },
    { id: 'perm-emp-delete', name: 'employees.delete', module: 'employees', description: 'Deactivate or delete employees' },

    // Departments
    { id: 'perm-dept-view', name: 'departments.view', module: 'departments', description: 'View departments' },
    { id: 'perm-dept-manage', name: 'departments.manage', module: 'departments', description: 'Create, edit, and delete departments' },

    // Clients
    { id: 'perm-client-view', name: 'clients.view', module: 'clients', description: 'View clients and client profiles' },
    { id: 'perm-client-create', name: 'clients.create', module: 'clients', description: 'Create new clients' },
    { id: 'perm-client-edit', name: 'clients.edit', module: 'clients', description: 'Edit client information' },
    { id: 'perm-client-delete', name: 'clients.delete', module: 'clients', description: 'Delete clients' },

    // Leads
    { id: 'perm-lead-view', name: 'leads.view', module: 'leads', description: 'View CRM leads pipeline' },
    { id: 'perm-lead-manage', name: 'leads.manage', module: 'leads', description: 'Create, update, and convert leads' },

    // Projects
    { id: 'perm-proj-view', name: 'projects.view', module: 'projects', description: 'View projects and details' },
    { id: 'perm-proj-create', name: 'projects.create', module: 'projects', description: 'Create new projects' },
    { id: 'perm-proj-edit', name: 'projects.edit', module: 'projects', description: 'Edit project details and members' },
    { id: 'perm-proj-delete', name: 'projects.delete', module: 'projects', description: 'Delete projects' },

    // Tasks
    { id: 'perm-task-view', name: 'tasks.view', module: 'tasks', description: 'View tasks and Kanban boards' },
    { id: 'perm-task-create', name: 'tasks.create', module: 'tasks', description: 'Create new tasks' },
    { id: 'perm-task-assign', name: 'tasks.assign', module: 'tasks', description: 'Assign and reassign tasks' },
    { id: 'perm-task-update', name: 'tasks.update', module: 'tasks', description: 'Update task progress and comments' },
    { id: 'perm-task-delete', name: 'tasks.delete', module: 'tasks', description: 'Delete tasks' },

    // Attendance
    { id: 'perm-att-view', name: 'attendance.view', module: 'attendance', description: 'View attendance logs' },
    { id: 'perm-att-manage', name: 'attendance.manage', module: 'attendance', description: 'Manage and manually log attendance' },
    { id: 'perm-att-approve', name: 'attendance.approve', module: 'attendance', description: 'Approve attendance correction requests' },

    // Leave
    { id: 'perm-leave-view', name: 'leave.view', module: 'leave', description: 'View leave requests and balances' },
    { id: 'perm-leave-apply', name: 'leave.apply', module: 'leave', description: 'Apply for leaves' },
    { id: 'perm-leave-approve', name: 'leave.approve', module: 'leave', description: 'Approve or reject leave applications' },
    { id: 'perm-leave-manage', name: 'leave.manage', module: 'leave', description: 'Configure leave types and employee allocations' },

    // Payroll
    { id: 'perm-payroll-view', name: 'payroll.view', module: 'payroll', description: 'View payroll runs and salary structures' },
    { id: 'perm-payroll-create', name: 'payroll.create', module: 'payroll', description: 'Generate and process monthly payroll' },
    { id: 'perm-payroll-approve', name: 'payroll.approve', module: 'payroll', description: 'Approve and lock monthly payroll' },
    { id: 'perm-payroll-manage', name: 'payroll.manage', module: 'payroll', description: 'Configure salary structures and loans' },

    // Finance & Invoices
    { id: 'perm-fin-view', name: 'finance.view', module: 'finance', description: 'View financial summary, income, and expenses' },
    { id: 'perm-fin-create', name: 'finance.create', module: 'finance', description: 'Record income and expenses' },
    { id: 'perm-fin-edit', name: 'finance.edit', module: 'finance', description: 'Edit income and expenses' },
    { id: 'perm-fin-delete', name: 'finance.delete', module: 'finance', description: 'Delete financial records' },
    { id: 'perm-inv-manage', name: 'invoices.manage', module: 'invoices', description: 'Create and manage client invoices' },
    { id: 'perm-pay-manage', name: 'payments.manage', module: 'payments', description: 'Record and manage client payments' },

    // Assets
    { id: 'perm-asset-view', name: 'assets.view', module: 'assets', description: 'View company assets' },
    { id: 'perm-asset-manage', name: 'assets.manage', module: 'assets', description: 'Create, assign, and manage company assets' },

    // Documents
    { id: 'perm-doc-view', name: 'documents.view', module: 'documents', description: 'View authorized documents' },
    { id: 'perm-doc-manage', name: 'documents.manage', module: 'documents', description: 'Upload, manage, and delete documents' },

    // Announcements & Notifications
    { id: 'perm-ann-view', name: 'announcements.view', module: 'announcements', description: 'View company announcements' },
    { id: 'perm-ann-manage', name: 'announcements.manage', module: 'announcements', description: 'Create and publish announcements' },

    // Meetings & Calendar
    { id: 'perm-meet-view', name: 'meetings.view', module: 'meetings', description: 'View meetings and calendar' },
    { id: 'perm-meet-manage', name: 'meetings.manage', module: 'meetings', description: 'Schedule and manage meetings' },

    // Timesheets
    { id: 'perm-time-log', name: 'timesheets.log', module: 'timesheets', description: 'Log hours on projects and tasks' },
    { id: 'perm-time-approve', name: 'timesheets.approve', module: 'timesheets', description: 'Approve employee timesheets' },

    // Performance
    { id: 'perm-perf-view', name: 'performance.view', module: 'performance', description: 'View performance reviews' },
    { id: 'perm-perf-manage', name: 'performance.manage', module: 'performance', description: 'Conduct and submit performance reviews' },

    // Reports & Settings & Audit
    { id: 'perm-rep-view', name: 'reports.view', module: 'reports', description: 'Access enterprise reporting and exports' },
    { id: 'perm-set-manage', name: 'settings.manage', module: 'settings', description: 'Manage company configuration and system parameters' },
    { id: 'perm-audit-view', name: 'audit_logs.view', module: 'audit', description: 'View immutable system audit logs' },
  ];

  for (const perm of permissions) {
    await query(
      `INSERT INTO permissions (id, name, module, description)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description), module = VALUES(module)`,
      [perm.id, perm.name, perm.module, perm.description]
    );
  }

  // 3. Map Permissions to Roles
  // Super Admin gets ALL permissions
  for (const perm of permissions) {
    await query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
      ['role-super-admin', perm.id]
    );
    await query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
      ['role-admin', perm.id]
    );
  }

  // HR Manager permissions
  const hrPerms = permissions.filter(p => 
    p.module === 'employees' || 
    p.module === 'departments' || 
    p.module === 'attendance' || 
    p.module === 'leave' || 
    p.module === 'payroll' || 
    p.module === 'performance' || 
    p.module === 'announcements' || 
    p.module === 'documents' || 
    p.module === 'meetings' || 
    p.name === 'reports.view'
  );
  for (const p of hrPerms) {
    await query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, ['role-hr-manager', p.id]);
  }

  // Finance Manager permissions
  const finPerms = permissions.filter(p => 
    p.module === 'finance' || 
    p.module === 'invoices' || 
    p.module === 'payments' || 
    p.module === 'payroll' || 
    p.module === 'clients' || 
    p.name === 'reports.view' || 
    p.name === 'documents.view'
  );
  for (const p of finPerms) {
    await query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, ['role-finance-manager', p.id]);
  }

  // Project Manager permissions
  const pmPerms = permissions.filter(p => 
    p.module === 'projects' || 
    p.module === 'tasks' || 
    p.module === 'timesheets' || 
    p.module === 'clients' || 
    p.module === 'meetings' || 
    p.module === 'documents' || 
    p.name === 'attendance.view' || 
    p.name === 'performance.manage' || 
    p.name === 'performance.view' || 
    p.name === 'reports.view'
  );
  for (const p of pmPerms) {
    await query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, ['role-project-manager', p.id]);
    await query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, ['role-team-lead', p.id]);
  }

  // Employee standard permissions
  const empPerms = permissions.filter(p => 
    p.name === 'tasks.view' || 
    p.name === 'tasks.update' || 
    p.name === 'attendance.view' || 
    p.name === 'leave.apply' || 
    p.name === 'leave.view' || 
    p.name === 'timesheets.log' || 
    p.name === 'documents.view' || 
    p.name === 'announcements.view' || 
    p.name === 'meetings.view' || 
    p.name === 'projects.view' || 
    p.name === 'performance.view'
  );
  for (const p of empPerms) {
    await query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, ['role-employee', p.id]);
  }

  // Sales / BD permissions
  const salesPerms = permissions.filter(p => 
    p.module === 'leads' || 
    p.module === 'clients' || 
    p.name === 'projects.view' || 
    p.name === 'meetings.view' || 
    p.name === 'meetings.manage' || 
    p.name === 'documents.view'
  );
  for (const p of salesPerms) {
    await query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, ['role-sales-bd', p.id]);
  }

  // 4. Seed Initial Multi-Role Accounts (1 per role, manager/report pair, client with project and invoice)
  const defaultPassword = 'Admin@123456';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  // Look up departments dynamically
  const deptRows = await query<any[]>('SELECT id, name FROM departments');
  const getDeptId = (name: string) => deptRows.find(d => d.name.toLowerCase().includes(name.toLowerCase()))?.id || deptRows[0]?.id;
  const deptEngId = getDeptId('Engineering') || 'dept-9c4c7c58-3fa4-4ebd-bd21-4685d3cacd0d';
  const deptHrId = getDeptId('Human Resources') || 'dept-f39c4c30-9fc4-4c12-86e4-9eef4082c288';
  const deptFinId = getDeptId('Finance') || 'dept-cf1f74f0-1f01-4ba9-8b00-40faa29f94f1';

  const testAccounts = [
    {
      userId: 'usr-super-admin-001',
      email: 'admin@erp.local',
      firstName: 'Super',
      lastName: 'Administrator',
      roleId: 'role-super-admin',
      roleName: 'super_admin',
      employeeId: 'emp-super-admin-001',
      employeeCode: 'EMP-0001',
      designation: 'Executive Director',
      deptId: deptEngId,
      salary: 180000.00,
    },
    {
      userId: 'usr-admin-002',
      email: 'executive.admin@erp.local',
      firstName: 'Operations',
      lastName: 'Director',
      roleId: 'role-admin',
      roleName: 'admin',
      employeeId: 'emp-admin-002',
      employeeCode: 'EMP-0002',
      designation: 'Operations Director',
      deptId: deptEngId,
      salary: 150000.00,
    },
    {
      userId: 'usr-hr-003',
      email: 'hr.manager@erp.local',
      firstName: 'Priya',
      lastName: 'Sharma',
      roleId: 'role-hr-manager',
      roleName: 'hr_manager',
      employeeId: 'emp-hr-003',
      employeeCode: 'EMP-0003',
      designation: 'Head of People & Culture',
      deptId: deptHrId,
      salary: 120000.00,
    },
    {
      userId: 'usr-finance-004',
      email: 'finance.manager@erp.local',
      firstName: 'Rajesh',
      lastName: 'Verma',
      roleId: 'role-finance-manager',
      roleName: 'finance_manager',
      employeeId: 'emp-finance-004',
      employeeCode: 'EMP-0004',
      designation: 'VP Finance & Accounts',
      deptId: deptFinId,
      salary: 130000.00,
    },
    {
      userId: 'usr-pm-005',
      email: 'pm.lead@erp.local',
      firstName: 'Karthik',
      lastName: 'Subramanian',
      roleId: 'role-project-manager',
      roleName: 'project_manager',
      employeeId: 'emp-pm-005',
      employeeCode: 'EMP-0005',
      designation: 'Senior Technical Delivery Manager',
      deptId: deptEngId,
      salary: 110000.00,
    },
    {
      userId: 'usr-lead-006',
      email: 'team.lead@erp.local',
      firstName: 'Ananya',
      lastName: 'Iyer',
      roleId: 'role-team-lead',
      roleName: 'team_lead',
      employeeId: 'emp-lead-006',
      employeeCode: 'EMP-0006',
      designation: 'Engineering Team Lead',
      deptId: deptEngId,
      salary: 95000.00,
    },
    {
      userId: 'usr-emp-007',
      email: 'developer.employee@erp.local',
      firstName: 'Siddharth',
      lastName: 'Patel',
      roleId: 'role-employee',
      roleName: 'employee',
      employeeId: 'emp-emp-007',
      employeeCode: 'EMP-0007',
      designation: 'Full Stack Software Engineer',
      deptId: deptEngId,
      salary: 75000.00,
      reportingManagerId: 'emp-pm-005', // Reporting line pair
    },
  ];

  for (const acc of testAccounts) {
    // Upsert User
    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, email_verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 1, NOW())
       ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name), role_id = VALUES(role_id), password_hash = VALUES(password_hash)`,
      [acc.userId, acc.email, passwordHash, acc.firstName, acc.lastName, acc.roleId]
    );

    // Upsert Employee
    await query(
      `INSERT INTO employees (
        id, user_id, employee_id, first_name, last_name, email, department_id,
        designation, role_id, joining_date, employment_type, employment_status,
        basic_salary, reporting_manager_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-01-01', 'full_time', 'active', ?, ?, NOW())
      ON DUPLICATE KEY UPDATE basic_salary = VALUES(basic_salary), reporting_manager_id = VALUES(reporting_manager_id), department_id = VALUES(department_id)`,
      [
        acc.employeeId, acc.userId, acc.employeeCode, acc.firstName, acc.lastName, acc.email,
        acc.deptId, acc.designation, acc.roleId, acc.salary, acc.reportingManagerId || null
      ]
    );
  }

  // Client User & Profile
  const clientId = 'client-acme-corp-001';
  const clientUserId = 'usr-client-008';
  const clientEmail = 'client.contact@acmecorp.test';

  await query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, email_verified, created_at)
     VALUES (?, ?, ?, 'Acme', 'Representative', 'role-client', 'active', 1, NOW())
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [clientUserId, clientEmail, passwordHash]
  );

  await query(
    `INSERT INTO clients (
      id, client_code, company_name, contact_person, email, phone, website,
      status, user_id, created_at
    ) VALUES (?, 'CLI-ACME-001', 'Acme Global Enterprises', 'John Acme', ?, '+1 800 555 0199', 'https://acmeglobal.test', 'active', ?, NOW())
    ON DUPLICATE KEY UPDATE company_name = VALUES(company_name)`,
    [clientId, clientEmail, clientUserId]
  );

  // Client Project & Invoice
  const projectId = 'proj-acme-portal-001';
  await query(
    `INSERT INTO projects (
      id, project_code, name, client_id, description, project_manager_id,
      start_date, end_date, budget, status, priority, created_at
    ) VALUES (?, 'PRJ-ACME-001', 'Acme Enterprise Portal System', ?, 'Custom web portal and cloud architecture', 'emp-pm-005', '2026-01-15', '2026-12-31', 2500000.00, 'active', 'high', NOW())
    ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [projectId, clientId]
  );

  const invoiceId = 'inv-acme-001';
  await query(
    `INSERT INTO invoices (
      id, invoice_number, client_id, project_id, invoice_date, due_date,
      subtotal, tax_amount, grand_total, paid_amount, remaining_balance, status, created_at
    ) VALUES (?, 'INV-2026-001', ?, ?, '2026-09-01', '2026-10-01', 500000.00, 90000.00, 590000.00, 200000.00, 390000.00, 'partially_paid', NOW())
    ON DUPLICATE KEY UPDATE grand_total = VALUES(grand_total)`,
    [invoiceId, clientId, projectId]
  );

  // 5. Seed Company Settings Defaults
  const settingsRows = await query<any[]>('SELECT id FROM company_settings LIMIT 1');
  if (settingsRows.length === 0) {
    await query(
      `INSERT INTO company_settings (
        id, company_name, company_email, phone, website, address, city, state, country, postal_code,
        currency, currency_symbol, timezone, working_days_per_week, standard_hours_per_day, payroll_pay_date
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )`,
      [
        'company-settings-001',
        'Enterprise Technologies Corp',
        'contact@enterprisecorp.local',
        '+1 (555) 019-2834',
        'https://enterprisecorp.local',
        '100 Innovation Boulevard, Suite 500',
        'San Francisco',
        'California',
        'United States',
        '94107',
        'USD',
        '$',
        'America/Los_Angeles',
        5,
        8.00,
        1
      ]
    );
  }

  // 6. Seed Default Leave Types
  const leaveTypes = [
    { id: 'leave-casual', name: 'Casual Leave', days_allowed_per_year: 12.0, is_paid: true, requires_attachment: false, description: 'Standard paid personal and casual leave days' },
    { id: 'leave-sick', name: 'Sick Leave', days_allowed_per_year: 10.0, is_paid: true, requires_attachment: true, description: 'Medical and health related leaves' },
    { id: 'leave-annual', name: 'Annual / Privilege Leave', days_allowed_per_year: 15.0, is_paid: true, requires_attachment: false, description: 'Planned annual vacation leave allowance' },
    { id: 'leave-unpaid', name: 'Loss of Pay (Unpaid)', days_allowed_per_year: 30.0, is_paid: false, requires_attachment: false, description: 'Unpaid leaves deducting from monthly salary' },
    { id: 'leave-maternity', name: 'Maternity / Paternity Leave', days_allowed_per_year: 90.0, is_paid: true, requires_attachment: true, description: 'Parental leave benefits' },
  ];
  for (const lt of leaveTypes) {
    await query(
      `INSERT INTO leave_types (id, name, days_allowed_per_year, is_paid, requires_attachment, description)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE days_allowed_per_year = VALUES(days_allowed_per_year), description = VALUES(description)`,
      [lt.id, lt.name, lt.days_allowed_per_year, lt.is_paid, lt.requires_attachment, lt.description]
    );
  }

  // 7. Seed Default Salary Components
  const salaryComponents = [
    { id: 'sal-basic', name: 'Basic Salary', type: 'earning', calculation_type: 'fixed', default_value: 0, is_taxable: true, is_statutory: true, description: 'Base salary component' },
    { id: 'sal-hra', name: 'House Rent Allowance (HRA)', type: 'earning', calculation_type: 'percentage', percentage_of: 'basic', default_value: 40, is_taxable: true, is_statutory: false, description: 'HRA allowance calculation' },
    { id: 'sal-special', name: 'Special Allowance', type: 'earning', calculation_type: 'fixed', default_value: 0, is_taxable: true, is_statutory: false, description: 'Flexible organizational allowance' },
    { id: 'sal-medical', name: 'Medical Allowance', type: 'earning', calculation_type: 'fixed', default_value: 0, is_taxable: false, is_statutory: false, description: 'Medical assistance allowance' },
    { id: 'sal-conveyance', name: 'Conveyance Allowance', type: 'earning', calculation_type: 'fixed', default_value: 0, is_taxable: false, is_statutory: false, description: 'Travel and transport allowance' },
    { id: 'sal-pf', name: 'Provident Fund (PF)', type: 'deduction', calculation_type: 'percentage', percentage_of: 'basic', default_value: 12, is_taxable: false, is_statutory: true, description: 'Employee provident fund statutory deduction' },
    { id: 'sal-esi', name: 'Employee State Insurance (ESI)', type: 'deduction', calculation_type: 'percentage', percentage_of: 'gross', default_value: 0.75, is_taxable: false, is_statutory: true, description: 'State health insurance deduction' },
    { id: 'sal-pt', name: 'Professional Tax (PT)', type: 'deduction', calculation_type: 'fixed', default_value: 200, is_taxable: false, is_statutory: true, description: 'State professional tax deduction' },
    { id: 'sal-tds', name: 'Tax Deducted at Source (TDS)', type: 'deduction', calculation_type: 'fixed', default_value: 0, is_taxable: false, is_statutory: true, description: 'Monthly income tax withholding' },
  ];
  for (const sc of salaryComponents) {
    await query(
      `INSERT INTO salary_components (id, name, type, calculation_type, percentage_of, default_value, is_taxable, is_statutory, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [sc.id, sc.name, sc.type, sc.calculation_type, sc.percentage_of, sc.default_value, sc.is_taxable, sc.is_statutory, sc.description]
    );
  }

  // 8. Seed Default Expense Categories
  const expenseCategories = [
    { id: 'exp-cat-rent', name: 'Office Rent & Facilities', description: 'Lease, maintenance, and facility overhead' },
    { id: 'exp-cat-software', name: 'Software, SaaS & Subscriptions', description: 'Cloud infrastructure, dev tools, and enterprise licenses' },
    { id: 'exp-cat-hardware', name: 'Hardware & IT Equipment', description: 'Workstations, laptops, monitors, and servers' },
    { id: 'exp-cat-utilities', name: 'Utilities & High-Speed Internet', description: 'Electricity, water, high-speed fiber internet' },
    { id: 'exp-cat-travel', name: 'Travel & Client Meetings', description: 'Business flights, hotels, and transportation' },
    { id: 'exp-cat-marketing', name: 'Marketing, Ads & Sales', description: 'Digital advertising, conferences, and marketing collateral' },
    { id: 'exp-cat-legal', name: 'Legal & Professional Services', description: 'Auditing, legal counsel, and consulting' },
    { id: 'exp-cat-office', name: 'Office Supplies & Refreshments', description: 'Stationery, pantry, snacks, and team perks' },
    { id: 'exp-cat-misc', name: 'Miscellaneous Expenses', description: 'General organizational expenses' },
  ];
  for (const ec of expenseCategories) {
    await query(
      `INSERT INTO expense_categories (id, name, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [ec.id, ec.name, ec.description]
    );
  }

  // 9. Seed Default Holidays
  const currentYear = new Date().getFullYear();
  const holidays = [
    { id: 'hol-1', name: "New Year's Day", date: `${currentYear}-01-01`, description: 'First day of the year', is_optional: false },
    { id: 'hol-2', name: 'Labor Day', date: `${currentYear}-05-01`, description: 'International Workers Day', is_optional: false },
    { id: 'hol-3', name: 'Independence Day', date: `${currentYear}-07-04`, description: 'National Independence Day', is_optional: false },
    { id: 'hol-4', name: 'Thanksgiving Day', date: `${currentYear}-11-26`, description: 'Thanksgiving Holiday', is_optional: false },
    { id: 'hol-5', name: 'Christmas Day', date: `${currentYear}-12-25`, description: 'Christmas Celebration', is_optional: false },
  ];
  for (const h of holidays) {
    await query(
      `INSERT INTO holidays (id, name, date, description, is_optional)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [h.id, h.name, h.date, h.description, h.is_optional]
    );
  }

  logger.info('System configuration seeding completed successfully.');
}

if (require.main === module) {
  seedSystem()
    .then(() => {
      logger.info('Seed script finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Seed failed:', err);
      process.exit(1);
    });
}
