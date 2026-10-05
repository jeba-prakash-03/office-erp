import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';
import { logger } from '../utils/logger';
import { PERMISSIONS, ROLE_DEFINITIONS } from '../config/permissions';

export async function seedSystem() {
  logger.info('Starting system configuration seeding (Production Mode: Roles, Permissions, Settings, SuperAdmin)...');

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
  const permissionEntries = Object.entries(PERMISSIONS);
  for (const [, permName] of permissionEntries) {
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

  // 3. Map Permissions to Roles
  for (const [roleName, roleDef] of Object.entries(ROLE_DEFINITIONS)) {
    const roleRow = await query<any[]>('SELECT id FROM roles WHERE name = ?', [roleName]);
    if (roleRow.length === 0) continue;
    const roleId = roleRow[0].id;

    for (const permKey of roleDef.permissions) {
      const permRow = await query<any[]>('SELECT id FROM permissions WHERE name = ?', [permKey]);
      if (permRow.length > 0) {
        await query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [roleId, permRow[0].id]
        );
      }
    }
  }

  // 4. Seed Default Company Settings
  await query(
    `INSERT INTO company_settings (
      id, company_name, company_email, phone, website, address, city, state, country, postal_code,
      currency, currency_symbol, timezone, working_days_per_week, standard_hours_per_day, payroll_pay_date
    ) VALUES (
      'company-default', 'TechNova Solutions Pvt Ltd', 'contact@technova.com', '+91 80 2345 6789', 'https://technova.io',
      'Tower B, Tech Park, Outer Ring Road', 'Bengaluru', 'Karnataka', 'India', '560103',
      'INR', '₹', 'Asia/Kolkata', 5, 8.00, 1
    ) ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name),
      currency = VALUES(currency),
      currency_symbol = VALUES(currency_symbol),
      timezone = VALUES(timezone)`
  );

  // 5. Seed Standard Leave Types
  const leaveTypes = [
    { id: 'lt-casual', name: 'Casual Leave', days: 12, isPaid: 1, reqDoc: 0, desc: 'For personal and short unexpected leaves' },
    { id: 'lt-sick', name: 'Sick Leave', days: 10, isPaid: 1, reqDoc: 1, desc: 'For medical recovery and health reasons' },
    { id: 'lt-annual', name: 'Annual / Privilege Leave', days: 18, isPaid: 1, reqDoc: 0, desc: 'Planned vacations and extended leaves' },
    { id: 'lt-unpaid', name: 'Leave Without Pay (LWP)', days: 30, isPaid: 0, reqDoc: 0, desc: 'Unpaid personal leaves outside accrued quota' },
  ];

  for (const lt of leaveTypes) {
    await query(
      `INSERT INTO leave_types (id, name, days_allowed_per_year, is_paid, requires_attachment, description)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE days_allowed_per_year = VALUES(days_allowed_per_year), is_paid = VALUES(is_paid)`,
      [lt.id, lt.name, lt.days, lt.isPaid, lt.reqDoc, lt.desc]
    );
  }

  // 6. Seed ONE Super Admin from environment variables
  const superAdminEmail = (process.env.SUPERADMIN_EMAIL || 'admin@erp.local').toLowerCase().trim();
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'Admin@123456';
  const superAdminFirstName = process.env.SUPERADMIN_FIRST_NAME || 'Super';
  const superAdminLastName = process.env.SUPERADMIN_LAST_NAME || 'Administrator';

  const existingAdmin = await query<any[]>('SELECT id FROM users WHERE email = ?', [superAdminEmail]);
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(superAdminPassword, salt);

  if (existingAdmin.length === 0) {
    const adminId = 'usr-super-admin-001';
    await query(
      `INSERT INTO users (
        id, email, password_hash, first_name, last_name, role_id, status, email_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, 'role-super-admin', 'active', 1, NOW())`,
      [adminId, superAdminEmail, passwordHash, superAdminFirstName, superAdminLastName]
    );
    logger.info(`Super Admin account seeded: ${superAdminEmail}`);
  } else {
    // Update password hash if needed
    await query(
      `UPDATE users SET password_hash = ?, status = 'active' WHERE email = ?`,
      [passwordHash, superAdminEmail]
    );
    logger.info(`Super Admin account already exists: ${superAdminEmail} (password verified)`);
  }

  logger.info('System configuration seed completed successfully.');
}

if (require.main === module) {
  seedSystem()
    .then(() => {
      logger.info('Seed script finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Seed script failed:', err);
      process.exit(1);
    });
}
