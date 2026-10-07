import { apiClient } from './client';
import {
  User, Employee, Department, Client, Lead, Project, Task, Attendance,
  TodayAttendanceStatus, LeaveType, LeaveBalance, LeaveApplication,
  Payroll, PayrollItem, PerformanceReview, Timesheet, Income,
  Expense, Invoice, Payment, CompanyDocument, NotificationItem,
  CompanySettings, AuditLog, Investment
} from '../types';

export const authApi = {
  login: (data: any) => apiClient.post('/auth/login', data),
  googleLogin: (data: any) => apiClient.post('/auth/google', data),
  register: (data: any) => apiClient.post('/auth/register-first-admin', data),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get<{ success: boolean; data: User }>('/auth/me'),
  changePassword: (data: any) => apiClient.post('/auth/change-password', data),
  updateProfile: (data: any) => apiClient.put('/users/profile', data),
};

export const usersApi = {
  list: (params?: any) => apiClient.get('/users', { params }),
  getAll: (params?: any) => apiClient.get('/users', { params }),
  getById: (id: string | number) => apiClient.get(`/users/${id}`),
  create: (data: any) => apiClient.post('/users', data),
  update: (id: string | number, data: any) => apiClient.put(`/users/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/users/${id}`),
};

export const rolesApi = {
  list: () => apiClient.get('/roles'),
  getAll: () => apiClient.get('/roles'),
  getById: (roleId: string | number) => apiClient.get(`/roles/${roleId}`),
  create: (data: any) => apiClient.post('/roles', data),
  getPermissions: (roleId?: string | number) =>
    roleId ? apiClient.get(`/roles/${roleId}/permissions`) : apiClient.get('/roles/permissions'),
  listAllPermissions: () => apiClient.get('/roles/permissions'),
  updateRolePermissions: (roleId: string | number, permissionIds: string[]) =>
    apiClient.put(`/roles/${roleId}/permissions`, { permissionIds }),
  assignPermissions: (roleId: string | number, data: any) =>
    apiClient.put(`/roles/${roleId}/permissions`, data),
};

export const companyApi = {
  getSettings: () => apiClient.get<{ success: boolean; data: CompanySettings }>('/company'),
  updateSettings: (data: any) => apiClient.put('/company', data),
};

export const employeesApi = {
  list: (params?: any) => apiClient.get('/employees', { params }),
  getAll: (params?: any) => apiClient.get('/employees', { params }),
  getStats: () => apiClient.get<{ success: boolean; data: { total: number; active: number; onLeave: number; newThisMonth: number; probation: number } }>('/employees/stats/summary'),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Employee }>(`/employees/${id}`),
  create: (data: any) => apiClient.post('/employees', data),
  update: (id: string | number, data: any) => apiClient.put(`/employees/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/employees/${id}`),
  uploadDocument: (id: string | number, formData: FormData) =>
    apiClient.post(`/employees/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteDocument: (id: string | number, docId: string | number) => apiClient.delete(`/employees/${id}/documents/${docId}`),
};

export const departmentsApi = {
  list: () => apiClient.get<{ success: boolean; data: Department[] }>('/departments'),
  getAll: () => apiClient.get<{ success: boolean; data: Department[] }>('/departments'),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Department }>(`/departments/${id}`),
  create: (data: any) => apiClient.post('/departments', data),
  update: (id: string | number, data: any) => apiClient.put(`/departments/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/departments/${id}`),
};

export const attendanceApi = {
  // Monthly Spreadsheet Grid Matrix
  getMonthlySheet: (params: { month: number; year: number }) =>
    apiClient.get('/attendance/sheet', { params }),
  saveMonthlySheet: (data: { month: number; year: number; updates: any }) =>
    apiClient.post('/attendance/sheet', data),
  finalizeMonth: (data: { month: number; year: number; notes?: string }) =>
    apiClient.post('/attendance/finalize', data),
  reopenMonth: (data: { month: number; year: number }) =>
    apiClient.post('/attendance/reopen', data),
  exportUrl: (month: number, year: number) => `/api/attendance/export?month=${month}&year=${year}`,
  getMyAttendance: (params?: { month?: number; year?: number }) =>
    apiClient.get('/attendance/my', { params }),
  // Additional compatibility endpoints
  getAll: (params?: any) => apiClient.get('/attendance', { params }),
  list: (params?: any) => apiClient.get('/attendance', { params }),
  getTodayStatus: () => apiClient.get('/attendance/today'),
  clockIn: (data?: any) => apiClient.post('/attendance/clock-in', data || {}),
  clockOut: (data?: any) => apiClient.post('/attendance/clock-out', data || {}),
  requestCorrection: (data: any) => apiClient.post('/attendance/correction-request', data),
  adminCorrection: (data: any) => apiClient.post('/attendance/correction-request', data),
  getCorrections: (params?: any) => apiClient.get('/attendance/corrections', { params }),
  listCorrections: (params?: any) => apiClient.get('/attendance/corrections', { params }),
  reviewCorrection: (id: string | number, data: any) => apiClient.put(`/attendance/corrections/${id}`, data),
};

export const leaveApi = {
  getTypes: () => apiClient.get<{ success: boolean; data: LeaveType[] }>('/leave/types'),
  createType: (data: any) => apiClient.post('/leave/types', data),
  updateType: (id: string, data: any) => apiClient.put(`/leave/types/${id}`, data),
  deleteType: (id: string) => apiClient.delete(`/leave/types/${id}`),
  getBalances: (params?: any) => apiClient.get<{ success: boolean; data: LeaveBalance[] }>('/leave/balances', { params }),
  listRequests: (params?: any) => apiClient.get('/leave/requests', { params }),
  getAll: (params?: any) => apiClient.get('/leave/requests', { params }),
  apply: (data: any) => apiClient.post('/leave/apply', data),
  approve: (id: string | number, data?: { remarks?: string }) => apiClient.put(`/leave/requests/${id}/approve`, data || {}),
  reject: (id: string | number, data?: { remarks?: string; rejection_reason?: string }) => apiClient.put(`/leave/requests/${id}/reject`, data || {}),
  cancel: (id: string | number) => apiClient.post(`/leave/requests/${id}/cancel`),
  getHolidays: (params?: { year?: number }) => apiClient.get('/leave/holidays', { params }),
  createHoliday: (data: any) => apiClient.post('/leave/holidays', data),
  deleteHoliday: (id: string) => apiClient.delete(`/leave/holidays/${id}`),
};

export const payrollApi = {
  // Configurable Components
  getComponents: () => apiClient.get('/payroll/components'),
  createComponent: (data: any) => apiClient.post('/payroll/components', data),
  updateComponent: (id: string, data: any) => apiClient.put(`/payroll/components/${id}`, data),
  deleteComponent: (id: string) => apiClient.delete(`/payroll/components/${id}`),

  // Employee Salary Structure
  getEmployeeStructure: (employeeId: string) => apiClient.get(`/payroll/structures/${employeeId}`),
  updateEmployeeStructure: (employeeId: string, data: any) => apiClient.put(`/payroll/structures/${employeeId}`, data),

  // Payroll Runs
  listRuns: (params?: { year?: number }) => apiClient.get('/payroll/runs', { params }),
  getAll: (params?: any) => apiClient.get('/payroll/runs', { params }),
  getRunById: (id: string) => apiClient.get(`/payroll/runs/${id}`),
  calculate: (data: { month: number; year: number }) => apiClient.post('/payroll/calculate', data),
  finalize: (data: { id: string }) => apiClient.post('/payroll/finalize', data),
  reopen: (data: { id: string }) => apiClient.post('/payroll/reopen', data),

  // Payslips
  getPayslip: (id: string | number) => apiClient.get(`/payroll/payslips/${id}`),
  getById: (id: string | number) => apiClient.get(`/payroll/payslips/${id}`),
  getMyPayslips: () => apiClient.get('/payroll/my-payslips'),
  process: (data: any) => apiClient.post('/payroll/calculate', data),
  generateMonthly: (data: any) => apiClient.post('/payroll/calculate', data),
};

export const investmentsApi = {
  list: () => apiClient.get('/investments'),
  getAll: () => apiClient.get('/investments'),
  getById: (id: string) => apiClient.get(`/investments/${id}`),
  create: (data: any) => apiClient.post('/investments', data),
  update: (id: string, data: any) => apiClient.put(`/investments/${id}`, data),
  delete: (id: string) => apiClient.delete(`/investments/${id}`),
};

export const investmentApi = investmentsApi;

export const clientsApi = {
  list: (params?: any) => apiClient.get('/clients', { params }),
  getAll: (params?: any) => apiClient.get('/clients', { params }),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Client }>(`/clients/${id}`),
  create: (data: any) => apiClient.post('/clients', data),
  update: (id: string | number, data: any) => apiClient.put(`/clients/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/clients/${id}`),
};

export const leadsApi = {
  list: (params?: any) => apiClient.get('/leads', { params }),
  getAll: (params?: any) => apiClient.get('/leads', { params }),
  create: (data: any) => apiClient.post('/leads', data),
  update: (id: string | number, data: any) => apiClient.put(`/leads/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/leads/${id}`),
  convert: (id: string | number, data?: any) => apiClient.post(`/leads/${id}/convert`, data || {}),
};

export const projectsApi = {
  list: (params?: any) => apiClient.get('/projects', { params }),
  getAll: (params?: any) => apiClient.get('/projects', { params }),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Project }>(`/projects/${id}`),
  create: (data: any) => apiClient.post('/projects', data),
  update: (id: string | number, data: any) => apiClient.put(`/projects/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/projects/${id}`),
  addMember: (id: string | number, data: any) => apiClient.post(`/projects/${id}/members`, data),
  removeMember: (id: string | number, memberId: string | number) => apiClient.delete(`/projects/${id}/members/${memberId}`),
};

export const tasksApi = {
  list: (params?: any) => apiClient.get('/tasks', { params }),
  getAll: (params?: any) => apiClient.get('/tasks', { params }),
  getKanban: (params?: any) => apiClient.get('/tasks', { params }),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Task }>(`/tasks/${id}`),
  create: (data: any) => apiClient.post('/tasks', data),
  update: (id: string | number, data: any) => apiClient.put(`/tasks/${id}`, data),
  updateStatus: (id: string | number, status: string) => apiClient.put(`/tasks/${id}`, { status }),
  delete: (id: string | number) => apiClient.delete(`/tasks/${id}`),
  addComment: (id: string | number, comment: any) =>
    apiClient.post(`/tasks/${id}/comments`, typeof comment === 'string' ? { comment } : comment),
  addChecklistItem: (taskId: string | number, title: any) =>
    apiClient.post(`/tasks/${taskId}/checklist`, typeof title === 'string' ? { title } : title),
  updateChecklistItem: (taskId: string | number, itemId: string | number, data: any) =>
    apiClient.put(`/tasks/${taskId}/checklist/${itemId}`, data),
  toggleChecklistItem: (taskId: string | number, itemId: string | number) =>
    apiClient.put(`/tasks/${taskId}/checklist/${itemId}/toggle`),
  deleteChecklistItem: (taskId: string | number, itemId: string | number) =>
    apiClient.delete(`/tasks/${taskId}/checklist/${itemId}`),
};

export const timesheetsApi = {
  list: (params?: any) => apiClient.get('/timesheets', { params }),
  getAll: (params?: any) => apiClient.get('/timesheets', { params }),
  create: (data: any) => apiClient.post('/timesheets', data),
  log: (data: any) => apiClient.post('/timesheets', data),
  approve: (id: string | number) => apiClient.put(`/timesheets/${id}`, { status: 'approved' }),
  reject: (id: string | number) => apiClient.put(`/timesheets/${id}`, { status: 'rejected' }),
  delete: (id: string | number) => apiClient.delete(`/timesheets/${id}`),
};

export const performanceApi = {
  list: (params?: any) => apiClient.get('/performance', { params }),
  getAll: (params?: any) => apiClient.get('/performance', { params }),
  create: (data: any) => apiClient.post('/performance', data),
};

export const financeApi = {
  getOverview: (params?: any) => apiClient.get('/finance/overview', { params }),
  getAll: (params?: any) => apiClient.get('/finance/overview', { params }),
  getProfitLoss: (params?: any) => apiClient.get('/finance/overview', { params }),
  getStats: (params?: any) => apiClient.get('/finance/overview', { params }),
  getCategories: () => Promise.resolve({ data: { success: true, data: [
    { id: 1, name: 'Operations' },
    { id: 2, name: 'Software & Subscriptions' },
    { id: 3, name: 'Rent & Facilities' },
    { id: 4, name: 'Payroll & Benefits' },
    { id: 5, name: 'Marketing & Sales' },
    { id: 6, name: 'Equipment & Hardware' },
    { id: 7, name: 'Travel & Events' },
    { id: 8, name: 'Other' }
  ] } }),

  listIncome: (params?: any) => apiClient.get('/finance/income', { params }),
  getIncomes: (params?: any) => apiClient.get('/finance/income', { params }),
  createIncome: (data: any) => apiClient.post('/finance/income', data),
  updateIncome: (id: string, data: any) => apiClient.put(`/finance/income/${id}`, data),
  deleteIncome: (id: string) => apiClient.delete(`/finance/income/${id}`),

  listExpenses: (params?: any) => apiClient.get('/finance/expenses', { params }),
  getExpenses: (params?: any) => apiClient.get('/finance/expenses', { params }),
  createExpense: (data: any) => apiClient.post('/finance/expenses', data),
  updateExpense: (id: string, data: any) => apiClient.put(`/finance/expenses/${id}`, data),
  deleteExpense: (id: string) => apiClient.delete(`/finance/expenses/${id}`),
};

export const invoicesApi = {
  list: (params?: any) => apiClient.get('/invoices', { params }),
  getAll: (params?: any) => apiClient.get('/invoices', { params }),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Invoice }>(`/invoices/${id}`),
  create: (data: any) => apiClient.post('/invoices', data),
  updateStatus: (id: string | number, status: string) => apiClient.put(`/invoices/${id}`, { status }),
  delete: (id: string | number) => apiClient.delete(`/invoices/${id}`),
};

export const paymentsApi = {
  list: (params?: any) => apiClient.get('/payments', { params }),
  getAll: (params?: any) => apiClient.get('/payments', { params }),
  create: (data: any) => apiClient.post('/payments', data),
};

export const loansApi = {
  list: (params?: any) => apiClient.get('/loans', { params }),
  getAll: (params?: any) => apiClient.get('/loans', { params }),
  create: (data: any) => apiClient.post('/loans', data),
  apply: (data: any) => apiClient.post('/loans', data),
  approve: (id: string | number) => apiClient.put(`/loans/${id}/approve`),
  reject: (id: string | number, data?: any) => apiClient.put(`/loans/${id}/reject`, data || {}),
};

export const assetsApi = {
  list: (params?: any) => apiClient.get('/assets', { params }),
  getAll: (params?: any) => apiClient.get('/assets', { params }),
  create: (data: any) => apiClient.post('/assets', data),
  update: (id: string | number, data: any) => apiClient.put(`/assets/${id}`, data),
  assign: (id: string | number, data: any) => apiClient.post(`/assets/${id}/assign`, data),
  return: (id: string | number, data?: any) => apiClient.post(`/assets/${id}/return`, data || {}),
  delete: (id: string | number) => apiClient.delete(`/assets/${id}`),
};

export const announcementsApi = {
  list: (params?: any) => apiClient.get('/announcements', { params }),
  getAll: (params?: any) => apiClient.get('/announcements', { params }),
  create: (data: any) => apiClient.post('/announcements', data),
  delete: (id: string | number) => apiClient.delete(`/announcements/${id}`),
};

export const meetingsApi = {
  list: (params?: any) => apiClient.get('/meetings', { params }),
  getAll: (params?: any) => apiClient.get('/meetings', { params }),
  create: (data: any) => apiClient.post('/meetings', data),
  delete: (id: string | number) => apiClient.delete(`/meetings/${id}`),
};

export const calendarApi = {
  getEvents: (params?: any) => apiClient.get('/leave/holidays', { params }),
  getAll: (params?: any) => apiClient.get('/leave/holidays', { params }),
};

export const approvalsApi = {
  getOverview: () => apiClient.get('/leave/requests?status=pending'),
  list: (params?: any) => apiClient.get('/leave/requests', { params }),
  getAll: (params?: any) => apiClient.get('/leave/requests', { params }),
  approve: (id: string | number, data?: any) => apiClient.put(`/leave/requests/${id}/approve`, data || {}),
  reject: (id: string | number, data?: any) => apiClient.put(`/leave/requests/${id}/reject`, data || {}),
  decision: (id: string | number, data: any) => apiClient.post(`/approvals/${id}/decision`, data),
  getHistory: (id: string | number) => apiClient.get(`/approvals/${id}/history`),
};

export const documentsApi = {
  list: (params?: any) => apiClient.get('/documents', { params }),
  getAll: (params?: any) => apiClient.get('/documents', { params }),
  upload: (formData: FormData) =>
    apiClient.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string | number) => apiClient.delete(`/documents/${id}`),
};

export const notificationsApi = {
  list: () => apiClient.get<{ success: boolean; data: { notifications: NotificationItem[]; unreadCount: number } }>('/notifications'),
  getAll: () => apiClient.get<{ success: boolean; data: { notifications: NotificationItem[]; unreadCount: number } }>('/notifications'),
  markRead: (id: string | number) => apiClient.put(`/notifications/${id}/read`),
  markAllRead: () => apiClient.put('/notifications/read-all'),
};

export const reportsApi = {
  getReport: (reportType: string, params?: any) => apiClient.get(`/reports/${reportType}`, { params }),
};

export const dashboardApi = {
  getStats: () => apiClient.get('/dashboard/stats'),
};

export const auditApi = {
  list: (params?: any) => apiClient.get('/audit', { params }),
  getAll: (params?: any) => apiClient.get('/audit', { params }),
};

export const searchApi = {
  global: (q: string) => apiClient.get('/search', { params: { q } }),
};
