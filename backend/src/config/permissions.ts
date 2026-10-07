/**
 * Canonical RBAC Permission Matrix & Scope Definitions for OfficeERP
 * Authoritative 3-Role System: super_admin, admin, employee
 */

export type RoleName = 'super_admin' | 'admin' | 'employee';

export const PERMISSIONS = {
  // Users & Roles
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',

  // Employees & HR
  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_EDIT: 'employees.edit',
  EMPLOYEES_DELETE: 'employees.delete',

  // Departments
  DEPARTMENTS_VIEW: 'departments.view',
  DEPARTMENTS_MANAGE: 'departments.manage',

  // Attendance (Spreadsheet Matrix)
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',
  ATTENDANCE_LOCK: 'attendance.lock',

  // Leave
  LEAVE_VIEW: 'leave.view',
  LEAVE_APPLY: 'leave.apply',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_MANAGE: 'leave.manage',

  // Payroll & Salary
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_VIEW_OWN: 'payroll.view_own',
  PAYROLL_MANAGE: 'payroll.manage',
  PAYROLL_FINALIZE: 'payroll.finalize',

  // Finance & Invoicing
  FINANCE_VIEW: 'finance.view',
  FINANCE_MANAGE: 'finance.manage',
  INVOICES_MANAGE: 'invoices.manage',
  PAYMENTS_MANAGE: 'payments.manage',

  // Investments (SUPER ADMIN ONLY)
  INVESTMENTS_VIEW: 'investments.view',
  INVESTMENTS_MANAGE: 'investments.manage',

  // CRM & Leads
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_MANAGE: 'clients.manage',
  LEADS_VIEW: 'leads.view',
  LEADS_MANAGE: 'leads.manage',

  // Projects & Tasks & Timesheets
  PROJECTS_VIEW: 'projects.view',
  PROJECTS_MANAGE: 'projects.manage',
  TASKS_VIEW: 'tasks.view',
  TASKS_MANAGE: 'tasks.manage',
  TASKS_UPDATE_STATUS: 'tasks.update_status',
  TIMESHEETS_LOG: 'timesheets.log',
  TIMESHEETS_VIEW: 'timesheets.view',
  TIMESHEETS_MANAGE: 'timesheets.manage',

  // Performance
  PERFORMANCE_VIEW: 'performance.view',
  PERFORMANCE_MANAGE: 'performance.manage',

  // Documents
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_MANAGE: 'documents.manage',

  // Reports
  REPORTS_VIEW: 'reports.view',

  // Administration & Audit
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export interface RoleConfig {
  id: string;
  name: RoleName;
  displayName: string;
  description: string;
  permissions: PermissionKey[];
}

export const ROLE_DEFINITIONS: Record<RoleName, RoleConfig> = {
  super_admin: {
    id: 'role-super-admin',
    name: 'super_admin',
    displayName: 'Super Admin',
    description: 'Complete system authority, including Super Admin-only Investments and System Administration',
    permissions: Object.values(PERMISSIONS),
  },
  admin: {
    id: 'role-admin',
    name: 'admin',
    displayName: 'Admin',
    description: 'Operational enterprise administrator managing People, Work, CRM, and Finance (excluding Investments)',
    permissions: [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.EMPLOYEES_VIEW, PERMISSIONS.EMPLOYEES_CREATE, PERMISSIONS.EMPLOYEES_EDIT, PERMISSIONS.EMPLOYEES_DELETE,
      PERMISSIONS.DEPARTMENTS_VIEW, PERMISSIONS.DEPARTMENTS_MANAGE,
      PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_MANAGE, PERMISSIONS.ATTENDANCE_LOCK,
      PERMISSIONS.LEAVE_VIEW, PERMISSIONS.LEAVE_APPLY, PERMISSIONS.LEAVE_APPROVE, PERMISSIONS.LEAVE_MANAGE,
      PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_MANAGE, PERMISSIONS.PAYROLL_FINALIZE,
      PERMISSIONS.FINANCE_VIEW, PERMISSIONS.FINANCE_MANAGE, PERMISSIONS.INVOICES_MANAGE, PERMISSIONS.PAYMENTS_MANAGE,
      PERMISSIONS.CLIENTS_VIEW, PERMISSIONS.CLIENTS_MANAGE,
      PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_MANAGE,
      PERMISSIONS.PROJECTS_VIEW, PERMISSIONS.PROJECTS_MANAGE,
      PERMISSIONS.TASKS_VIEW, PERMISSIONS.TASKS_MANAGE, PERMISSIONS.TASKS_UPDATE_STATUS,
      PERMISSIONS.TIMESHEETS_LOG, PERMISSIONS.TIMESHEETS_VIEW, PERMISSIONS.TIMESHEETS_MANAGE,
      PERMISSIONS.PERFORMANCE_VIEW, PERMISSIONS.PERFORMANCE_MANAGE,
      PERMISSIONS.DOCUMENTS_VIEW, PERMISSIONS.DOCUMENTS_MANAGE,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.SETTINGS_VIEW,
    ],
  },
  employee: {
    id: 'role-employee',
    name: 'employee',
    displayName: 'Employee',
    description: 'Self-service portal for personal attendance, leaves, salary/payslips, assigned projects, tasks, and performance',
    permissions: [
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.LEAVE_VIEW, PERMISSIONS.LEAVE_APPLY,
      PERMISSIONS.PAYROLL_VIEW_OWN,
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.TASKS_VIEW, PERMISSIONS.TASKS_UPDATE_STATUS,
      PERMISSIONS.TIMESHEETS_LOG,
      PERMISSIONS.PERFORMANCE_VIEW,
      PERMISSIONS.DOCUMENTS_VIEW,
    ],
  },
};
