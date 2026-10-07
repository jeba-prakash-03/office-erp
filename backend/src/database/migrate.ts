import { pool } from '../config/db';
import { logger } from '../utils/logger';

export async function runMigrations() {
  logger.info('Starting OfficeERP database schema migrations...');

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
      tax_id VARCHAR(50),
      currency VARCHAR(10) DEFAULT 'INR',
      currency_symbol VARCHAR(10) DEFAULT '₹',
      timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
      working_days_per_week INT DEFAULT 5,
      standard_hours_per_day DECIMAL(4,2) DEFAULT 8.00,
      payroll_pay_date INT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 2. Roles (Strictly 3 Canonical Roles: super_admin, admin, employee)
    `CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT TRUE,
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
      google_id VARCHAR(191) UNIQUE,
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

    // 6. User Sessions & Refresh Tokens
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      device VARCHAR(100),
      last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS login_history (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      status ENUM('success', 'failed') NOT NULL,
      reason VARCHAR(255),
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
      basic_salary DECIMAL(12,2) DEFAULT 0.00,
      bank_name VARCHAR(100),
      bank_account_number VARCHAR(100),
      bank_ifsc VARCHAR(50),
      pan_number VARCHAR(50),
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

    // 9. Employee Documents
    `CREATE TABLE IF NOT EXISTS employee_documents (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      document_type VARCHAR(100),
      file_url VARCHAR(500) NOT NULL,
      file_size BIGINT,
      mime_type VARCHAR(100),
      uploaded_by VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 10. Attendance Months (Locking mechanism: draft vs finalized)
    `CREATE TABLE IF NOT EXISTS attendance_months (
      id VARCHAR(100) PRIMARY KEY,
      month INT NOT NULL,
      year INT NOT NULL,
      status ENUM('draft', 'finalized') DEFAULT 'draft',
      finalized_by_user_id VARCHAR(100),
      finalized_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_att_month_year (month, year),
      FOREIGN KEY (finalized_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 11. Attendance Records (One per employee per date: P, A, L, HD, H, WO)
    `CREATE TABLE IF NOT EXISTS attendance (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      status ENUM('present', 'absent', 'leave', 'half_day', 'holiday', 'week_off') NOT NULL DEFAULT 'present',
      notes TEXT,
      created_by_user_id VARCHAR(100),
      updated_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_emp_att_date (employee_id, date),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 12. Holidays
    `CREATE TABLE IF NOT EXISTS holidays (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      date DATE NOT NULL,
      description VARCHAR(255),
      is_optional BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 13. Leave Types (Configurable)
    `CREATE TABLE IF NOT EXISTS leave_types (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      days_allowed_per_year DECIMAL(4,1) DEFAULT 12.0,
      is_paid BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 14. Leave Balances
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
      UNIQUE KEY uk_emp_leave_yr (employee_id, leave_type_id, year),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 15. Leave Requests
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

    // 16. Configurable Salary Components
    `CREATE TABLE IF NOT EXISTS salary_components (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      type ENUM('earning', 'deduction') NOT NULL,
      calculation_type ENUM('fixed', 'percentage') DEFAULT 'fixed',
      percentage_of VARCHAR(50),
      default_value DECIMAL(12,2) DEFAULT 0.00,
      is_taxable BOOLEAN DEFAULT TRUE,
      is_statutory BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 17. Employee Salary Structures
    `CREATE TABLE IF NOT EXISTS employee_salary_structures (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      component_id VARCHAR(100) NOT NULL,
      amount DECIMAL(12,2) DEFAULT 0.00,
      percentage DECIMAL(5,2) DEFAULT 0.00,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_emp_salary_comp (employee_id, component_id),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (component_id) REFERENCES salary_components(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 18. Payroll Runs (Monthly: Draft -> Calculated -> Review -> Finalized)
    `CREATE TABLE IF NOT EXISTS payroll_runs (
      id VARCHAR(100) PRIMARY KEY,
      month INT NOT NULL,
      year INT NOT NULL,
      total_gross DECIMAL(14,2) DEFAULT 0.00,
      total_deductions DECIMAL(14,2) DEFAULT 0.00,
      total_net DECIMAL(14,2) DEFAULT 0.00,
      total_employees INT DEFAULT 0,
      status ENUM('draft', 'calculated', 'review', 'finalized') DEFAULT 'draft',
      processed_by_user_id VARCHAR(100),
      finalized_by_user_id VARCHAR(100),
      finalized_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_payroll_run_my (month, year),
      FOREIGN KEY (processed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (finalized_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 19. Payroll Records (One per employee per run)
    `CREATE TABLE IF NOT EXISTS payroll_records (
      id VARCHAR(100) PRIMARY KEY,
      payroll_run_id VARCHAR(100) NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      gross_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      net_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      working_days INT DEFAULT 0,
      present_days DECIMAL(4,1) DEFAULT 0.0,
      absent_days DECIMAL(4,1) DEFAULT 0.0,
      leave_days DECIMAL(4,1) DEFAULT 0.0,
      half_days DECIMAL(4,1) DEFAULT 0.0,
      holiday_days DECIMAL(4,1) DEFAULT 0.0,
      week_off_days DECIMAL(4,1) DEFAULT 0.0,
      loss_of_pay_amount DECIMAL(12,2) DEFAULT 0.00,
      breakdown JSON,
      payment_status ENUM('unpaid', 'paid') DEFAULT 'unpaid',
      payment_date DATE,
      payment_method VARCHAR(50),
      transaction_reference VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_payroll_rec_emp (payroll_run_id, employee_id),
      FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 20. Payslips
    `CREATE TABLE IF NOT EXISTS payslips (
      id VARCHAR(100) PRIMARY KEY,
      payroll_record_id VARCHAR(100) UNIQUE NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      payslip_number VARCHAR(50) UNIQUE NOT NULL,
      month INT NOT NULL,
      year INT NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_url VARCHAR(500),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payroll_record_id) REFERENCES payroll_records(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 21. Finance - Income
    `CREATE TABLE IF NOT EXISTS income (
      id VARCHAR(100) PRIMARY KEY,
      income_code VARCHAR(50) UNIQUE NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      client_id VARCHAR(100),
      amount DECIMAL(14,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      reference VARCHAR(100),
      attachment_url VARCHAR(500),
      notes TEXT,
      date DATE NOT NULL,
      created_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 22. Finance - Expenses
    `CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(100) PRIMARY KEY,
      expense_code VARCHAR(50) UNIQUE NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      vendor VARCHAR(150),
      amount DECIMAL(14,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      reference VARCHAR(100),
      attachment_url VARCHAR(500),
      notes TEXT,
      date DATE NOT NULL,
      created_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 23. Finance - Invoices
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
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 24. Finance - Invoice Items
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id VARCHAR(100) PRIMARY KEY,
      invoice_id VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      quantity DECIMAL(8,2) NOT NULL DEFAULT 1.00,
      unit_price DECIMAL(12,2) NOT NULL,
      total_price DECIMAL(14,2) NOT NULL,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 25. Finance - Payments
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
      FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 26. SUPER ADMIN ONLY - Investments
    `CREATE TABLE IF NOT EXISTS investments (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100) NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      date DATE NOT NULL,
      source VARCHAR(150),
      current_value DECIMAL(14,2) NOT NULL,
      return_rate DECIMAL(5,2) DEFAULT 0.00,
      status ENUM('active', 'matured', 'divested', 'pending') DEFAULT 'active',
      notes TEXT,
      document_url VARCHAR(500),
      created_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 27. CRM - Clients
    `CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(100) PRIMARY KEY,
      client_code VARCHAR(50) UNIQUE NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(150) NOT NULL,
      email VARCHAR(191) NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      industry VARCHAR(100),
      status ENUM('active', 'inactive') DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 28. CRM - Leads
    `CREATE TABLE IF NOT EXISTS leads (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      company VARCHAR(255),
      email VARCHAR(191),
      phone VARCHAR(50),
      source VARCHAR(100),
      estimated_value DECIMAL(12,2) DEFAULT 0.00,
      stage ENUM('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost') DEFAULT 'new',
      next_follow_up DATE,
      notes TEXT,
      assigned_employee_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 29. Work - Projects
    `CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(100) PRIMARY KEY,
      project_code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      client_id VARCHAR(100),
      description TEXT,
      start_date DATE NOT NULL,
      end_date DATE,
      budget DECIMAL(14,2) DEFAULT 0.00,
      status ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled') DEFAULT 'planning',
      priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
      project_manager_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (project_manager_id) REFERENCES employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 30. Work - Project Members
    `CREATE TABLE IF NOT EXISTS project_members (
      project_id VARCHAR(100) NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      role VARCHAR(100) DEFAULT 'Member',
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (project_id, employee_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 31. Work - Tasks
    `CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(100) PRIMARY KEY,
      task_code VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      project_id VARCHAR(100) NOT NULL,
      assigned_employee_id VARCHAR(100),
      priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
      status ENUM('todo', 'in_progress', 'review', 'completed', 'blocked') DEFAULT 'todo',
      start_date DATE,
      due_date DATE,
      estimated_hours DECIMAL(6,2) DEFAULT 0.00,
      actual_hours DECIMAL(6,2) DEFAULT 0.00,
      completed_at DATETIME,
      created_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 32. Work - Task Comments
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

    // 33. Work - Timesheets
    `CREATE TABLE IF NOT EXISTS timesheets (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      project_id VARCHAR(100) NOT NULL,
      task_id VARCHAR(100),
      date DATE NOT NULL,
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

    // 34. Performance Cycles & Reviews
    `CREATE TABLE IF NOT EXISTS performance_cycles (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      period VARCHAR(50) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status ENUM('active', 'completed', 'closed') DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS performance_reviews (
      id VARCHAR(100) PRIMARY KEY,
      cycle_id VARCHAR(100) NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      reviewer_id VARCHAR(100) NOT NULL,
      task_completion_rating DECIMAL(3,1) DEFAULT 0.0,
      quality_rating DECIMAL(3,1) DEFAULT 0.0,
      productivity_rating DECIMAL(3,1) DEFAULT 0.0,
      attendance_rating DECIMAL(3,1) DEFAULT 0.0,
      communication_rating DECIMAL(3,1) DEFAULT 0.0,
      teamwork_rating DECIMAL(3,1) DEFAULT 0.0,
      technical_rating DECIMAL(3,1) DEFAULT 0.0,
      overall_score DECIMAL(3,1) NOT NULL DEFAULT 0.0,
      strengths TEXT,
      areas_for_improvement TEXT,
      goals_for_next_period TEXT,
      manager_feedback TEXT,
      employee_self_review TEXT,
      status ENUM('draft', 'submitted', 'acknowledged') DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS performance_goals (
      id VARCHAR(100) PRIMARY KEY,
      review_id VARCHAR(100),
      employee_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      target_date DATE,
      status ENUM('pending', 'in_progress', 'achieved', 'missed') DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 35. Documents Management
    `CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category ENUM('employees', 'clients', 'projects', 'invoices', 'expenses', 'company', 'other') DEFAULT 'company',
      file_url VARCHAR(500) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_size BIGINT,
      mime_type VARCHAR(100),
      entity_type VARCHAR(50),
      entity_id VARCHAR(100),
      uploaded_by_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 36. Notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'info',
      link VARCHAR(500),
      is_read BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 37. Audit Logs
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100),
      user_email VARCHAR(191),
      user_name VARCHAR(150),
      action VARCHAR(100) NOT NULL,
      module VARCHAR(50) NOT NULL,
      record_id VARCHAR(100),
      previous_value JSON,
      new_value JSON,
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_module (module),
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const sql of schemaStatements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      if (!err.message?.includes('already exists') && !err.message?.includes('Duplicate foreign key')) {
        logger.warn(`Migration statement warning: ${err.message}`);
      }
    }
  }

  logger.info('OfficeERP database schema migrations completed successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed:', err);
      process.exit(1);
    });
}
