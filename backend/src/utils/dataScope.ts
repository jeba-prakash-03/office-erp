import { AuthenticatedUser } from '../middleware/auth';

export type ResourceType =
  | 'employees'
  | 'tasks'
  | 'projects'
  | 'attendance'
  | 'leave'
  | 'timesheets'
  | 'performance'
  | 'documents'
  | 'assets'
  | 'invoices';

export interface ScopeFilter {
  whereClause: string;
  params: (string | number)[];
}

/**
 * Builds backend SQL scope filtering based on user role and data scope.
 * Supports: all | department | team | own | client-isolation
 */
export function buildDataScopeClause(
  user: AuthenticatedUser,
  resource: ResourceType,
  tableAlias?: string
): ScopeFilter {
  // Super Admin & Admin have global 'all' scope
  if (user.roleName === 'super_admin' || user.roleName === 'admin') {
    return { whereClause: '1=1', params: [] };
  }

  const prefix = tableAlias ? `${tableAlias}.` : '';

  // Client role isolation: only queries where client_id matches the user's client profile
  if (user.roleName === 'client') {
    const clientId = user.clientId || 'unlinked_client';
    if (resource === 'projects' || resource === 'invoices' || resource === 'documents') {
      return { whereClause: `${prefix}client_id = ?`, params: [clientId] };
    }
    if (resource === 'tasks') {
      return {
        whereClause: `(${prefix}client_id = ? OR ${prefix}project_id IN (SELECT id FROM projects WHERE client_id = ?))`,
        params: [clientId, clientId],
      };
    }
    return { whereClause: '1=0', params: [] }; // No access to other resources
  }

  const empId = user.employeeId || 'unlinked_employee';
  const deptId = user.departmentId;

  // HR Manager scope
  if (user.roleName === 'hr_manager') {
    if (['employees', 'departments', 'attendance', 'leave', 'performance', 'documents'].includes(resource)) {
      return { whereClause: '1=1', params: [] };
    }
  }

  // Finance Manager & Accountant scope
  if (user.roleName === 'finance_manager' || user.roleName === 'accountant') {
    if (['invoices', 'payments', 'expenses', 'incomes', 'payroll', 'documents'].includes(resource)) {
      return { whereClause: '1=1', params: [] };
    }
  }

  // Project Manager scope: department or projects they manage
  if (user.roleName === 'project_manager') {
    if (resource === 'projects') {
      return {
        whereClause: `(${prefix}project_manager_id = ? OR ${prefix}id IN (SELECT project_id FROM project_members WHERE employee_id = ?))`,
        params: [empId, empId],
      };
    }
    if (resource === 'tasks') {
      return {
        whereClause: `(${prefix}assigned_employee_id = ? OR ${prefix}project_id IN (SELECT id FROM projects WHERE project_manager_id = ?))`,
        params: [empId, empId],
      };
    }
    if (resource === 'timesheets') {
      return {
        whereClause: `(${prefix}employee_id = ? OR ${prefix}project_id IN (SELECT id FROM projects WHERE project_manager_id = ?))`,
        params: [empId, empId],
      };
    }
    if (resource === 'employees' && deptId) {
      return { whereClause: `${prefix}department_id = ?`, params: [deptId] };
    }
    if (resource === 'attendance' || resource === 'leave') {
      return {
        whereClause: `(${prefix}employee_id = ? OR ${prefix}employee_id IN (SELECT id FROM employees WHERE reporting_manager_id = ?))`,
        params: [empId, empId],
      };
    }
  }

  // Team Lead scope: their team/subordinates or own
  if (user.roleName === 'team_lead') {
    if (resource === 'tasks') {
      return {
        whereClause: `(${prefix}assigned_employee_id = ? OR ${prefix}assigned_employee_id IN (SELECT id FROM employees WHERE reporting_manager_id = ?))`,
        params: [empId, empId],
      };
    }
    if (resource === 'attendance' || resource === 'leave' || resource === 'timesheets') {
      return {
        whereClause: `(${prefix}employee_id = ? OR ${prefix}employee_id IN (SELECT id FROM employees WHERE reporting_manager_id = ?))`,
        params: [empId, empId],
      };
    }
    if (resource === 'employees') {
      return {
        whereClause: `(${prefix}id = ? OR ${prefix}reporting_manager_id = ?)`,
        params: [empId, empId],
      };
    }
  }

  // Standard Employee scope: 'own' only
  if (resource === 'employees') {
    // Basic employee directory allows viewing colleagues, sensitive actions guarded at controller
    return { whereClause: '1=1', params: [] };
  }
  if (resource === 'tasks') {
    return { whereClause: `${prefix}assigned_employee_id = ?`, params: [empId] };
  }
  if (resource === 'attendance' || resource === 'leave' || resource === 'timesheets' || resource === 'performance') {
    return { whereClause: `${prefix}employee_id = ?`, params: [empId] };
  }
  if (resource === 'projects') {
    return {
      whereClause: `${prefix}id IN (SELECT project_id FROM project_members WHERE employee_id = ?)`,
      params: [empId],
    };
  }

  return { whereClause: '1=1', params: [] };
}
