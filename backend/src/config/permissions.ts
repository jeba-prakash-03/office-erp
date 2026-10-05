/**
 * Canonical RBAC Permission Matrix & Scope Definitions
 * Single source of truth for backend middleware and frontend navigation
 */

export type RoleName = 
  | 'super_admin'
  | 'admin'
  | 'hr_manager'
  | 'finance_manager'
  | 'project_manager'
  | 'team_lead'
  | 'employee'
  | 'accountant'
  | 'sales_bd'
  | 'client';

export type PermissionScope = 'all' | 'department' | 'team' | 'own';

export interface PermissionDefinition {
  id: string;
  name: string;
  module: string;
  description: string;
}

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

  // Clients & CRM
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_EDIT: 'clients.edit',
  CLIENTS_DELETE: 'clients.delete',
  LEADS_VIEW: 'leads.view',
  LEADS_MANAGE: 'leads.manage',

  // Projects & Tasks
  PROJECTS_VIEW: 'projects.view',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_EDIT: 'projects.edit',
  PROJECTS_DELETE: 'projects.delete',
  TASKS_VIEW: 'tasks.view',
  TASKS_CREATE: 'tasks.create',
  TASKS_ASSIGN: 'tasks.assign',
  TASKS_UPDATE: 'tasks.update',
  TASKS_DELETE: 'tasks.delete',

  // Attendance
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',
  ATTENDANCE_APPROVE: 'attendance.approve',

  // Leave
  LEAVE_VIEW: 'leave.view',
  LEAVE_APPLY: 'leave.apply',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_MANAGE: 'leave.manage',

  // Payroll
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_CREATE: 'payroll.create',
  PAYROLL_APPROVE: 'payroll.approve',
  PAYROLL_MANAGE: 'payroll.manage',

  // Finance & Invoices
  FINANCE_VIEW: 'finance.view',
  FINANCE_CREATE: 'finance.create',
  FINANCE_EDIT: 'finance.edit',
  FINANCE_DELETE: 'finance.delete',
  INVOICES_MANAGE: 'invoices.manage',
  PAYMENTS_MANAGE: 'payments.manage',

  // Timesheets
  TIMESHEETS_LOG: 'timesheets.log',
  TIMESHEETS_APPROVE: 'timesheets.approve',

  // Performance
  PERFORMANCE_VIEW: 'performance.view',
  PERFORMANCE_MANAGE: 'performance.manage',

  // Operations
  ASSETS_VIEW: 'assets.view',
  ASSETS_MANAGE: 'assets.manage',
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_MANAGE: 'documents.manage',
  ANNOUNCEMENTS_VIEW: 'announcements.view',
  ANNOUNCEMENTS_MANAGE: 'announcements.manage',
  MEETINGS_VIEW: 'meetings.view',
  MEETINGS_MANAGE: 'meetings.manage',

  // System & Reports
  REPORTS_VIEW: 'reports.view',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit_logs.view',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export interface RoleConfig {
  id: string;
  name: RoleName;
  displayName: string;
  description: string;
  defaultScope: PermissionScope;
  permissions: PermissionKey[];
}

export const ROLE_DEFINITIONS: Record<RoleName, RoleConfig> = {
  super_admin: {
    id: 'role-super-admin',
    name: 'super_admin',
    displayName: 'Super Admin',
    description: 'System owner with global access to all features and company configurations',
    defaultScope: 'all',
    permissions: Object.values(PERMISSIONS),
  },
  admin: {
    id: 'role-admin',
    name: 'admin',
    displayName: 'Admin',
    description: 'Executive management with full administrative authority',
    defaultScope: 'all',
    permissions: Object.values(PERMISSIONS),
  },
  hr_manager: {
    id: 'role-hr-manager',
    name: 'hr_manager',
    displayName: 'HR Manager',
    description: 'Full management of human resources, recruitment, attendance, leave, and payroll inputs',
    defaultScope: 'all',
    permissions: [
      PERMISSIONS.EMPLOYEES_VIEW, PERMISSIONS.EMPLOYEES_CREATE, PERMISSIONS.EMPLOYEES_EDIT, PERMISSIONS.EMPLOYEES_DELETE,
      PERMISSIONS.DEPARTMENTS_VIEW, PERMISSIONS.DEPARTMENTS_MANAGE,
      PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_MANAGE, PERMISSIONS.ATTENDANCE_APPROVE,
      PERMISSIONS.LEAVE_VIEW, PERMISSIONS.LEAVE_APPLY, PERMISSIONS.LEAVE_APPROVE, PERMISSIONS.LEAVE_MANAGE,
      PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_CREATE, PERMISSIONS.PAYROLL_MANAGE,
      PERMISSIONS.PERFORMANCE_VIEW, PERMISSIONS.PERFORMANCE_MANAGE,
      PERMISSIONS.ANNOUNCEMENTS_VIEW, PERMISSIONS.ANNOUNCEMENTS_MANAGE,
      PERMISSIONS.DOCUMENTS_VIEW, PERMISSIONS.DOCUMENTS_MANAGE,
      PERMISSIONS.MEETINGS_VIEW, PERMISSIONS.MEETINGS_MANAGE,
      PERMISSIONS.REPORTS_VIEW,
    ],
  },
  finance_manager: {
    id: 'role-finance-manager',
    name: 'finance_manager',
    displayName: 'Finance Manager',
    description: 'Management of company finances, client invoices, incoming payments, and payroll approval',
    defaultScope: 'all',
    permissions: [
      PERMISSIONS.FINANCE_VIEW, PERMISSIONS.FINANCE_CREATE, PERMISSIONS.FINANCE_EDIT, PERMISSIONS.FINANCE_DELETE,
      PERMISSIONS.INVOICES_MANAGE, PERMISSIONS.PAYMENTS_MANAGE,
      PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_APPROVE,
      PERMISSIONS.CLIENTS_VIEW,
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.ANNOUNCEMENTS_VIEW,
    ],
  },
  project_manager: {
    id: 'role-project-manager',
    name: 'project_manager',
    displayName: 'Project Manager',
    description: 'Delivery head managing projects, milestones, tasks, and timesheet approvals',
    defaultScope: 'department',
    permissions: [
      PERMISSIONS.PROJECTS_VIEW, PERMISSIONS.PROJECTS_CREATE, PERMISSIONS.PROJECTS_EDIT,
      PERMISSIONS.TASKS_VIEW, PERMISSIONS.TASKS_CREATE, PERMISSIONS.TASKS_ASSIGN, PERMISSIONS.TASKS_UPDATE,
      PERMISSIONS.TIMESHEETS_LOG, PERMISSIONS.TIMESHEETS_APPROVE,
      PERMISSIONS.CLIENTS_VIEW,
      PERMISSIONS.EMPLOYEES_VIEW,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.ANNOUNCEMENTS_VIEW,
      PERMISSIONS.MEETINGS_VIEW, PERMISSIONS.MEETINGS_MANAGE,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.LEAVE_APPLY, PERMISSIONS.LEAVE_VIEW,
    ],
  },
  team_lead: {
    id: 'role-team-lead',
    name: 'team_lead',
    displayName: 'Team Lead',
    description: 'Leads sprint execution, assigns tasks, and reviews team timesheets',
    defaultScope: 'team',
    permissions: [
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.TASKS_VIEW, PERMISSIONS.TASKS_CREATE, PERMISSIONS.TASKS_ASSIGN, PERMISSIONS.TASKS_UPDATE,
      PERMISSIONS.TIMESHEETS_LOG, PERMISSIONS.TIMESHEETS_APPROVE,
      PERMISSIONS.EMPLOYEES_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.LEAVE_APPLY, PERMISSIONS.LEAVE_VIEW,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.ANNOUNCEMENTS_VIEW,
      PERMISSIONS.MEETINGS_VIEW,
    ],
  },
  employee: {
    id: 'role-employee',
    name: 'employee',
    displayName: 'Employee',
    description: 'Standard team member access to personal self-service, assigned tasks, and company announcements',
    defaultScope: 'own',
    permissions: [
      PERMISSIONS.TASKS_VIEW, PERMISSIONS.TASKS_UPDATE,
      PERMISSIONS.TIMESHEETS_LOG,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.LEAVE_APPLY, PERMISSIONS.LEAVE_VIEW,
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.PERFORMANCE_VIEW,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.ANNOUNCEMENTS_VIEW,
      PERMISSIONS.MEETINGS_VIEW,
    ],
  },
  accountant: {
    id: 'role-accountant',
    name: 'accountant',
    displayName: 'Accountant',
    description: 'Entry-level financial clerk logging expenses, invoicing, and receipts',
    defaultScope: 'all',
    permissions: [
      PERMISSIONS.FINANCE_VIEW, PERMISSIONS.FINANCE_CREATE,
      PERMISSIONS.INVOICES_MANAGE, PERMISSIONS.PAYMENTS_MANAGE,
      PERMISSIONS.CLIENTS_VIEW,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.ANNOUNCEMENTS_VIEW,
    ],
  },
  sales_bd: {
    id: 'role-sales-bd',
    name: 'sales_bd',
    displayName: 'Sales / Business Development',
    description: 'Leads acquisition, client onboarding, and CRM management',
    defaultScope: 'all',
    permissions: [
      PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_MANAGE,
      PERMISSIONS.CLIENTS_VIEW, PERMISSIONS.CLIENTS_CREATE, PERMISSIONS.CLIENTS_EDIT,
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.MEETINGS_VIEW, PERMISSIONS.MEETINGS_MANAGE,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.ANNOUNCEMENTS_VIEW,
    ],
  },
  client: {
    id: 'role-client',
    name: 'client',
    displayName: 'Client',
    description: 'External client portal access isolated to permitted projects, deliverables, and invoices',
    defaultScope: 'own',
    permissions: [
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.TASKS_VIEW,
      PERMISSIONS.DOCUMENTS_VIEW,
    ],
  },
};
