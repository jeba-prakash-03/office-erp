import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../config/db';
import { logger } from '../utils/logger';
import { PERMISSIONS, ROLE_DEFINITIONS } from '../config/permissions';

/**
 * PRODUCTION SYSTEM INITIALIZATION SEED
 * 
 * Contains ONLY essential system definitions:
 * - 3 Canonical Roles (Super Admin, Admin, Employee)
 * - Authoritative Permission Registry
 * - Role-Permission mappings
 * - Company Settings (Currency: INR ₹, Timezone: Asia/Kolkata)
 * - Configurable Standard Leave Types
 * - Configurable Standard Salary Components
 * - Core Departments
 * - Initial Super Admin and HR Admin accounts
 * 
 * DOES NOT INSERT ANY DUMMY / FAKE BUSINESS DATA
 * (0 employees, 0 attendance records, 0 leave requests, 0 payroll runs, 0 projects, 0 tasks, 0 finances, 0 clients).
 */
export async function seedSystem() {
  logger.info('Starting clean system configuration initialization for OfficeERP...');

  // 1. Seed Roles (Only 3 Canonical Roles: super_admin, admin, employee)
  const roles = [
    { id: 'role-super-admin', name: 'super_admin', display_name: 'Super Admin', description: 'Complete system authority, security configuration, and Super Admin-only Investments' },
    { id: 'role-admin', name: 'admin', display_name: 'Admin', description: 'Operational administration of People, Work, CRM, and Finance' },
    { id: 'role-employee', name: 'employee', display_name: 'Employee', description: 'Employee self-service portal for personal work, attendance, leave, and salary' },
  ];

  for (const r of roles) {
    await query(
      `INSERT INTO roles (id, name, display_name, description, is_system)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description)`,
      [r.id, r.name, r.display_name, r.description]
    );
  }

  // 2. Seed Permissions
  for (const permName of Object.values(PERMISSIONS)) {
    const permId = `perm-${permName.replace(/\./g, '-')}`;
    const moduleName = permName.split('.')[0];
    const desc = `Permission to perform ${permName}`;

    await query(
      `INSERT INTO permissions (id, name, module, description)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE module = VALUES(module), description = VALUES(description)`,
      [permId, permName, moduleName, desc]
    );
  }

  // 3. Bind Role Permissions
  for (const [roleName, roleDef] of Object.entries(ROLE_DEFINITIONS)) {
    const roleRows = await query<any[]>('SELECT id FROM roles WHERE name = ?', [roleName]);
    if (roleRows.length === 0) continue;
    const roleId = roleRows[0].id;

    for (const permName of roleDef.permissions) {
      const permRows = await query<any[]>('SELECT id FROM permissions WHERE name = ?', [permName]);
      if (permRows.length > 0) {
        await query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [roleId, permRows[0].id]
        );
      }
    }
  }

  // 4. Company Settings (Default Currency: INR ₹, Timezone: Asia/Kolkata)
  await query(
    `INSERT INTO company_settings (
      id, company_name, company_email, phone, website, address, city, state, country, postal_code,
      currency, currency_symbol, timezone, working_days_per_week, standard_hours_per_day, payroll_pay_date
    ) VALUES (
      'company-default', 'OfficeERP Corporation Pvt Ltd', 'contact@officeerp.local', '+91 80 4123 4567', 'https://officeerp.local',
      'Corporate Tower, Technology Hub', 'Bengaluru', 'Karnataka', 'India', '560100',
      'INR', '₹', 'Asia/Kolkata', 5, 8.00, 1
    ) ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), currency = VALUES(currency), currency_symbol = VALUES(currency_symbol), timezone = VALUES(timezone)`
  );

  // 5. Configurable Leave Types
  const standardLeaveTypes = [
    { name: 'Privilege / Annual Leave', days: 18.0, isPaid: true, desc: 'Planned vacation and annual recreational leave' },
    { name: 'Casual Leave', days: 12.0, isPaid: true, desc: 'Short personal and emergency leave' },
    { name: 'Sick Leave', days: 10.0, isPaid: true, desc: 'Medical and health-related leave' },
    { name: 'Loss of Pay (LOP)', days: 30.0, isPaid: false, desc: 'Unpaid personal leaves' },
    { name: 'Maternity Leave', days: 180.0, isPaid: true, desc: 'Statutory maternity leave for new mothers' },
    { name: 'Paternity Leave', days: 15.0, isPaid: true, desc: 'Paternity leave for new fathers' },
  ];

  for (const lt of standardLeaveTypes) {
    const existing = await query<any[]>('SELECT id FROM leave_types WHERE name = ?', [lt.name]);
    if (existing.length === 0) {
      await query(
        `INSERT INTO leave_types (id, name, days_allowed_per_year, is_paid, is_active, description)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [uuidv4(), lt.name, lt.days, lt.isPaid ? 1 : 0, lt.desc]
      );
    }
  }

  // 6. Configurable Salary Components
  const standardSalaryComponents = [
    { name: 'Basic Salary', type: 'earning', calc: 'fixed', val: 35000, tax: true, stat: false, desc: 'Base salary' },
    { name: 'House Rent Allowance (HRA)', type: 'earning', calc: 'percentage', percOf: 'Basic Salary', val: 40, tax: true, stat: false, desc: '40% of Basic Salary' },
    { name: 'Special Allowance', type: 'earning', calc: 'fixed', val: 15000, tax: true, stat: false, desc: 'Special monthly allowance' },
    { name: 'Transport Allowance', type: 'earning', calc: 'fixed', val: 3000, tax: true, stat: false, desc: 'Commute and conveyance' },
    { name: 'Performance Bonus', type: 'earning', calc: 'fixed', val: 5000, tax: true, stat: false, desc: 'Quarterly/Monthly performance incentive' },
    { name: 'Provident Fund (PF)', type: 'deduction', calc: 'percentage', percOf: 'Basic Salary', val: 12, tax: false, stat: true, desc: '12% of Basic Salary' },
    { name: 'Employee State Insurance (ESI)', type: 'deduction', calc: 'percentage', percOf: 'Gross', val: 0.75, tax: false, stat: true, desc: '0.75% of Gross for eligible employees' },
    { name: 'Professional Tax (PT)', type: 'deduction', calc: 'fixed', val: 200, tax: false, stat: true, desc: 'State statutory professional tax' },
    { name: 'Income Tax (TDS)', type: 'deduction', calc: 'fixed', val: 2500, tax: false, stat: true, desc: 'Monthly Tax Deducted at Source' },
  ];

  for (const sc of standardSalaryComponents) {
    const existing = await query<any[]>('SELECT id FROM salary_components WHERE name = ?', [sc.name]);
    if (existing.length === 0) {
      await query(
        `INSERT INTO salary_components (id, name, type, calculation_type, percentage_of, default_value, is_taxable, is_statutory, is_active, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [uuidv4(), sc.name, sc.type, sc.calc, sc.percOf || null, sc.val, sc.tax ? 1 : 0, sc.stat ? 1 : 0, sc.desc]
      );
    }
  }

  // 7. Core Organizational Departments
  const departments = [
    { name: 'Engineering', desc: 'Core software engineering and development' },
    { name: 'Product & Design', desc: 'Product UI/UX design and research' },
    { name: 'Human Resources', desc: 'People operations, talent, and compliance' },
    { name: 'Finance & Accounting', desc: 'Corporate finances, payroll, and billing' },
    { name: 'Sales & Marketing', desc: 'Client acquisition and growth' },
  ];

  for (const d of departments) {
    const existing = await query<any[]>('SELECT id FROM departments WHERE name = ?', [d.name]);
    if (existing.length === 0) {
      await query(
        `INSERT INTO departments (id, name, description, status) VALUES (?, ?, ?, 'active')`,
        [uuidv4(), d.name, d.desc]
      );
    }
  }

  // 8. Administrator Accounts (Super Admin + HR Admin)
  const salt = await bcrypt.genSalt(10);
  const adminPassHash = await bcrypt.hash('Admin@123456', salt);

  // 8a. Super Admin
  await query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, email_verified, phone)
     VALUES ('usr-super-admin', 'admin@erp.local', ?, 'Super', 'Administrator', 'role-super-admin', 'active', 1, '+91 9876543210')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role_id = 'role-super-admin'`,
    [adminPassHash]
  );

  // 8b. HR Admin
  await query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, email_verified, phone)
     VALUES ('usr-admin', 'hr.admin@erp.local', ?, 'HR Operations', 'Admin', 'role-admin', 'active', 1, '+91 9876543211')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role_id = 'role-admin'`,
    [adminPassHash]
  );

  logger.info('Clean system configuration initialization complete! No mock records created.');
}

// Direct CLI execution
if (require.main === module) {
  seedSystem()
    .then(() => {
      console.log('System initialized cleanly.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('System seed failed:', err);
      process.exit(1);
    });
}
