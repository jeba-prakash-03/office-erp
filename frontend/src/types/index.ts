export interface User {
  id: string | number;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  roleId?: string | number;
  role_id?: string | number;
  role?: string;
  roleName?: string;
  role_name?: string;
  roleDisplayName?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  status?: string;
  last_login_at?: string | null;
  created_at?: string;
  employee?: {
    id: string | number;
    employeeCode?: string;
    employee_code?: string;
    designation?: string;
    departmentId?: string | null;
    department_id?: string | null;
    departmentName?: string | null;
    department_name?: string | null;
  } | null;
  client?: {
    id: string | number;
    clientCode?: string;
    client_code?: string;
    companyName?: string;
    company_name?: string;
  } | null;
  permissions?: string[];
}

export interface Role {
  id: number | string;
  name: string;
  description?: string;
  is_system?: boolean | number;
  permissions?: (number | string | Permission)[];
  created_at?: string;
}

export interface Permission {
  id: number;
  module: string;
  code: string;
  name: string;
  description?: string;
}

export interface Employee {
  id: string | number;
  user_id?: string | number | null;
  employee_id?: string;
  employee_code?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string;
  profile_photo?: string | null;
  avatar_url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip_code?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  department_id?: string | number | null;
  department_name?: string | null;
  designation: string;
  role_id?: string | number | null;
  role_name?: string | null;
  role_display_name?: string | null;
  joining_date?: string;
  employment_type?: string;
  employment_status?: string;
  status?: string;
  reporting_manager_id?: string | number | null;
  reporting_manager_name?: string | null;
  basic_salary?: number | string;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  pan_number?: string | null;
  identity_number?: string | null;
  tax_id?: string | null;
  skills?: string | null;
  experience_years?: number | string;
  notes?: string | null;
  created_at?: string;
  documents?: EmployeeDocument[];
  salaryStructure?: SalaryStructure;
  leaveBalances?: LeaveBalance[];
  leaveRequests?: LeaveApplication[];
  attendance?: Attendance[];
  tasks?: Task[];
  projects?: Project[];
  performanceReviews?: PerformanceReview[];
  payslips?: PayrollItem[];
}

export interface EmployeeDocument {
  id: string | number;
  employee_id: string | number;
  title: string;
  document_type?: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  expiry_date?: string | null;
  created_at?: string;
}

export interface Department {
  id: string | number;
  name: string;
  description?: string | null;
  manager_id?: string | number | null;
  manager_name?: string | null;
  manager_email?: string | null;
  manager_photo?: string | null;
  employee_count?: number;
  status?: string;
  created_at?: string;
  employees?: Employee[];
}

export interface Client {
  id: string | number;
  client_code?: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  industry?: string | null;
  gst_number?: string | null;
  tax_number?: string | null;
  status?: string;
  assigned_sales_rep_id?: string | number | null;
  sales_rep_name?: string | null;
  notes?: string | null;
  created_at?: string;
  contacts?: ClientContact[];
  projects?: Project[];
  invoices?: Invoice[];
  payments?: Payment[];
  documents?: Document[];
  total_invoiced?: number;
  total_paid?: number;
  project_count?: number;
}

export interface ClientContact {
  id: string | number;
  client_id: string | number;
  name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  is_primary: boolean | number;
}

export interface Lead {
  id: string | number;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  assigned_employee_id?: string | number | null;
  assigned_employee_name?: string | null;
  stage: string;
  priority: string;
  estimated_value: number;
  expected_closing_date?: string | null;
  converted_to_client_id?: string | number | null;
  converted_client_name?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface Project {
  id: string | number;
  project_code?: string;
  code?: string;
  name: string;
  client_id?: string | number | null;
  client_name?: string | null;
  client_code?: string | null;
  client?: Client;
  description?: string | null;
  project_manager_id?: string | number | null;
  project_manager_name?: string | null;
  project_manager_photo?: string | null;
  start_date?: string;
  end_date?: string | null;
  deadline?: string | null;
  budget?: number | string;
  hourly_rate?: number;
  billing_type?: string;
  progress?: number;
  status: string;
  priority: string;
  technology?: string | null;
  repository_url?: string | null;
  production_url?: string | null;
  notes?: string | null;
  created_at?: string;
  task_counts?: {
    todo?: number;
    in_progress?: number;
    review?: number;
    completed?: number;
  };
  total_tasks?: number;
  completed_tasks?: number;
  total_expenses?: number;
  member_count?: number;
  members?: any[];
  tasks?: Task[];
  timesheets?: Timesheet[];
  expenses?: Expense[];
  files?: Document[];
}

export interface Task {
  id: string | number;
  task_code?: string;
  title: string;
  description?: string | null;
  project_id: string | number;
  project_name?: string;
  project_code?: string;
  client_id?: string | number | null;
  assigned_to?: string | number | null;
  assigned_employee_id?: string | number | null;
  assigned_employee_name?: string | null;
  assigned_employee_photo?: string | null;
  assignee_name?: string;
  created_by_user_id?: string | number | null;
  created_by_name?: string | null;
  priority: string;
  status: string;
  start_date?: string | null;
  due_date?: string | null;
  estimated_hours?: number | string;
  actual_hours?: number | string;
  logged_hours?: number | string;
  completed_at?: string | null;
  created_at?: string;
  comment_count?: number;
  checklist_total?: number;
  checklist_completed?: number;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  checklists?: TaskChecklist[];
}

export interface TaskComment {
  id: string | number;
  task_id: string | number;
  user_id?: string | number;
  user_name?: string;
  avatar_url?: string | null;
  comment: string;
  created_at?: string;
}

export interface TaskAttachment {
  id: string | number;
  task_id: string | number;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by_name?: string;
  created_at?: string;
}

export interface TaskChecklist {
  id: string | number;
  task_id: string | number;
  title: string;
  is_completed: boolean | number;
  sort_order?: number;
}

export interface Attendance {
  id: string | number;
  employee_id: string | number;
  employee_code?: string;
  employee_name?: string;
  profile_photo?: string | null;
  department_name?: string | null;
  date: string;
  clock_in?: string | null;
  clock_out?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  break_minutes?: number;
  total_hours?: number | string;
  overtime_hours?: number | string;
  status: string;
  ip_address?: string | null;
  notes?: string | null;
}

export interface AttendanceCorrection {
  id: string | number;
  attendance_id?: string | number | null;
  employee_id: string | number;
  employee_code?: string;
  employee_name?: string;
  department_name?: string | null;
  date: string;
  requested_clock_in?: string;
  requested_clock_out?: string;
  requested_check_in?: string;
  requested_check_out?: string;
  reason: string;
  status: string;
  approved_by_name?: string | null;
  reviewer_remarks?: string | null;
  created_at?: string;
}

export interface LeaveType {
  id: string | number;
  name: string;
  days_allowed_per_year?: number;
  days_per_year?: number;
  is_paid: boolean | number;
  requires_attachment?: boolean | number;
  description?: string | null;
}

export interface LeaveBalance {
  id: string | number;
  employee_id: string | number;
  leave_type_id: string | number;
  leave_type_name: string;
  is_paid?: boolean | number;
  year?: number;
  allocated_days?: number;
  total_days?: number;
  used_days?: number;
  pending_days?: number;
  remaining_days?: number;
}

export interface LeaveApplication {
  id: string | number;
  employee_id: string | number;
  employee_code?: string;
  employee_name?: string;
  profile_photo?: string | null;
  department_name?: string | null;
  leave_type_id: string | number;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  total_days: number | string;
  is_half_day?: boolean | number;
  half_day_type?: string;
  reason: string;
  attachment_url?: string | null;
  status: string;
  approved_by_name?: string | null;
  reviewer_remarks?: string | null;
  created_at?: string;
}

export interface SalaryStructure {
  id: string | number;
  employee_id: string | number;
  basic_salary: number;
  hra?: number;
  special_allowance?: number;
  medical_allowance?: number;
  conveyance_allowance?: number;
  provident_fund?: number;
  esi?: number;
  professional_tax?: number;
  income_tax_tds?: number;
}

export interface Payroll {
  id: string | number;
  employee_id?: string | number;
  employee_name?: string;
  employee_code?: string;
  designation?: string;
  department_name?: string;
  month: number | string;
  year: number | string;
  basic_salary?: number | string;
  allowances?: number | string;
  overtime_pay?: number | string;
  tax_deduction?: number | string;
  attendance_deduction?: number | string;
  loan_deduction?: number | string;
  gross_salary?: number | string;
  total_deductions?: number | string;
  net_salary?: number | string;
  total_gross?: number | string;
  total_net?: number | string;
  total_employees?: number;
  working_days?: number;
  status: string;
  processed_by_name?: string | null;
  approved_by_name?: string | null;
  paid_at?: string | null;
  created_at?: string;
  items?: PayrollItem[];
}

export interface PayrollItem {
  id: string | number;
  payroll_id?: string | number;
  employee_id: string | number;
  employee_code?: string;
  employee_name?: string;
  designation?: string;
  department_name?: string;
  basic_salary: number;
  allowances: number;
  bonus?: number;
  overtime_amount?: number;
  unpaid_leave_deductions?: number;
  tax_deductions?: number;
  pf_deductions?: number;
  esi_deductions?: number;
  loan_deductions?: number;
  other_deductions?: number;
  gross_salary: number;
  net_salary: number;
  working_days?: number;
  present_days?: number;
  unpaid_leave_days?: number;
  overtime_hours?: number;
  payment_status?: string;
  payment_date?: string | null;
  payment_method?: string | null;
  transaction_reference?: string | null;
  month?: number;
  year?: number;
}

export interface Loan {
  id: string | number;
  employee_id: string | number;
  employee_code?: string;
  employee_name?: string;
  department_name?: string;
  type: string;
  amount: number | string;
  repayment_months?: number;
  total_tenure_months?: number;
  monthly_deduction?: number | string;
  monthly_emi?: number | string;
  paid_amount?: number | string;
  remaining_amount?: number | string;
  remaining_balance?: number | string;
  reason?: string | null;
  status: string;
  disbursed_at?: string | null;
  created_at?: string;
}

export interface PerformanceReview {
  id: string | number;
  employee_id: string | number;
  employee_code?: string;
  employee_name?: string;
  designation?: string;
  department_name?: string;
  reviewer_name?: string;
  cycle?: string;
  period?: string;
  review_period?: string;
  technical_skills?: number;
  productivity?: number;
  communication?: number;
  teamwork?: number;
  punctuality?: number;
  task_completion_rating?: number;
  quality_rating?: number;
  attendance_rating?: number;
  overall_rating?: number | string;
  overall_score?: number | string;
  manager_feedback?: string | null;
  feedback?: string | null;
  strengths?: string | null;
  areas_for_improvement?: string | null;
  goals?: string | null;
  status?: string;
  created_at?: string;
}

export interface Timesheet {
  id: string | number;
  employee_id: string | number;
  employee_code?: string;
  employee_name?: string;
  profile_photo?: string | null;
  project_id: string | number;
  project_name?: string;
  project_code?: string;
  task_id?: string | number | null;
  task_title?: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  hours: number | string;
  description: string;
  is_billable: boolean | number;
  status: string;
  approved_by_name?: string | null;
  created_at?: string;
}

export interface Income {
  id: string | number;
  income_code?: string;
  title?: string;
  client_id?: string | number | null;
  client_name?: string | null;
  invoice_id?: string | number | null;
  invoice_number?: string | null;
  project_id?: string | number | null;
  project_name?: string | null;
  category: string;
  amount: number | string;
  date: string;
  payment_method: string;
  reference_number?: string | null;
  description?: string | null;
  created_at?: string;
}

export interface ExpenseCategory {
  id: string | number;
  name: string;
  description?: string | null;
}

export interface Expense {
  id: string | number;
  expense_code?: string;
  title?: string;
  category_id?: string | number;
  category_name?: string;
  project_id?: string | number | null;
  project_name?: string | null;
  amount: number | string;
  date: string;
  vendor?: string | null;
  payment_method: string;
  description?: string | null;
  receipt_url?: string | null;
  status?: string;
  added_by_name?: string;
  approved_by_name?: string;
  created_at?: string;
}

export interface ProfitLossSummary {
  total_income: number;
  total_expense: number;
  net_profit: number;
}

export interface Invoice {
  id: string | number;
  invoice_number: string;
  client_id: string | number;
  client_name?: string;
  client_code?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  client?: Client;
  project_id?: string | number | null;
  project_name?: string | null;
  issue_date?: string;
  invoice_date?: string;
  due_date?: string;
  subtotal: number | string;
  discount_amount?: number | string;
  discount_type?: string;
  discount_value?: number;
  tax_rate?: number;
  tax_amount?: number | string;
  total_amount?: number | string;
  grand_total?: number | string;
  paid_amount?: number | string;
  remaining_balance?: number | string;
  status: string;
  notes?: string | null;
  terms?: string | null;
  created_at?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  company?: CompanySettings;
}

export interface InvoiceItem {
  id?: string | number;
  invoice_id?: string | number;
  description: string;
  quantity: number;
  unit_price: number;
  amount?: number;
  total_price?: number;
  sort_order?: number;
}

export interface Payment {
  id: string | number;
  payment_number?: string;
  invoice_id: string | number;
  invoice_number?: string;
  client_id?: string | number;
  client_name?: string;
  amount: number | string;
  payment_date: string;
  payment_method: string;
  transaction_reference?: string | null;
  notes?: string | null;
  recorded_by_name?: string;
  created_at?: string;
}

export interface Asset {
  id: string | number;
  asset_code?: string;
  name: string;
  category: string;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | string;
  warranty_expiry?: string | null;
  warranty_expiry_date?: string | null;
  assigned_to_id?: string | number | null;
  assigned_to_name?: string | null;
  assigned_employee_id?: string | number | null;
  assigned_employee_name?: string | null;
  condition: string;
  status: string;
  location?: string | null;
  description?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface CompanyDocument {
  id: string | number;
  title: string;
  category: string;
  file_name?: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  is_public?: boolean | number;
  description?: string | null;
  uploaded_by_name?: string;
  created_at?: string;
}

export interface Document extends CompanyDocument {}

export interface Announcement {
  id: string | number;
  title: string;
  message?: string;
  content?: string;
  audience?: string;
  target_audience?: string;
  priority: string;
  start_date?: string;
  end_date?: string | null;
  publish_date?: string;
  expiry_date?: string | null;
  created_by_name?: string;
  created_at?: string;
}

export interface NotificationItem {
  id: string | number;
  user_id: string | number;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  is_read: boolean | number;
  created_at?: string;
}

export interface Meeting {
  id: string | number;
  title: string;
  project_id?: string | number | null;
  project_name?: string | null;
  client_id?: string | number | null;
  client_name?: string | null;
  date?: string;
  meeting_date?: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  meeting_url?: string | null;
  meeting_link?: string | null;
  agenda?: string | null;
  notes?: string | null;
  action_items?: string | null;
  organizer_name?: string;
  status?: string;
  participants?: any[];
  created_at?: string;
}

export interface CalendarEvent {
  id: string | number;
  title: string;
  date: string;
  time?: string;
  type: string;
  description?: string;
}

export interface CompanySettings {
  id?: string | number;
  company_name: string;
  company_email?: string;
  email?: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip_code?: string | null;
  postal_code?: string | null;
  logo_url?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  cin_number?: string | null;
  tax_number?: string | null;
  tax_id?: string | null;
  currency?: string;
  currency_symbol?: string;
  timezone?: string;
  date_format?: string;
  fiscal_year_start?: string;
  working_days_per_week?: number;
  standard_hours_per_day?: number;
  payroll_pay_date?: number;
}

export interface AuditLog {
  id: string | number;
  user_id?: string | number | null;
  user_email?: string | null;
  user_name?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string | number | null;
  module?: string;
  record_id?: string | null;
  details?: any;
  previous_value?: any;
  new_value?: any;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string;
}
