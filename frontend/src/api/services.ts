import { apiClient } from './client';
import {
  User, Employee, Department, Client, Lead, Project, Task, Attendance,
  AttendanceCorrection, LeaveType, LeaveBalance, LeaveApplication, Payroll,
  PayrollItem, Loan, PerformanceReview, Timesheet, Income, ExpenseCategory,
  Expense, Invoice, Payment, Asset, CompanyDocument, Announcement, NotificationItem,
  Meeting, CompanySettings, AuditLog
} from '../types';

export const authApi = {
  login: (data: any) => apiClient.post('/auth/login', data),
  register: (data: any) => apiClient.post('/auth/register', data),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get<{ success: boolean; data: User }>('/auth/me'),
  changePassword: (data: any) => apiClient.post('/auth/change-password', data),
  updateProfile: (data: any) => apiClient.put('/auth/profile', data),
};

export const usersApi = {
  getAll: (params?: any) => apiClient.get('/users', { params }),
  list: (params?: any) => apiClient.get('/users', { params }),
  getById: (id: string | number) => apiClient.get(`/users/${id}`),
  create: (data: any) => apiClient.post('/users', data),
  update: (id: string | number, data: any) => apiClient.put(`/users/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/users/${id}`),
};

export const rolesApi = {
  getAll: () => apiClient.get('/roles'),
  list: () => apiClient.get('/roles'),
  getById: (roleId: string | number) => apiClient.get(`/roles/${roleId}`),
  getPermissions: (roleId?: string | number) =>
    roleId ? apiClient.get(`/roles/${roleId}/permissions`) : apiClient.get('/roles/permissions'),
  listAllPermissions: () => apiClient.get('/roles/permissions'),
  assignPermissions: (roleId: string | number, data: { permission_ids?: number[]; permissionIds?: string[] }) =>
    apiClient.put(`/roles/${roleId}/permissions`, data),
  updateRolePermissions: (roleId: string | number, permissionIds: string[]) =>
    apiClient.put(`/roles/${roleId}/permissions`, { permissionIds }),
  create: (data: any) => apiClient.post('/roles', data),
};

export const companyApi = {
  getSettings: () => apiClient.get<{ success: boolean; data: CompanySettings }>('/company'),
  updateSettings: (data: any) => apiClient.put('/company', data),
};

export const employeesApi = {
  getAll: (params?: any) => apiClient.get('/employees', { params }),
  list: (params?: any) => apiClient.get('/employees', { params }),
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
  getAll: () => apiClient.get<{ success: boolean; data: Department[] }>('/departments'),
  list: () => apiClient.get<{ success: boolean; data: Department[] }>('/departments'),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Department }>(`/departments/${id}`),
  create: (data: any) => apiClient.post('/departments', data),
  update: (id: string | number, data: any) => apiClient.put(`/departments/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/departments/${id}`),
};

export const clientsApi = {
  getAll: (params?: any) => apiClient.get('/clients', { params }),
  list: (params?: any) => apiClient.get('/clients', { params }),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Client }>(`/clients/${id}`),
  create: (data: any) => apiClient.post('/clients', data),
  update: (id: string | number, data: any) => apiClient.put(`/clients/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/clients/${id}`),
};

export const leadsApi = {
  getAll: (params?: any) => apiClient.get('/leads', { params }),
  list: (params?: any) => apiClient.get('/leads', { params }),
  create: (data: any) => apiClient.post('/leads', data),
  update: (id: string | number, data: any) => apiClient.put(`/leads/${id}`, data),
  convert: (id: string | number, data?: any) => apiClient.post(`/leads/${id}/convert`, data || {}),
  delete: (id: string | number) => apiClient.delete(`/leads/${id}`),
};

export const projectsApi = {
  getAll: (params?: any) => apiClient.get('/projects', { params }),
  list: (params?: any) => apiClient.get('/projects', { params }),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Project }>(`/projects/${id}`),
  create: (data: any) => apiClient.post('/projects', data),
  update: (id: string | number, data: any) => apiClient.put(`/projects/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/projects/${id}`),
  addMember: (id: string | number, data: any) => apiClient.post(`/projects/${id}/members`, data),
  removeMember: (id: string | number, memberId: string | number) => apiClient.delete(`/projects/${id}/members/${memberId}`),
};

export const tasksApi = {
  getAll: (params?: any) => apiClient.get('/tasks', { params }),
  list: (params?: any) => apiClient.get('/tasks', { params }),
  getKanban: (params?: any) => apiClient.get<{ success: boolean; data: Record<string, Task[]> }>('/tasks/kanban', { params }),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Task }>(`/tasks/${id}`),
  create: (data: any) => apiClient.post('/tasks', data),
  update: (id: string | number, data: any) => apiClient.put(`/tasks/${id}`, data),
  delete: (id: string | number) => apiClient.delete(`/tasks/${id}`),
  addComment: (id: string | number, data: { comment: string } | string) =>
    apiClient.post(`/tasks/${id}/comments`, typeof data === 'string' ? { comment: data } : data),
  addAttachment: (id: string | number, formData: FormData) =>
    apiClient.post(`/tasks/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  addChecklistItem: (id: string | number, data: { title: string }) => apiClient.post(`/tasks/${id}/checklists`, data),
  addChecklist: (id: string | number, title: string) => apiClient.post(`/tasks/${id}/checklists`, { title }),
  updateChecklistItem: (taskId: string | number, checklistId: string | number, data: any) =>
    apiClient.put(`/tasks/${taskId}/checklists/${checklistId}`, data),
  deleteChecklistItem: (taskId: string | number, checklistId: string | number) =>
    apiClient.delete(`/tasks/${taskId}/checklists/${checklistId}`),
  toggleChecklist: (checklistId: string | number, isCompleted: boolean) =>
    apiClient.put(`/tasks/checklists/${checklistId}/toggle`, { isCompleted }),
};

export const attendanceApi = {
  clockIn: (data?: any) => apiClient.post('/attendance/clock-in', data || {}),
  clockOut: (data?: any) => apiClient.post('/attendance/clock-out', data || {}),
  checkIn: () => apiClient.post('/attendance/clock-in'),
  checkOut: () => apiClient.post('/attendance/clock-out'),
  getTodayStatus: () => apiClient.get<{ success: boolean; data: Attendance | null }>('/attendance/today'),
  getToday: () => apiClient.get<{ success: boolean; data: Attendance | null }>('/attendance/today'),
  getAll: (params?: any) => apiClient.get('/attendance', { params }),
  list: (params?: any) => apiClient.get('/attendance', { params }),
  requestCorrection: (data: any) => apiClient.post('/attendance/correction', data),
  listCorrections: (params?: any) => apiClient.get<{ success: boolean; data: AttendanceCorrection[] }>('/attendance/corrections', { params }),
  reviewCorrection: (id: string | number, data: any) => apiClient.put(`/attendance/corrections/${id}/review`, data),
};

export const leaveApi = {
  getTypes: () => apiClient.get<{ success: boolean; data: LeaveType[] }>('/leave/types'),
  createType: (data: any) => apiClient.post('/leave/types', data),
  getBalances: (params?: any) => apiClient.get<{ success: boolean; data: LeaveBalance[] }>('/leave/balances', { params }),
  apply: (data: any) => apiClient.post('/leave/apply', data),
  getAll: (params?: any) => apiClient.get('/leave/requests', { params }),
  listRequests: (params?: any) => apiClient.get('/leave/requests', { params }),
  approve: (id: string | number, data?: any) => apiClient.put(`/leave/requests/${id}/approve`, data || {}),
  reject: (id: string | number, data?: any) => apiClient.put(`/leave/requests/${id}/reject`, data || {}),
  reviewRequest: (id: string | number, data: any) => apiClient.put(`/leave/requests/${id}/review`, data),
};

export const payrollApi = {
  getAll: (params?: any) => apiClient.get('/payroll', { params }),
  list: (params?: any) => apiClient.get('/payroll', { params }),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Payroll }>(`/payroll/${id}`),
  generateMonthly: (data: any) => apiClient.post('/payroll/generate', data),
  process: (data: any) => apiClient.post('/payroll/generate', data),
  approve: (id: string | number) => apiClient.put(`/payroll/${id}/approve`),
  markPaid: (id: string | number, data?: any) => apiClient.put(`/payroll/${id}/pay`, data || {}),
  getPayslip: (id: string | number) => apiClient.get<{ success: boolean; data: { payslip: PayrollItem; company: CompanySettings } }>(`/payroll/${id}`),
};

export const loansApi = {
  getAll: (params?: any) => apiClient.get('/loans', { params }),
  list: (params?: any) => apiClient.get('/loans', { params }),
  apply: (data: any) => apiClient.post('/loans', data),
  create: (data: any) => apiClient.post('/loans', data),
  approve: (id: string | number, data?: any) => apiClient.put(`/loans/${id}/approve`, data || {}),
  reject: (id: string | number, data?: any) => apiClient.put(`/loans/${id}/reject`, data || {}),
  review: (id: string | number, data: any) => apiClient.put(`/loans/${id}/review`, data),
};

export const performanceApi = {
  getAll: (params?: any) => apiClient.get('/performance', { params }),
  list: (params?: any) => apiClient.get('/performance', { params }),
  create: (data: any) => apiClient.post('/performance', data),
};

export const timesheetsApi = {
  getAll: (params?: any) => apiClient.get('/timesheets', { params }),
  list: (params?: any) => apiClient.get('/timesheets', { params }),
  create: (data: any) => apiClient.post('/timesheets', data),
  log: (data: any) => apiClient.post('/timesheets', data),
  approve: (id: string | number) => apiClient.put(`/timesheets/${id}/approve`),
  reject: (id: string | number, data?: any) => apiClient.put(`/timesheets/${id}/reject`, data || {}),
  review: (id: string | number, data: any) => apiClient.put(`/timesheets/${id}/review`, data),
  delete: (id: string | number) => apiClient.delete(`/timesheets/${id}`),
};

export const financeApi = {
  getIncomes: (params?: any) => apiClient.get('/finance/incomes', { params }),
  listIncomes: (params?: any) => apiClient.get('/finance/incomes', { params }),
  createIncome: (data: any) => apiClient.post('/finance/incomes', data),
  getCategories: () => apiClient.get<{ success: boolean; data: ExpenseCategory[] }>('/finance/expense-categories'),
  listCategories: () => apiClient.get<{ success: boolean; data: ExpenseCategory[] }>('/finance/expense-categories'),
  createCategory: (data: any) => apiClient.post('/finance/expense-categories', data),
  getExpenses: (params?: any) => apiClient.get('/finance/expenses', { params }),
  listExpenses: (params?: any) => apiClient.get('/finance/expenses', { params }),
  createExpense: (formData: FormData) =>
    apiClient.post('/finance/expenses', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteExpense: (id: string | number) => apiClient.delete(`/finance/expenses/${id}`),
  getProfitLoss: (params?: any) => apiClient.get('/finance/summary', { params }),
  getSummary: (params?: any) => apiClient.get('/finance/summary', { params }),
};

export const invoicesApi = {
  getAll: (params?: any) => apiClient.get('/invoices', { params }),
  list: (params?: any) => apiClient.get('/invoices', { params }),
  getById: (id: string | number) => apiClient.get<{ success: boolean; data: Invoice }>(`/invoices/${id}`),
  create: (data: any) => apiClient.post('/invoices', data),
  updateStatus: (id: string | number, status: string) => apiClient.put(`/invoices/${id}/status`, { status }),
  delete: (id: string | number) => apiClient.delete(`/invoices/${id}`),
};

export const paymentsApi = {
  getAll: (params?: any) => apiClient.get('/payments', { params }),
  list: (params?: any) => apiClient.get('/payments', { params }),
  create: (data: any) => apiClient.post('/payments', data),
  record: (data: any) => apiClient.post('/payments', data),
};

export const assetsApi = {
  getAll: (params?: any) => apiClient.get('/assets', { params }),
  list: (params?: any) => apiClient.get('/assets', { params }),
  create: (data: any) => apiClient.post('/assets', data),
  update: (id: string | number, data: any) => apiClient.put(`/assets/${id}`, data),
  assign: (id: string | number, data: any) => apiClient.post(`/assets/${id}/assign`, data),
  return: (id: string | number, data?: any) => apiClient.post(`/assets/${id}/return`, data || {}),
  returnAsset: (id: string | number, data: any) => apiClient.post(`/assets/${id}/return`, data),
  delete: (id: string | number) => apiClient.delete(`/assets/${id}`),
};

export const documentsApi = {
  getAll: (params?: any) => apiClient.get('/documents', { params }),
  list: (params?: any) => apiClient.get('/documents', { params }),
  upload: (formData: FormData) =>
    apiClient.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string | number) => apiClient.delete(`/documents/${id}`),
};

export const announcementsApi = {
  getAll: (params?: any) => apiClient.get('/announcements', { params }),
  list: () => apiClient.get<{ success: boolean; data: Announcement[] }>('/announcements'),
  create: (data: any) => apiClient.post('/announcements', data),
  delete: (id: string | number) => apiClient.delete(`/announcements/${id}`),
};

export const notificationsApi = {
  list: () => apiClient.get<{ success: boolean; data: { notifications: NotificationItem[]; unreadCount: number } }>('/notifications'),
  markRead: (id: string | number) => apiClient.put(`/notifications/${id}/read`),
  markAllRead: () => apiClient.put('/notifications/read-all'),
};

export const meetingsApi = {
  getAll: (params?: any) => apiClient.get('/meetings', { params }),
  list: () => apiClient.get<{ success: boolean; data: Meeting[] }>('/meetings'),
  create: (data: any) => apiClient.post('/meetings', data),
  delete: (id: string | number) => apiClient.delete(`/meetings/${id}`),
};

export const calendarApi = {
  getEvents: (params?: any) => apiClient.get('/calendar', { params }),
};

export const reportsApi = {
  getReport: (reportType: string, params?: any) => apiClient.get(`/reports/${reportType}`, { params }),
};

export const dashboardApi = {
  getStats: () => apiClient.get('/dashboard/stats'),
};

export const auditApi = {
  getAll: (params?: any) => apiClient.get('/audit', { params }),
  list: (params?: any) => apiClient.get('/audit', { params }),
};

export const searchApi = {
  global: (q: string) => apiClient.get('/search', { params: { q } }),
};
