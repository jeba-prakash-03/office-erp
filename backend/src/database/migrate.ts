import { pool, query } from '../config/db';
import { logger } from '../utils/logger';

export async function runMigrations() {
  logger.info('Starting database migrations...');

  const schemaStatements = [
    // 1. Company Settings
    `CREATE TABLE IF NOT EXISTS company_settings (
      id VARCHAR(100) PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      company_email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      website VARCHAR(255),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100),
      postal_code VARCHAR(20),
      logo_url VARCHAR(500),
      gst_number VARCHAR(50),
      pan_number VARCHAR(50),
      cin_number VARCHAR(50),
      tax_id VARCHAR(50),
      currency VARCHAR(10) DEFAULT 'USD',
      currency_symbol VARCHAR(10) DEFAULT '$',
      timezone VARCHAR(50) DEFAULT 'UTC',
      working_days_per_week INT DEFAULT 5,
      standard_hours_per_day DECIMAL(4,2) DEFAULT 8.00,
      payroll_pay_date INT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 2. Roles
    `CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 3. Permissions
    `CREATE TABLE IF NOT EXISTS permissions (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      module VARCHAR(50) NOT NULL,
      description VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 4. Role Permissions
    `CREATE TABLE IF NOT EXISTS role_permissions (
      role_id VARCHAR(100) NOT NULL,
      permission_id VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 5. Users
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      email VARCHAR(191) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      role_id VARCHAR(100) NOT NULL,
      status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
      avatar_url VARCHAR(500),
      phone VARCHAR(50),
      email_verified BOOLEAN DEFAULT FALSE,
      refresh_token VARCHAR(500),
      last_login_at DATETIME,
      last_login_ip VARCHAR(50),
      failed_login_attempts INT DEFAULT 0,
      locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 6. Login History
    `CREATE TABLE IF NOT EXISTS login_history (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      status ENUM('success', 'failed') NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 7. Departments
    `CREATE TABLE IF NOT EXISTS departments (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      manager_id VARCHAR(100),
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 8. Employees
    `CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) UNIQUE,
      employee_id VARCHAR(50) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(191) UNIQUE NOT NULL,
      phone VARCHAR(50),
      date_of_birth DATE,
      gender ENUM('male', 'female', 'other', 'undisclosed') DEFAULT 'undisclosed',
      profile_photo VARCHAR(500),
      address TEXT,
      emergency_contact_name VARCHAR(100),
      emergency_contact_phone VARCHAR(50),
      emergency_contact_relation VARCHAR(50),
      department_id VARCHAR(100),
      designation VARCHAR(100) NOT NULL,
      role_id VARCHAR(100),
      joining_date DATE NOT NULL,
      employment_type ENUM('full_time', 'part_time', 'contract', 'intern') DEFAULT 'full_time',
      employment_status ENUM('active', 'probation', 'notice_period', 'terminated', 'resigned') DEFAULT 'active',
      reporting_manager_id VARCHAR(100),
      basic_salary DECIMAL(12,2) DEFAULT 0.00,
      bank_name VARCHAR(100),
      bank_account_number VARCHAR(100),
      bank_ifsc VARCHAR(50),
      pan_number VARCHAR(50),
      identity_number VARCHAR(100),
      tax_id VARCHAR(50),
      skills TEXT,
      experience_years DECIMAL(4,1) DEFAULT 0.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Add manager foreign key constraint to departments after employees table is created
    `ALTER TABLE departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;`,

    // 9. Employee Documents
    `CREATE TABLE IF NOT EXISTS employee_documents (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      document_type VARCHAR(100),
      file_url VARCHAR(500) NOT NULL,
      file_size BIGINT,
      mime_type VARCHAR(100),
      expiry_date DATE,
      uploaded_by VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 10. Clients
    `CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(100) PRIMARY KEY,
      client_code VARCHAR(50) UNIQUE NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(150) NOT NULL,
      email VARCHAR(191) NOT NULL,
      phone VARCHAR(50),
      website VARCHAR(255),
      address TEXT,
      industry VARCHAR(100),
      gst_number VARCHAR(50),
      tax_number VARCHAR(50),
      status ENUM('active', 'inactive', 'lead') DEFAULT 'active',
      assigned_sales_rep_id VARCHAR(100),
      user_id VARCHAR(100),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_sales_rep_id) REFERENCES employees(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 11. Client Contacts
    `CREATE TABLE IF NOT EXISTS client_contacts (
      id VARCHAR(100) PRIMARY KEY,
      client_id VARCHAR(100) NOT NULL,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(191),
      phone VARCHAR(50),
      designation VARCHAR(100),
      is_primary BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 12. Leads
    `CREATE TABLE IF NOT EXISTS leads (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      company VARCHAR(255),
      email VARCHAR(191),
      phone VARCHAR(50),
      source VARCHAR(100),
      assigned_employee_id VARCHAR(100),
      stage ENUM('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost') DEFAULT 'new',
      priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
      estimated_value DECIMAL(12,2) DEFAULT 0.00,
      expected_closing_date DATE,
      converted_to_client_id VARCHAR(100),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
      FOREIGN KEY (converted_to_client_id) REFERENCES clients(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 13. Projects
    `CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(100) PRIMARY KEY,
      project_code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      client_id VARCHAR(100),
      description TEXT,
      project_manager_id VARCHAR(100),
      start_date DATE NOT NULL,
      end_date DATE,
      budget DECIMAL(14,2) DEFAULT 0.00,
      status ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled') DEFAULT 'planning',
      priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
      technology TEXT,
      repository_url VARCHAR(500),
      production_url VARCHAR(500),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (project_manager_id) REFERENCES employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 14. Project Members
    `CREATE TABLE IF NOT EXISTS project_members (
      project_id VARCHAR(100) NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      role VARCHAR(100) DEFAULT 'Member',
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (project_id, employee_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 15. Tasks
    `CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(100) PRIMARY KEY,
      task_code VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      project_id VARCHAR(100) NOT NULL,
      client_id VARCHAR(100),
      assigned_employee_id VARCHAR(100),
      created_by_user_id VARCHAR(100),
      priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
      status ENUM('backlog', 'todo', 'in_progress', 'review', 'blocked', 'completed') DEFAULT 'todo',
      due_date DATE,
      estimated_hours DECIMAL(6,2) DEFAULT 0.00,
      actual_hours DECIMAL(6,2) DEFAULT 0.00,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 16. Task Comments
    `CREATE TABLE IF NOT EXISTS task_comments (
      id VARCHAR(100) PRIMARY KEY,
      task_id VARCHAR(100) NOT NULL,
      user_id VARCHAR(100) NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 17. Task Attachments
    `CREATE TABLE IF NOT EXISTS task_attachments (
      id VARCHAR(100) PRIMARY KEY,
      task_id VARCHAR(100) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_size BIGINT,
      mime_type VARCHAR(100),
      uploaded_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 18. Task Checklists
    `CREATE TABLE IF NOT EXISTS task_checklists (
      id VARCHAR(100) PRIMARY KEY,
      task_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 19. Attendance
    `CREATE TABLE IF NOT EXISTS attendance (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      check_in DATETIME,
      check_out DATETIME,
      break_minutes INT DEFAULT 0,
      total_hours DECIMAL(5,2) DEFAULT 0.00,
      overtime_hours DECIMAL(5,2) DEFAULT 0.00,
      status ENUM('present', 'absent', 'late', 'half_day', 'leave', 'holiday', 'week_off') DEFAULT 'present',
      ip_address VARCHAR(50),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_employee_attendance_date (employee_id, date),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 20. Attendance Corrections
    `CREATE TABLE IF NOT EXISTS attendance_corrections (
      id VARCHAR(100) PRIMARY KEY,
      attendance_id VARCHAR(100),
      employee_id VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      requested_check_in DATETIME NOT NULL,
      requested_check_out DATETIME NOT NULL,
      reason TEXT NOT NULL,
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      approved_by_user_id VARCHAR(100),
      reviewer_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 21. Leave Types
    `CREATE TABLE IF NOT EXISTS leave_types (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      days_allowed_per_year DECIMAL(4,1) DEFAULT 12.0,
      is_paid BOOLEAN DEFAULT TRUE,
      requires_attachment BOOLEAN DEFAULT FALSE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 22. Leave Balances
    `CREATE TABLE IF NOT EXISTS leave_balances (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      leave_type_id VARCHAR(100) NOT NULL,
      year INT NOT NULL,
      total_days DECIMAL(4,1) NOT NULL,
      used_days DECIMAL(4,1) DEFAULT 0.0,
      pending_days DECIMAL(4,1) DEFAULT 0.0,
      remaining_days DECIMAL(4,1) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_emp_leave_year (employee_id, leave_type_id, year),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 23. Leave Requests
    `CREATE TABLE IF NOT EXISTS leave_requests (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      leave_type_id VARCHAR(100) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_days DECIMAL(4,1) NOT NULL,
      reason TEXT NOT NULL,
      attachment_url VARCHAR(500),
      status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
      approved_by_user_id VARCHAR(100),
      reviewer_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 24. Salary Components
    `CREATE TABLE IF NOT EXISTS salary_components (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      type ENUM('earning', 'deduction') NOT NULL,
      calculation_type ENUM('fixed', 'percentage') DEFAULT 'fixed',
      percentage_of VARCHAR(50),
      default_value DECIMAL(10,2) DEFAULT 0.00,
      is_taxable BOOLEAN DEFAULT TRUE,
      is_statutory BOOLEAN DEFAULT FALSE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 25. Salary Structures
    `CREATE TABLE IF NOT EXISTS salary_structures (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) UNIQUE NOT NULL,
      basic_salary DECIMAL(12,2) NOT NULL,
      hra DECIMAL(12,2) DEFAULT 0.00,
      special_allowance DECIMAL(12,2) DEFAULT 0.00,
      medical_allowance DECIMAL(12,2) DEFAULT 0.00,
      conveyance_allowance DECIMAL(12,2) DEFAULT 0.00,
      provident_fund DECIMAL(12,2) DEFAULT 0.00,
      esi DECIMAL(12,2) DEFAULT 0.00,
      professional_tax DECIMAL(12,2) DEFAULT 0.00,
      income_tax_tds DECIMAL(12,2) DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 26. Employee Loans
    `CREATE TABLE IF NOT EXISTS employee_loans (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      type ENUM('loan', 'advance') DEFAULT 'loan',
      amount DECIMAL(12,2) NOT NULL,
      total_tenure_months INT DEFAULT 1,
      monthly_emi DECIMAL(12,2) NOT NULL,
      paid_amount DECIMAL(12,2) DEFAULT 0.00,
      remaining_balance DECIMAL(12,2) NOT NULL,
      reason TEXT,
      status ENUM('pending', 'approved', 'rejected', 'active', 'repaid') DEFAULT 'pending',
      disbursed_at DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 27. Payroll
    `CREATE TABLE IF NOT EXISTS payroll (
      id VARCHAR(100) PRIMARY KEY,
      month INT NOT NULL,
      year INT NOT NULL,
      total_gross DECIMAL(14,2) DEFAULT 0.00,
      total_deductions DECIMAL(14,2) DEFAULT 0.00,
      total_net DECIMAL(14,2) DEFAULT 0.00,
      total_employees INT DEFAULT 0,
      status ENUM('draft', 'processing', 'pending_approval', 'approved', 'paid', 'locked') DEFAULT 'draft',
      processed_by_user_id VARCHAR(100),
      approved_by_user_id VARCHAR(100),
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_payroll_month_year (month, year),
      FOREIGN KEY (processed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 28. Payroll Items
    `CREATE TABLE IF NOT EXISTS payroll_items (
      id VARCHAR(100) PRIMARY KEY,
      payroll_id VARCHAR(100) NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      basic_salary DECIMAL(12,2) NOT NULL,
      allowances DECIMAL(12,2) DEFAULT 0.00,
      bonus DECIMAL(12,2) DEFAULT 0.00,
      overtime_amount DECIMAL(12,2) DEFAULT 0.00,
      unpaid_leave_deductions DECIMAL(12,2) DEFAULT 0.00,
      tax_deductions DECIMAL(12,2) DEFAULT 0.00,
      pf_deductions DECIMAL(12,2) DEFAULT 0.00,
      esi_deductions DECIMAL(12,2) DEFAULT 0.00,
      loan_deductions DECIMAL(12,2) DEFAULT 0.00,
      other_deductions DECIMAL(12,2) DEFAULT 0.00,
      gross_salary DECIMAL(12,2) NOT NULL,
      net_salary DECIMAL(12,2) NOT NULL,
      working_days INT DEFAULT 0,
      present_days DECIMAL(4,1) DEFAULT 0.0,
      unpaid_leave_days DECIMAL(4,1) DEFAULT 0.0,
      overtime_hours DECIMAL(5,2) DEFAULT 0.00,
      payment_status ENUM('unpaid', 'paid') DEFAULT 'unpaid',
      payment_date DATE,
      payment_method VARCHAR(50),
      transaction_reference VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_payroll_employee (payroll_id, employee_id),
      FOREIGN KEY (payroll_id) REFERENCES payroll(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 29. Performance Reviews
    `CREATE TABLE IF NOT EXISTS performance_reviews (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      reviewer_id VARCHAR(100) NOT NULL,
      cycle ENUM('monthly', 'quarterly', 'half_yearly', 'yearly') NOT NULL,
      period VARCHAR(50) NOT NULL,
      task_completion_rating DECIMAL(3,1) DEFAULT 0.0,
      quality_rating DECIMAL(3,1) DEFAULT 0.0,
      productivity_rating DECIMAL(3,1) DEFAULT 0.0,
      attendance_rating DECIMAL(3,1) DEFAULT 0.0,
      communication_rating DECIMAL(3,1) DEFAULT 0.0,
      teamwork_rating DECIMAL(3,1) DEFAULT 0.0,
      technical_rating DECIMAL(3,1) DEFAULT 0.0,
      overall_score DECIMAL(3,1) NOT NULL,
      manager_feedback TEXT,
      strengths TEXT,
      areas_for_improvement TEXT,
      goals TEXT,
      status ENUM('draft', 'submitted', 'acknowledged') DEFAULT 'submitted',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 30. Timesheets
    `CREATE TABLE IF NOT EXISTS timesheets (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      project_id VARCHAR(100) NOT NULL,
      task_id VARCHAR(100),
      date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      hours DECIMAL(5,2) NOT NULL,
      description TEXT NOT NULL,
      is_billable BOOLEAN DEFAULT TRUE,
      status ENUM('submitted', 'approved', 'rejected') DEFAULT 'submitted',
      approved_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 31. Incomes
    `CREATE TABLE IF NOT EXISTS incomes (
      id VARCHAR(100) PRIMARY KEY,
      income_code VARCHAR(50) UNIQUE NOT NULL,
      client_id VARCHAR(100),
      invoice_id VARCHAR(100),
      project_id VARCHAR(100),
      category ENUM('client_payment', 'project_payment', 'service_revenue', 'consulting', 'other') DEFAULT 'service_revenue',
      amount DECIMAL(14,2) NOT NULL,
      date DATE NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      reference_number VARCHAR(100),
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 32. Expense Categories
    `CREATE TABLE IF NOT EXISTS expense_categories (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 33. Expenses
    `CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(100) PRIMARY KEY,
      expense_code VARCHAR(50) UNIQUE NOT NULL,
      category_id VARCHAR(100) NOT NULL,
      project_id VARCHAR(100),
      amount DECIMAL(14,2) NOT NULL,
      date DATE NOT NULL,
      vendor VARCHAR(150),
      payment_method VARCHAR(50) NOT NULL,
      description TEXT,
      receipt_url VARCHAR(500),
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
      added_by_user_id VARCHAR(100) NOT NULL,
      approved_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 34. Invoices
    `CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(100) PRIMARY KEY,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      client_id VARCHAR(100) NOT NULL,
      project_id VARCHAR(100),
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      subtotal DECIMAL(14,2) NOT NULL,
      discount_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
      discount_value DECIMAL(10,2) DEFAULT 0.00,
      tax_rate DECIMAL(5,2) DEFAULT 0.00,
      tax_amount DECIMAL(14,2) DEFAULT 0.00,
      grand_total DECIMAL(14,2) NOT NULL,
      paid_amount DECIMAL(14,2) DEFAULT 0.00,
      remaining_balance DECIMAL(14,2) NOT NULL,
      status ENUM('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
      notes TEXT,
      terms TEXT,
      created_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 35. Invoice Items
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id VARCHAR(100) PRIMARY KEY,
      invoice_id VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      quantity DECIMAL(8,2) NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      total_price DECIMAL(14,2) NOT NULL,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 36. Payments
    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(100) PRIMARY KEY,
      payment_number VARCHAR(50) UNIQUE NOT NULL,
      invoice_id VARCHAR(100) NOT NULL,
      client_id VARCHAR(100) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      transaction_reference VARCHAR(100),
      notes TEXT,
      recorded_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 37. Assets
    `CREATE TABLE IF NOT EXISTS assets (
      id VARCHAR(100) PRIMARY KEY,
      asset_code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      category ENUM('laptop', 'desktop', 'monitor', 'mobile', 'peripheral', 'license', 'other') NOT NULL,
      serial_number VARCHAR(150),
      purchase_date DATE,
      purchase_cost DECIMAL(12,2) DEFAULT 0.00,
      warranty_expiry_date DATE,
      assigned_employee_id VARCHAR(100),
      status ENUM('available', 'assigned', 'repair', 'lost', 'disposed') DEFAULT 'available',
      location VARCHAR(150),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 38. Asset Assignments
    `CREATE TABLE IF NOT EXISTS asset_assignments (
      id VARCHAR(100) PRIMARY KEY,
      asset_id VARCHAR(100) NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      assigned_at DATE NOT NULL,
      returned_at DATE,
      condition_on_assignment VARCHAR(255),
      condition_on_return VARCHAR(255),
      assigned_by_user_id VARCHAR(100),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 39. Documents
    `CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category ENUM('company', 'employee', 'client', 'project', 'invoice', 'legal', 'policy', 'other') DEFAULT 'company',
      file_url VARCHAR(500) NOT NULL,
      file_size BIGINT,
      mime_type VARCHAR(100),
      entity_type VARCHAR(50),
      entity_id VARCHAR(100),
      version VARCHAR(20) DEFAULT '1.0',
      expiry_date DATE,
      uploaded_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 40. Announcements
    `CREATE TABLE IF NOT EXISTS announcements (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      audience VARCHAR(50) DEFAULT 'all',
      priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
      publish_date DATE NOT NULL,
      expiry_date DATE,
      created_by_user_id VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 41. Notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      link VARCHAR(500),
      is_read BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 42. Meetings
    `CREATE TABLE IF NOT EXISTS meetings (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      project_id VARCHAR(100),
      client_id VARCHAR(100),
      meeting_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      location VARCHAR(255),
      meeting_link VARCHAR(500),
      notes TEXT,
      action_items TEXT,
      created_by_user_id VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 43. Meeting Participants
    `CREATE TABLE IF NOT EXISTS meeting_participants (
      meeting_id VARCHAR(100) NOT NULL,
      user_id VARCHAR(100) NOT NULL,
      PRIMARY KEY (meeting_id, user_id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 44. Holidays
    `CREATE TABLE IF NOT EXISTS holidays (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      date DATE NOT NULL,
      description VARCHAR(255),
      is_optional BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 45. Audit Logs
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100),
      user_email VARCHAR(191),
      user_name VARCHAR(150),
      action VARCHAR(100) NOT NULL,
      module VARCHAR(50) NOT NULL,
      record_id VARCHAR(50),
      previous_value JSON,
      new_value JSON,
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_module (module),
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 46. Approval Requests
    `CREATE TABLE IF NOT EXISTS approval_requests (
      id VARCHAR(100) PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      requester_id VARCHAR(100) NOT NULL,
      current_approver_id VARCHAR(100),
      status ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled', 'returned') NOT NULL DEFAULT 'pending',
      submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      decided_at DATETIME,
      decided_by_user_id VARCHAR(100),
      comments TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_approval_entity (entity_type, entity_id),
      INDEX idx_approval_requester (requester_id),
      INDEX idx_approval_approver (current_approver_id),
      INDEX idx_approval_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 47. Approval History
    `CREATE TABLE IF NOT EXISTS approval_history (
      id VARCHAR(100) PRIMARY KEY,
      request_id VARCHAR(100) NOT NULL,
      action ENUM('submit', 'approve', 'reject', 'cancel', 'return', 'reassign') NOT NULL,
      actor_user_id VARCHAR(100) NOT NULL,
      actor_role VARCHAR(50),
      previous_status VARCHAR(50) NOT NULL,
      new_status VARCHAR(50) NOT NULL,
      remarks TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_history_request (request_id),
      INDEX idx_history_actor (actor_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const sql of schemaStatements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      // Ignore duplicate FK constraint error if migration runs repeatedly
      if (!err.message?.includes('already exists') && !err.message?.includes('Duplicate foreign key')) {
        logger.warn(`Migration statement warning: ${err.message}`);
      }
    }
  }

  logger.info('Database migrations completed successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration run directly finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed:', err);
      process.exit(1);
    });
}
