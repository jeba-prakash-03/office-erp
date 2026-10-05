import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listPayrollRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const year = parseInt(req.query.year as string || `${new Date().getFullYear()}`, 10);

    const payrollRuns = await query<any[]>(
      `SELECT p.*, 
              CONCAT(pu.first_name, ' ', pu.last_name) as processed_by_name,
              CONCAT(au.first_name, ' ', au.last_name) as approved_by_name
       FROM payroll p
       LEFT JOIN users pu ON p.processed_by_user_id = pu.id
       LEFT JOIN users au ON p.approved_by_user_id = au.id
       WHERE p.year = ?
       ORDER BY p.month DESC`,
      [year]
    );

    res.json({ success: true, data: payrollRuns });
  } catch (error) {
    next(error);
  }
}

export async function getPayrollById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const runRows = await query<any[]>(
      `SELECT p.*, 
              CONCAT(pu.first_name, ' ', pu.last_name) as processed_by_name,
              CONCAT(au.first_name, ' ', au.last_name) as approved_by_name
       FROM payroll p
       LEFT JOIN users pu ON p.processed_by_user_id = pu.id
       LEFT JOIN users au ON p.approved_by_user_id = au.id
       WHERE p.id = ?`,
      [id]
    );

    if (runRows.length === 0) throw new AppError('Payroll run not found', 404);

    const items = await query<any[]>(
      `SELECT pi.*, 
              e.employee_id as employee_code,
              CONCAT(e.first_name, ' ', e.last_name) as employee_name,
              e.designation,
              d.name as department_name,
              e.bank_name, e.bank_account_number, e.bank_ifsc, e.pan_number
       FROM payroll_items pi
       JOIN employees e ON pi.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE pi.payroll_id = ?
       ORDER BY e.first_name ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...runRows[0],
        items,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function processMonthlyPayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.body;
    if (!month || !year) throw new AppError('Month and year are required', 400);

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    // Check if payroll run exists
    const existing = await query<any[]>('SELECT * FROM payroll WHERE month = ? AND year = ?', [m, y]);
    if (existing.length > 0 && ['approved', 'paid', 'locked'].includes(existing[0].status)) {
      throw new AppError(`Cannot reprocess payroll. Payroll for ${m}/${y} is already ${existing[0].status}.`, 400);
    }

    const payrollId = existing.length > 0 ? existing[0].id : `pr-${uuidv4()}`;

    // Get active employees
    const employees = await query<any[]>(
      `SELECT e.*, ss.hra, ss.special_allowance, ss.medical_allowance, ss.conveyance_allowance,
              ss.provident_fund, ss.esi, ss.professional_tax, ss.income_tax_tds
       FROM employees e
       LEFT JOIN salary_structures ss ON ss.employee_id = e.id
       WHERE e.employment_status = 'active' AND e.deleted_at IS NULL`
    );

    if (employees.length === 0) {
      throw new AppError('No active employees found to generate payroll.', 400);
    }

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const payrollItemsToInsert: any[] = [];

    const daysInMonth = new Date(y, m, 0).getDate();

    for (const emp of employees) {
      const basicSalary = parseFloat(emp.basic_salary || '0');
      const hra = parseFloat(emp.hra || (basicSalary * 0.4).toFixed(2));
      const special = parseFloat(emp.special_allowance || '0');
      const medical = parseFloat(emp.medical_allowance || '0');
      const conveyance = parseFloat(emp.conveyance_allowance || '0');
      const totalAllowances = hra + special + medical + conveyance;

      // Attendance for the month
      const attRows = await query<any[]>(
        `SELECT COUNT(*) as present_count,
                COALESCE(SUM(overtime_hours), 0) as total_overtime
         FROM attendance 
         WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ? AND status IN ('present', 'late', 'half_day')`,
        [emp.id, m, y]
      );
      const presentDays = parseFloat(attRows[0]?.present_count || '0');
      const otHours = parseFloat(attRows[0]?.total_overtime || '0');
      const hourlyRate = basicSalary / (daysInMonth * 8);
      const overtimeAmount = Math.round(otHours * hourlyRate * 1.5 * 100) / 100;

      // Unpaid leave days
      const unpaidRows = await query<any[]>(
        `SELECT COALESCE(SUM(lr.total_days), 0) as unpaid_days
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = ? AND MONTH(lr.start_date) = ? AND YEAR(lr.start_date) = ? 
               AND lr.status = 'approved' AND lt.is_paid = 0`,
        [emp.id, m, y]
      );
      const unpaidLeaveDays = parseFloat(unpaidRows[0]?.unpaid_days || '0');
      const perDaySalary = basicSalary / daysInMonth;
      const unpaidDeductions = Math.round(unpaidLeaveDays * perDaySalary * 100) / 100;

      // Active Loans / Advances EMI
      const loanRows = await query<any[]>(
        `SELECT COALESCE(SUM(monthly_emi), 0) as total_emi
         FROM employee_loans 
         WHERE employee_id = ? AND status = 'active' AND remaining_balance > 0`,
        [emp.id]
      );
      const loanDeduction = parseFloat(loanRows[0]?.total_emi || '0');

      // Statutory deductions
      const pfDeduction = parseFloat(emp.provident_fund || (basicSalary * 0.12).toFixed(2));
      const esiDeduction = parseFloat(emp.esi || '0');
      const ptDeduction = parseFloat(emp.professional_tax || '200');
      const tdsDeduction = parseFloat(emp.income_tax_tds || '0');
      const taxDeductions = ptDeduction + tdsDeduction;

      const grossSalary = basicSalary + totalAllowances + overtimeAmount;
      const totalEmpDeductions = pfDeduction + esiDeduction + taxDeductions + unpaidDeductions + loanDeduction;
      const netSalary = Math.max(0, grossSalary - totalEmpDeductions);

      totalGross += grossSalary;
      totalDeductions += totalEmpDeductions;
      totalNet += netSalary;

      payrollItemsToInsert.push({
        id: uuidv4(),
        payrollId,
        employeeId: emp.id,
        basicSalary,
        allowances: totalAllowances,
        bonus: 0,
        overtimeAmount,
        unpaidLeaveDeductions: unpaidDeductions,
        taxDeductions,
        pfDeductions: pfDeduction,
        esiDeductions: esiDeduction,
        loanDeductions: loanDeduction,
        otherDeductions: 0,
        grossSalary,
        netSalary,
        workingDays: daysInMonth,
        presentDays,
        unpaidLeaveDays,
        overtimeHours: otHours,
      });
    }

    await withTransaction(async (conn) => {
      // Upsert payroll header
      await conn.query(
        `INSERT INTO payroll (id, month, year, total_gross, total_deductions, total_net, total_employees, status, processed_by_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, NOW())
         ON DUPLICATE KEY UPDATE 
           total_gross = VALUES(total_gross),
           total_deductions = VALUES(total_deductions),
           total_net = VALUES(total_net),
           total_employees = VALUES(total_employees),
           processed_by_user_id = VALUES(processed_by_user_id)`,
        [payrollId, m, y, totalGross, totalDeductions, totalNet, employees.length, req.user!.id]
      );

      // Delete old draft items if reprocessing
      await conn.query('DELETE FROM payroll_items WHERE payroll_id = ?', [payrollId]);

      // Insert fresh calculated payroll items
      for (const item of payrollItemsToInsert) {
        await conn.query(
          `INSERT INTO payroll_items (
            id, payroll_id, employee_id, basic_salary, allowances, bonus, overtime_amount,
            unpaid_leave_deductions, tax_deductions, pf_deductions, esi_deductions,
            loan_deductions, other_deductions, gross_salary, net_salary, working_days,
            present_days, unpaid_leave_days, overtime_hours, payment_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', NOW())`,
          [
            item.id, item.payrollId, item.employeeId, item.basicSalary, item.allowances, item.bonus,
            item.overtimeAmount, item.unpaidLeaveDeductions, item.taxDeductions, item.pfDeductions,
            item.esiDeductions, item.loanDeductions, item.otherDeductions, item.grossSalary, item.netSalary,
            item.workingDays, item.presentDays, item.unpaidLeaveDays, item.overtimeHours
          ]
        );
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'PROCESS_PAYROLL',
      module: 'PAYROLL',
      recordId: payrollId,
      newValue: { month: m, year: y, totalNet, totalEmployees: employees.length },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Payroll processed successfully for ${m}/${y}. Total Net: $${totalNet.toLocaleString()}`,
      data: { payrollId },
    });
  } catch (error) {
    next(error);
  }
}

export async function approvePayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const runRows = await query<any[]>('SELECT * FROM payroll WHERE id = ?', [id]);
    if (runRows.length === 0) throw new AppError('Payroll run not found', 404);

    const run = runRows[0];
    if (run.status === 'locked' || run.status === 'approved') {
      throw new AppError(`Payroll run is already ${run.status}`, 400);
    }

    await withTransaction(async (conn) => {
      await conn.query(
        'UPDATE payroll SET status = "approved", approved_by_user_id = ? WHERE id = ?',
        [req.user!.id, id]
      );

      // Also create an expense record under Salaries category for total payroll
      const expCategory = await conn.query('SELECT id FROM expense_categories WHERE name LIKE "%Salaries%" OR name LIKE "%Payroll%" LIMIT 1');
      const catRows = expCategory[0] as any[];
      const catId = catRows[0]?.id || 'exp-cat-misc';

      const expCode = `EXP-PAY-${run.month}-${run.year}`;
      await conn.query(
        `INSERT INTO expenses (id, expense_code, category_id, amount, date, vendor, payment_method, description, status, added_by_user_id, approved_by_user_id, created_at)
         VALUES (?, ?, ?, ?, CURDATE(), 'Internal Payroll', 'Bank Transfer', ?, 'approved', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
        [uuidv4(), expCode, catId, run.total_net, `Monthly Salary Distribution for ${run.month}/${run.year}`, req.user!.id, req.user!.id]
      );

      // Notify all active employees
      const users = await conn.query('SELECT user_id FROM employees WHERE employment_status = "active" AND deleted_at IS NULL AND user_id IS NOT NULL');
      const userList = users[0] as any[];
      for (const u of userList) {
        await conn.query(
          `INSERT INTO notifications (id, user_id, title, message, type, link, created_at)
           VALUES (?, ?, 'Payroll Approved', ?, 'payroll', '/payroll', NOW())`,
          [uuidv4(), u.user_id, `Your payslip for ${run.month}/${run.year} is now available.`]
        );
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'APPROVE_PAYROLL',
      module: 'PAYROLL',
      recordId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Payroll approved and locked successfully' });
  } catch (error) {
    next(error);
  }
}

export async function markPayrollPaid(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { paymentMethod, transactionReference } = req.body;

    await withTransaction(async (conn) => {
      await conn.query(
        'UPDATE payroll SET status = "paid", paid_at = NOW() WHERE id = ?',
        [id]
      );
      await conn.query(
        `UPDATE payroll_items 
         SET payment_status = 'paid', payment_date = CURDATE(), payment_method = ?, transaction_reference = ?
         WHERE payroll_id = ?`,
        [paymentMethod || 'Bank Transfer', transactionReference || null, id]
      );
    });

    res.json({ success: true, message: 'Payroll marked as paid' });
  } catch (error) {
    next(error);
  }
}

export async function getPayslip(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;

    const itemRows = await query<any[]>(
      `SELECT pi.*, 
              p.month, p.year, p.status as payroll_status,
              e.employee_id as employee_code,
              CONCAT(e.first_name, ' ', e.last_name) as employee_name,
              e.email as employee_email,
              e.designation,
              e.joining_date,
              d.name as department_name,
              e.bank_name, e.bank_account_number, e.bank_ifsc, e.pan_number, e.tax_id
       FROM payroll_items pi
       JOIN payroll p ON pi.payroll_id = p.id
       JOIN employees e ON pi.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE pi.id = ?`,
      [itemId]
    );

    if (itemRows.length === 0) throw new AppError('Payslip item not found', 404);

    const item = itemRows[0];

    // Employee isolation check
    if (req.user?.roleName === 'employee' && req.user?.employeeId !== item.employee_id) {
      throw new AppError('Forbidden: You can only view your own payslips', 403);
    }

    // Company settings
    const companySettings = await query<any[]>('SELECT * FROM company_settings LIMIT 1');

    res.json({
      success: true,
      data: {
        payslip: item,
        company: companySettings[0] || {},
      },
    });
  } catch (error) {
    next(error);
  }
}
