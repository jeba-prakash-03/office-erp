import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listEmployees(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const search = req.query.search as string || '';
    const departmentId = req.query.departmentId as string || '';
    const employmentStatus = req.query.employmentStatus as string || '';
    const employmentType = req.query.employmentType as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE e.deleted_at IS NULL';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.employee_id LIKE ? OR e.designation LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (departmentId) {
      whereClause += ' AND e.department_id = ?';
      params.push(departmentId);
    }
    if (employmentStatus) {
      whereClause += ' AND e.employment_status = ?';
      params.push(employmentStatus);
    }
    if (employmentType) {
      whereClause += ' AND e.employment_type = ?';
      params.push(employmentType);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM employees e ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT e.*, 
             d.name as department_name,
             r.name as role_name, r.display_name as role_display_name,
             CONCAT(m.first_name, ' ', m.last_name) as reporting_manager_name,
             u.status as user_account_status
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN roles r ON e.role_id = r.id
      LEFT JOIN employees m ON e.reporting_manager_id = m.id
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const employees = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const empRows = await query<any[]>(
      `SELECT e.*, 
              d.name as department_name,
              r.name as role_name, r.display_name as role_display_name,
              CONCAT(m.first_name, ' ', m.last_name) as reporting_manager_name,
              m.email as reporting_manager_email,
              u.status as user_account_status
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN roles r ON e.role_id = r.id
       LEFT JOIN employees m ON e.reporting_manager_id = m.id
       LEFT JOIN users u ON e.user_id = u.id
       WHERE (e.id = ? OR e.user_id = ?) AND e.deleted_at IS NULL`,
      [id, id]
    );

    if (empRows.length === 0) {
      throw new AppError('Employee not found', 404);
    }

    const employee = empRows[0];
    const employeeId = employee.id;

    // Fetch tab details in parallel:
    // 1. Documents
    const documents = await query<any[]>(
      'SELECT * FROM employee_documents WHERE employee_id = ? ORDER BY created_at DESC',
      [employeeId]
    );

    // 2. Salary Structure
    const salaryStructure = await query<any[]>(
      'SELECT * FROM salary_structures WHERE employee_id = ?',
      [employeeId]
    );

    // 3. Leave Balances for current year
    const currentYear = new Date().getFullYear();
    const leaveBalances = await query<any[]>(
      `SELECT lb.*, lt.name as leave_type_name, lt.is_paid
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.employee_id = ? AND lb.year = ?`,
      [employeeId, currentYear]
    );

    // 4. Recent Leave Requests
    const leaveRequests = await query<any[]>(
      `SELECT lr.*, lt.name as leave_type_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.employee_id = ?
       ORDER BY lr.created_at DESC
       LIMIT 10`,
      [employeeId]
    );

    // 5. Recent Attendance (Last 30 days)
    const attendance = await query<any[]>(
      `SELECT * FROM attendance 
       WHERE employee_id = ? 
       ORDER BY date DESC 
       LIMIT 30`,
      [employeeId]
    );

    // 6. Recent Tasks
    const tasks = await query<any[]>(
      `SELECT t.*, p.name as project_name
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.assigned_employee_id = ?
       ORDER BY t.created_at DESC
       LIMIT 10`,
      [employeeId]
    );

    // 7. Assigned Projects
    const projects = await query<any[]>(
      `SELECT p.*, pm.role as project_role
       FROM project_members pm
       JOIN projects p ON pm.project_id = p.id
       WHERE pm.employee_id = ?
       ORDER BY p.created_at DESC`,
      [employeeId]
    );

    // 8. Performance Reviews
    const performanceReviews = await query<any[]>(
      `SELECT pr.*, CONCAT(r.first_name, ' ', r.last_name) as reviewer_name
       FROM performance_reviews pr
       JOIN employees r ON pr.reviewer_id = r.id
       WHERE pr.employee_id = ?
       ORDER BY pr.created_at DESC`,
      [employeeId]
    );

    // 9. Payslips
    const payslips = await query<any[]>(
      `SELECT pi.*, p.month, p.year, p.status as payroll_status
       FROM payroll_items pi
       JOIN payroll p ON pi.payroll_id = p.id
       WHERE pi.employee_id = ?
       ORDER BY p.year DESC, p.month DESC
       LIMIT 12`,
      [employeeId]
    );

    res.json({
      success: true,
      data: {
        ...employee,
        documents,
        salaryStructure: salaryStructure[0] || null,
        leaveBalances,
        leaveRequests,
        attendance,
        tasks,
        projects,
        performanceReviews,
        payslips,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.body.employeeId || req.body.employee_id || req.body.employeeCode || req.body.employee_code;
    const firstName = req.body.firstName || req.body.first_name;
    const lastName = req.body.lastName || req.body.last_name;
    const email = req.body.email;
    const phone = req.body.phone;
    const dateOfBirth = req.body.dateOfBirth || req.body.date_of_birth;
    const gender = req.body.gender || 'male';
    const profilePhoto = req.body.profilePhoto || req.body.profile_photo;
    const address = req.body.address || req.body.residential_address;
    const emergencyContactName = req.body.emergencyContactName || req.body.emergency_contact_name;
    const emergencyContactPhone = req.body.emergencyContactPhone || req.body.emergency_contact_phone;
    const emergencyContactRelation = req.body.emergencyContactRelation || req.body.emergency_contact_relation;
    const departmentId = req.body.departmentId || req.body.department_id || null;
    const designation = req.body.designation;
    const roleId = req.body.roleId || req.body.role_id || 'role-employee';
    const joiningDate = req.body.joiningDate || req.body.joining_date;
    const employmentType = req.body.employmentType || req.body.employment_type || 'full_time';
    const employmentStatus = req.body.employmentStatus || req.body.employment_status || 'active';
    const reportingManagerId = req.body.reportingManagerId || req.body.reporting_manager_id || null;
    const basicSalary = req.body.basicSalary || req.body.basic_salary || req.body.salary || 0;
    const bankName = req.body.bankName || req.body.bank_name;
    const bankAccountNumber = req.body.bankAccountNumber || req.body.bank_account_number;
    const bankIfsc = req.body.bankIfsc || req.body.bank_ifsc;
    const panNumber = req.body.panNumber || req.body.pan_number;
    const identityNumber = req.body.identityNumber || req.body.identity_number;
    const taxId = req.body.taxId || req.body.tax_id;
    const skills = req.body.skills;
    const experienceYears = req.body.experienceYears || req.body.experience_years || 0;
    const notes = req.body.notes;
    const createUserAccount = req.body.createUserAccount !== undefined ? req.body.createUserAccount : true;
    const password = req.body.password;

    if (!employeeId || !firstName || !lastName || !email || !designation || !joiningDate) {
      throw new AppError('Employee ID, First Name, Last Name, Email, Designation, and Joining Date are required', 400);
    }

    // Check unique employee_id and email
    const existingEmp = await query<any[]>(
      'SELECT id FROM employees WHERE (employee_id = ? OR email = ?) AND deleted_at IS NULL',
      [String(employeeId).trim(), String(email).toLowerCase().trim()]
    );
    if (existingEmp.length > 0) {
      throw new AppError('An employee with this Employee ID or Email already exists', 409);
    }

    const newEmpId = `emp-${uuidv4()}`;
    let createdUserId: string | null = null;

    await withTransaction(async (conn) => {
      // Create user account if requested or default
      if (createUserAccount !== false) {
        const existingUser = await conn.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        const userRows = existingUser[0] as any[];

        if (userRows.length > 0) {
          createdUserId = userRows[0].id;
        } else {
          createdUserId = `usr-${uuidv4()}`;
          const defaultPassword = password || 'Employee@123';
          const salt = await bcrypt.genSalt(10);
          const hash = await bcrypt.hash(defaultPassword, salt);
          const targetRoleId = roleId || 'role-employee';

          await conn.query(
            `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, phone, email_verified, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 1, NOW())`,
            [createdUserId, email.toLowerCase().trim(), hash, firstName, lastName, targetRoleId, phone || null]
          );
        }
      }

      // Insert Employee Record
      await conn.query(
        `INSERT INTO employees (
          id, user_id, employee_id, first_name, last_name, email, phone, date_of_birth,
          gender, profile_photo, address, emergency_contact_name, emergency_contact_phone,
          emergency_contact_relation, department_id, designation, role_id, joining_date,
          employment_type, employment_status, reporting_manager_id, basic_salary,
          bank_name, bank_account_number, bank_ifsc, pan_number, identity_number,
          tax_id, skills, experience_years, notes, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, NOW()
        )`,
        [
          newEmpId, createdUserId, employeeId.trim(), firstName.trim(), lastName.trim(),
          email.toLowerCase().trim(), phone || null, dateOfBirth || null,
          gender || 'undisclosed', profilePhoto || null, address || null,
          emergencyContactName || null, emergencyContactPhone || null, emergencyContactRelation || null,
          departmentId || null, designation.trim(), roleId || 'role-employee', joiningDate,
          employmentType || 'full_time', employmentStatus || 'active', reportingManagerId || null,
          basicSalary || 0.00, bankName || null, bankAccountNumber || null, bankIfsc || null,
          panNumber || null, identityNumber || null, taxId || null, skills || null,
          experienceYears || 0.0, notes || null
        ]
      );

      // Create initial salary structure
      const parsedBasic = parseFloat(basicSalary || '0');
      const hra = parsedBasic * 0.4;
      const pf = parsedBasic * 0.12;
      const pt = 200.00;

      await conn.query(
        `INSERT INTO salary_structures (
          id, employee_id, basic_salary, hra, special_allowance, medical_allowance,
          conveyance_allowance, provident_fund, esi, professional_tax, income_tax_tds, created_at
        ) VALUES (?, ?, ?, ?, 0, 0, 0, ?, 0, ?, 0, NOW())`,
        [`sal-str-${uuidv4()}`, newEmpId, parsedBasic, hra, pf, pt]
      );

      // Allocate initial leave balances for the year
      const currentYear = new Date().getFullYear();
      const [leaveTypeRows] = await conn.query('SELECT * FROM leave_types');
      const types = leaveTypeRows as any[];

      for (const lt of types) {
        await conn.query(
          `INSERT INTO leave_balances (id, employee_id, leave_type_id, year, total_days, used_days, pending_days, remaining_days, created_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?, NOW())`,
          [uuidv4(), newEmpId, lt.id, currentYear, lt.days_allowed_per_year, lt.days_allowed_per_year]
        );
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_EMPLOYEE',
      module: 'EMPLOYEES',
      recordId: newEmpId,
      newValue: { employeeId, firstName, lastName, email, departmentId, designation },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully with account, leave balances, and salary structure.',
      data: { id: newEmpId },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const {
      firstName, lastName, phone, dateOfBirth, gender, profilePhoto, address,
      emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      departmentId, designation, roleId, joiningDate, employmentType, employmentStatus,
      reportingManagerId, basicSalary, bankName, bankAccountNumber, bankIfsc,
      panNumber, identityNumber, taxId, skills, experienceYears, notes,
      salaryStructure
    } = req.body;

    const existing = await query<any[]>('SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL', [id]);
    if (existing.length === 0) throw new AppError('Employee not found', 404);

    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE employees 
         SET first_name = COALESCE(?, first_name),
             last_name = COALESCE(?, last_name),
             phone = COALESCE(?, phone),
             date_of_birth = COALESCE(?, date_of_birth),
             gender = COALESCE(?, gender),
             profile_photo = COALESCE(?, profile_photo),
             address = COALESCE(?, address),
             emergency_contact_name = COALESCE(?, emergency_contact_name),
             emergency_contact_phone = COALESCE(?, emergency_contact_phone),
             emergency_contact_relation = COALESCE(?, emergency_contact_relation),
             department_id = ?,
             designation = COALESCE(?, designation),
             role_id = COALESCE(?, role_id),
             joining_date = COALESCE(?, joining_date),
             employment_type = COALESCE(?, employment_type),
             employment_status = COALESCE(?, employment_status),
             reporting_manager_id = ?,
             basic_salary = COALESCE(?, basic_salary),
             bank_name = COALESCE(?, bank_name),
             bank_account_number = COALESCE(?, bank_account_number),
             bank_ifsc = COALESCE(?, bank_ifsc),
             pan_number = COALESCE(?, pan_number),
             identity_number = COALESCE(?, identity_number),
             tax_id = COALESCE(?, tax_id),
             skills = COALESCE(?, skills),
             experience_years = COALESCE(?, experience_years),
             notes = COALESCE(?, notes)
         WHERE id = ?`,
        [
          firstName, lastName, phone, dateOfBirth, gender, profilePhoto, address,
          emergencyContactName, emergencyContactPhone, emergencyContactRelation,
          departmentId || null, designation, roleId, joiningDate, employmentType, employmentStatus,
          reportingManagerId || null, basicSalary, bankName, bankAccountNumber, bankIfsc,
          panNumber, identityNumber, taxId, skills, experienceYears, notes, id
        ]
      );

      // Also update linked user first/last name and role if linked
      if (existing[0].user_id) {
        await conn.query(
          `UPDATE users 
           SET first_name = COALESCE(?, first_name),
               last_name = COALESCE(?, last_name),
               phone = COALESCE(?, phone),
               role_id = COALESCE(?, role_id)
           WHERE id = ?`,
          [firstName, lastName, phone, roleId, existing[0].user_id]
        );
      }

      // Update Salary Structure if provided
      if (salaryStructure) {
        await conn.query(
          `INSERT INTO salary_structures (
            id, employee_id, basic_salary, hra, special_allowance, medical_allowance,
            conveyance_allowance, provident_fund, esi, professional_tax, income_tax_tds
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            basic_salary = VALUES(basic_salary),
            hra = VALUES(hra),
            special_allowance = VALUES(special_allowance),
            medical_allowance = VALUES(medical_allowance),
            conveyance_allowance = VALUES(conveyance_allowance),
            provident_fund = VALUES(provident_fund),
            esi = VALUES(esi),
            professional_tax = VALUES(professional_tax),
            income_tax_tds = VALUES(income_tax_tds)`,
          [
            uuidv4(), id,
            salaryStructure.basicSalary || basicSalary || 0,
            salaryStructure.hra || 0,
            salaryStructure.specialAllowance || 0,
            salaryStructure.medicalAllowance || 0,
            salaryStructure.conveyanceAllowance || 0,
            salaryStructure.providentFund || 0,
            salaryStructure.esi || 0,
            salaryStructure.professionalTax || 0,
            salaryStructure.incomeTaxTds || 0,
          ]
        );
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_EMPLOYEE',
      module: 'EMPLOYEES',
      recordId: id,
      previousValue: existing[0],
      newValue: req.body,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = await query<any[]>('SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL', [id]);
    if (existing.length === 0) throw new AppError('Employee not found', 404);

    await withTransaction(async (conn) => {
      await conn.query('UPDATE employees SET deleted_at = NOW(), employment_status = "terminated" WHERE id = ?', [id]);
      if (existing[0].user_id) {
        await conn.query('UPDATE users SET status = "inactive" WHERE id = ?', [existing[0].user_id]);
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'DELETE_EMPLOYEE',
      module: 'EMPLOYEES',
      recordId: id,
      previousValue: existing[0],
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Employee deactivated and removed from active roster successfully.' });
  } catch (error) {
    next(error);
  }
}

export async function addEmployeeDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { title, documentType, expiryDate } = req.body;
    const file = req.file;

    if (!file) throw new AppError('File upload is required', 400);
    if (!title) throw new AppError('Document title is required', 400);

    const fileUrl = `/uploads/${file.filename}`;
    const docId = `doc-${uuidv4()}`;

    await query(
      `INSERT INTO employee_documents (id, employee_id, title, document_type, file_url, file_size, mime_type, expiry_date, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [docId, id, title, documentType || 'Other', fileUrl, file.size, file.mimetype, expiryDate || null, req.user?.id || null]
    );

    res.status(201).json({
      success: true,
      message: 'Employee document uploaded successfully',
      data: { id: docId, fileUrl },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteEmployeeDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { docId } = req.params;
    await query('DELETE FROM employee_documents WHERE id = ?', [docId]);
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
}
