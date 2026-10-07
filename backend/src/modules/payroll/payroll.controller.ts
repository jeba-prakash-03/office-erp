import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';
import { sendSuccess, sendCreated } from '../../utils/response';

// Helper to resolve employee ID
async function resolveEmployeeId(req: Request): Promise<string | null> {
  if (req.user?.employeeId) return req.user.employeeId;
  if (req.user?.id) {
    const rows = await query<any[]>('SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', [req.user.id]);
    if (rows.length > 0) return rows[0].id;
  }
  return null;
}

// -----------------------------------------------------------------------------
// 1. SALARY COMPONENTS (CONFIGURABLE)
// -----------------------------------------------------------------------------

export async function listSalaryComponents(req: Request, res: Response, next: NextFunction) {
  try {
    const components = await query<any[]>('SELECT * FROM salary_components ORDER BY type ASC, name ASC');
    return sendSuccess(res, components);
  } catch (error) {
    next(error);
  }
}

export async function createSalaryComponent(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, type, calculationType, percentageOf, defaultValue, isTaxable, isStatutory, isActive, description } = req.body;
    if (!name || !type) throw new AppError('Name and type (earning/deduction) are required', 400);

    const id = `sc-${uuidv4().slice(0, 8)}`;
    await query(
      `INSERT INTO salary_components (id, name, type, calculation_type, percentage_of, default_value, is_taxable, is_statutory, is_active, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        name.trim(),
        type,
        calculationType || 'fixed',
        percentageOf || null,
        defaultValue || 0,
        isTaxable !== false ? 1 : 0,
        isStatutory ? 1 : 0,
        isActive !== false ? 1 : 0,
        description || null,
      ]
    );

    return sendCreated(res, { id, name }, 'Salary component created successfully');
  } catch (error) {
    next(error);
  }
}

export async function updateSalaryComponent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, type, calculationType, percentageOf, defaultValue, isTaxable, isStatutory, isActive, description } = req.body;

    await query(
      `UPDATE salary_components
       SET name = COALESCE(?, name),
           type = COALESCE(?, type),
           calculation_type = COALESCE(?, calculation_type),
           percentage_of = COALESCE(?, percentage_of),
           default_value = COALESCE(?, default_value),
           is_taxable = COALESCE(?, is_taxable),
           is_statutory = COALESCE(?, is_statutory),
           is_active = COALESCE(?, is_active),
           description = COALESCE(?, description),
           updated_at = NOW()
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        type || null,
        calculationType || null,
        percentageOf !== undefined ? percentageOf : null,
        defaultValue !== undefined ? defaultValue : null,
        isTaxable !== undefined ? (isTaxable ? 1 : 0) : null,
        isStatutory !== undefined ? (isStatutory ? 1 : 0) : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        description !== undefined ? description : null,
        id,
      ]
    );

    return sendSuccess(res, { id, updated: true }, undefined, 200, 'Salary component updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function deleteSalaryComponent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM salary_components WHERE id = ?', [id]);
    return sendSuccess(res, { id, deleted: true }, undefined, 200, 'Salary component deleted successfully');
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------------------------------------
// 2. EMPLOYEE SALARY STRUCTURE
// -----------------------------------------------------------------------------

export async function getEmployeeSalaryStructure(req: Request, res: Response, next: NextFunction) {
  try {
    const { employeeId } = req.params;
    const empRows = await query<any[]>('SELECT id, employee_id, first_name, last_name, basic_salary FROM employees WHERE id = ?', [employeeId]);
    if (empRows.length === 0) throw new AppError('Employee not found', 404);

    const components = await query<any[]>(
      `SELECT sc.*,
              COALESCE(ess.amount, sc.default_value) as assigned_amount,
              COALESCE(ess.percentage, 0) as assigned_percentage,
              COALESCE(ess.is_active, 1) as is_assigned
       FROM salary_components sc
       LEFT JOIN employee_salary_structures ess ON sc.id = ess.component_id AND ess.employee_id = ?
       WHERE sc.is_active = 1
       ORDER BY sc.type ASC, sc.name ASC`,
      [employeeId]
    );

    return sendSuccess(res, {
      employee: empRows[0],
      structure: components,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployeeSalaryStructure(req: Request, res: Response, next: NextFunction) {
  try {
    const { employeeId } = req.params;
    const { basicSalary, components } = req.body;

    if (basicSalary !== undefined) {
      await query('UPDATE employees SET basic_salary = ? WHERE id = ?', [basicSalary, employeeId]);
    }

    if (Array.isArray(components)) {
      for (const comp of components) {
        const { componentId, amount, percentage, isActive } = comp;
        const structId = `ess-${employeeId}-${componentId}`;
        await query(
          `INSERT INTO employee_salary_structures (id, employee_id, component_id, amount, percentage, is_active)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE amount = VALUES(amount), percentage = VALUES(percentage), is_active = VALUES(is_active)`,
          [structId, employeeId, componentId, amount || 0, percentage || 0, isActive !== false ? 1 : 0]
        );
      }
    }

    return sendSuccess(res, { employeeId, updated: true }, undefined, 200, 'Salary structure updated successfully');
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------------------------------------
// 3. CENTRALIZED PAYROLL CALCULATION ENGINE & RUNS
// -----------------------------------------------------------------------------

export async function listPayrollRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const year = parseInt(req.query.year as string || `${new Date().getFullYear()}`, 10);

    const runs = await query<any[]>(
      `SELECT pr.*,
              CONCAT(pu.first_name, ' ', pu.last_name) as processed_by_name,
              CONCAT(fu.first_name, ' ', fu.last_name) as finalized_by_name
       FROM payroll_runs pr
       LEFT JOIN users pu ON pr.processed_by_user_id = pu.id
       LEFT JOIN users fu ON pr.finalized_by_user_id = fu.id
       WHERE pr.year = ?
       ORDER BY pr.month DESC`,
      [year]
    );

    return sendSuccess(res, runs);
  } catch (error) {
    next(error);
  }
}

export async function getPayrollById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const runRows = await query<any[]>(
      `SELECT pr.*,
              CONCAT(pu.first_name, ' ', pu.last_name) as processed_by_name,
              CONCAT(fu.first_name, ' ', fu.last_name) as finalized_by_name
       FROM payroll_runs pr
       LEFT JOIN users pu ON pr.processed_by_user_id = pu.id
       LEFT JOIN users fu ON pr.finalized_by_user_id = fu.id
       WHERE pr.id = ?`,
      [id]
    );

    if (runRows.length === 0) throw new AppError('Payroll run not found', 404);
    const run = runRows[0];

    const records = await query<any[]>(
      `SELECT pr.*,
              e.employee_id as employee_code,
              CONCAT(e.first_name, ' ', e.last_name) as employee_name,
              e.designation,
              d.name as department_name,
              e.bank_name, e.bank_account_number, e.bank_ifsc, e.pan_number
       FROM payroll_records pr
       JOIN employees e ON pr.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE pr.payroll_run_id = ?
       ORDER BY e.first_name ASC`,
      [id]
    );

    return sendSuccess(res, {
      ...run,
      records,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/payroll/calculate
 * Centralized payroll calculation integrating attendance
 */
export async function calculateMonthlyPayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.body;
    if (!month || !year) throw new AppError('Month and year are required', 400);

    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

    // 1. Check if run exists and is locked
    const existingRun = await query<any[]>('SELECT * FROM payroll_runs WHERE month = ? AND year = ?', [month, year]);
    if (existingRun.length > 0 && existingRun[0].status === 'finalized') {
      throw new AppError('Payroll for this month has already been finalized and locked.', 400);
    }

    const runId = existingRun.length > 0 ? existingRun[0].id : `prun-${month}-${year}`;

    // 2. Fetch all active employees
    const employees = await query<any[]>(
      `SELECT e.id, e.employee_id, e.first_name, e.last_name, e.basic_salary, e.department_id
       FROM employees e
       WHERE e.deleted_at IS NULL AND e.employment_status = 'active'
       ORDER BY e.first_name ASC`
    );

    // 3. Fetch attendance records for this month
    const attendanceRows = await query<any[]>(
      `SELECT employee_id, status FROM attendance WHERE date BETWEEN ? AND ?`,
      [startDateStr, endDateStr]
    );

    const attSummary: Record<string, { present: number; absent: number; leave: number; halfDay: number; holiday: number; weekOff: number }> = {};
    for (const r of attendanceRows) {
      if (!attSummary[r.employee_id]) {
        attSummary[r.employee_id] = { present: 0, absent: 0, leave: 0, halfDay: 0, holiday: 0, weekOff: 0 };
      }
      if (r.status === 'present') attSummary[r.employee_id].present++;
      else if (r.status === 'absent') attSummary[r.employee_id].absent++;
      else if (r.status === 'leave') attSummary[r.employee_id].leave++;
      else if (r.status === 'half_day') attSummary[r.employee_id].halfDay++;
      else if (r.status === 'holiday') attSummary[r.employee_id].holiday++;
      else if (r.status === 'week_off') attSummary[r.employee_id].weekOff++;
    }

    // 4. Fetch salary components & structures
    const allComponents = await query<any[]>('SELECT * FROM salary_components WHERE is_active = 1');
    const allStructures = await query<any[]>('SELECT * FROM employee_salary_structures WHERE is_active = 1');

    const structMap: Record<string, any[]> = {};
    for (const s of allStructures) {
      if (!structMap[s.employee_id]) structMap[s.employee_id] = [];
      structMap[s.employee_id].push(s);
    }

    let totalGrossAll = 0;
    let totalDeductionsAll = 0;
    let totalNetAll = 0;
    const computedRecords: any[] = [];

    for (const emp of employees) {
      const baseSalary = Number(emp.basic_salary) || 0;
      const att = attSummary[emp.id] || { present: totalDaysInMonth - 8, absent: 0, leave: 0, halfDay: 0, holiday: 0, weekOff: 8 };

      const empStructures = structMap[emp.id] || [];
      const earningsBreakdown: any[] = [];
      const deductionsBreakdown: any[] = [];

      let grossEarnings = baseSalary;
      earningsBreakdown.push({ name: 'Basic Salary', type: 'earning', amount: baseSalary });

      // Calculate allowances
      for (const comp of allComponents.filter(c => c.type === 'earning' && !c.name.toLowerCase().includes('basic'))) {
        const assigned = empStructures.find(s => s.component_id === comp.id);
        let amount = 0;
        if (assigned) {
          if (comp.calculation_type === 'percentage') {
            amount = (baseSalary * Number(assigned.percentage)) / 100;
          } else {
            amount = Number(assigned.amount);
          }
        } else if (Number(comp.default_value) > 0) {
          amount = Number(comp.default_value);
        }
        if (amount > 0) {
          grossEarnings += amount;
          earningsBreakdown.push({ name: comp.name, type: 'earning', amount });
        }
      }

      // Loss of Pay (LOP) deduction based on attendance:
      // Absent days + (0.5 * half days)
      const perDaySalary = grossEarnings / totalDaysInMonth;
      const lopDays = att.absent + (att.halfDay * 0.5);
      const lopDeduction = Math.round(lopDays * perDaySalary);
      if (lopDeduction > 0) {
        deductionsBreakdown.push({ name: 'Loss of Pay (LOP)', type: 'deduction', amount: lopDeduction, days: lopDays });
      }

      // Calculate other deductions (PF, PT, ESI, TDS)
      let totalDeductions = lopDeduction;
      for (const comp of allComponents.filter(c => c.type === 'deduction')) {
        const assigned = empStructures.find(s => s.component_id === comp.id);
        let amount = 0;
        if (assigned) {
          if (comp.calculation_type === 'percentage') {
            if (comp.percentage_of?.toLowerCase().includes('gross')) {
              amount = (grossEarnings * Number(assigned.percentage)) / 100;
            } else {
              amount = (baseSalary * Number(assigned.percentage)) / 100;
            }
          } else {
            amount = Number(assigned.amount);
          }
        } else if (Number(comp.default_value) > 0) {
          amount = Number(comp.default_value);
        }
        if (amount > 0) {
          totalDeductions += amount;
          deductionsBreakdown.push({ name: comp.name, type: 'deduction', amount });
        }
      }

      const netSalary = Math.max(0, grossEarnings - totalDeductions);

      totalGrossAll += grossEarnings;
      totalDeductionsAll += totalDeductions;
      totalNetAll += netSalary;

      computedRecords.push({
        id: `prec-${runId}-${emp.id}`,
        payrollRunId: runId,
        employeeId: emp.id,
        basicSalary: baseSalary,
        grossSalary: grossEarnings,
        totalEarnings: grossEarnings,
        totalDeductions,
        netSalary,
        workingDays: totalDaysInMonth - att.weekOff - att.holiday,
        presentDays: att.present,
        absentDays: att.absent,
        leaveDays: att.leave,
        halfDays: att.halfDay,
        holidayDays: att.holiday,
        weekOffDays: att.weekOff,
        lossOfPayAmount: lopDeduction,
        breakdown: JSON.stringify({ earnings: earningsBreakdown, deductions: deductionsBreakdown }),
      });
    }

    // Save in Transaction
    await withTransaction(async (conn) => {
      // Upsert Payroll Run
      await conn.query(
        `INSERT INTO payroll_runs (id, month, year, total_gross, total_deductions, total_net, total_employees, status, processed_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'calculated', ?)
         ON DUPLICATE KEY UPDATE
           total_gross = VALUES(total_gross), total_deductions = VALUES(total_deductions),
           total_net = VALUES(total_net), total_employees = VALUES(total_employees),
           status = 'calculated', processed_by_user_id = VALUES(processed_by_user_id), updated_at = NOW()`,
        [runId, month, year, totalGrossAll, totalDeductionsAll, totalNetAll, employees.length, req.user!.id]
      );

      // Upsert Payroll Records
      for (const rec of computedRecords) {
        await conn.query(
          `INSERT INTO payroll_records (
            id, payroll_run_id, employee_id, basic_salary, gross_salary, total_earnings, total_deductions, net_salary,
            working_days, present_days, absent_days, leave_days, half_days, holiday_days, week_off_days, loss_of_pay_amount, breakdown
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            basic_salary = VALUES(basic_salary), gross_salary = VALUES(gross_salary),
            total_earnings = VALUES(total_earnings), total_deductions = VALUES(total_deductions),
            net_salary = VALUES(net_salary), working_days = VALUES(working_days),
            present_days = VALUES(present_days), absent_days = VALUES(absent_days),
            leave_days = VALUES(leave_days), half_days = VALUES(half_days),
            holiday_days = VALUES(holiday_days), week_off_days = VALUES(week_off_days),
            loss_of_pay_amount = VALUES(loss_of_pay_amount), breakdown = VALUES(breakdown), updated_at = NOW()`,
          [
            rec.id, rec.payrollRunId, rec.employeeId, rec.basicSalary, rec.grossSalary, rec.totalEarnings,
            rec.totalDeductions, rec.netSalary, rec.workingDays, rec.presentDays, rec.absentDays,
            rec.leaveDays, rec.halfDays, rec.holidayDays, rec.weekOffDays, rec.lossOfPayAmount, rec.breakdown
          ]
        );
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'PAYROLL_CALCULATE',
      module: 'PAYROLL',
      recordId: runId,
      newValue: { month, year, totalEmployees: employees.length, totalNet: totalNetAll },
      ipAddress: req.ip,
    });

    return sendSuccess(res, {
      id: runId,
      month,
      year,
      totalGross: totalGrossAll,
      totalDeductions: totalDeductionsAll,
      totalNet: totalNetAll,
      totalEmployees: employees.length,
      status: 'calculated',
    }, undefined, 200, 'Payroll calculation completed successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/payroll/finalize
 * Finalize payroll run and generate official payslips
 */
export async function finalizePayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.body;
    if (!id) throw new AppError('Payroll Run ID is required', 400);

    const runRows = await query<any[]>('SELECT * FROM payroll_runs WHERE id = ?', [id]);
    if (runRows.length === 0) throw new AppError('Payroll run not found', 404);

    const run = runRows[0];
    const records = await query<any[]>('SELECT * FROM payroll_records WHERE payroll_run_id = ?', [id]);

    await withTransaction(async (conn) => {
      // 1. Update run status to finalized
      await conn.query(
        `UPDATE payroll_runs
         SET status = 'finalized', finalized_by_user_id = ?, finalized_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [req.user!.id, id]
      );

      // 2. Generate Payslips
      for (const rec of records) {
        const empRows = await query<any[]>('SELECT employee_id, user_id FROM employees WHERE id = ?', [rec.employee_id]);
        const empCode = empRows[0]?.employee_id || rec.employee_id.slice(-6);
        const payslipNum = `PS-${run.year}${String(run.month).padStart(2, '0')}-${empCode}`;
        const psId = `ps-${rec.id}`;

        await conn.query(
          `INSERT INTO payslips (id, payroll_record_id, employee_id, payslip_number, month, year, generated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE generated_at = NOW()`,
          [psId, rec.id, rec.employee_id, payslipNum, run.month, run.year]
        );

        // Notify employee
        if (empRows[0]?.user_id) {
          await conn.query(
            `INSERT INTO notifications (id, user_id, title, message, type)
             VALUES (?, ?, 'Payslip Available', ?, 'info')`,
            [
              uuidv4(),
              empRows[0].user_id,
              `Your payslip for ${new Date(run.year, run.month - 1).toLocaleString('default', { month: 'long' })} ${run.year} is now available.`,
            ]
          );
        }
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'PAYROLL_FINALIZE',
      module: 'PAYROLL',
      recordId: id,
      newValue: { month: run.month, year: run.year, payslipsGenerated: records.length },
      ipAddress: req.ip,
    });

    return sendSuccess(res, { id, status: 'finalized', payslipsGenerated: records.length }, undefined, 200, 'Payroll finalized and payslips generated successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/payroll/reopen
 * Reopen finalized payroll (Super Admin / Admin only)
 */
export async function reopenPayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.body;
    if (!id) throw new AppError('Payroll Run ID is required', 400);

    await query(
      `UPDATE payroll_runs SET status = 'draft', finalized_by_user_id = NULL, finalized_at = NULL WHERE id = ?`,
      [id]
    );

    return sendSuccess(res, { id, status: 'draft' }, undefined, 200, 'Payroll run reopened for adjustments');
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------------------------------------
// 4. PAYSLIP VIEW & EMPLOYEE ACCESS
// -----------------------------------------------------------------------------

export async function getPayslip(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params; // payslip_id OR payroll_record_id

    const psRows = await query<any[]>(
      `SELECT ps.*,
              pr.basic_salary, pr.gross_salary, pr.total_earnings, pr.total_deductions, pr.net_salary,
              pr.working_days, pr.present_days, pr.absent_days, pr.leave_days, pr.half_days, pr.holiday_days, pr.week_off_days, pr.loss_of_pay_amount, pr.breakdown,
              pr.payment_status, pr.payment_date, pr.payment_method, pr.transaction_reference,
              e.employee_id as employee_code, CONCAT(e.first_name, ' ', e.last_name) as employee_name,
              e.designation, d.name as department_name, e.joining_date, e.pan_number,
              e.bank_name, e.bank_account_number, e.bank_ifsc,
              cs.company_name, cs.company_email, cs.phone as company_phone, cs.address as company_address, cs.currency_symbol
       FROM payslips ps
       JOIN payroll_records pr ON ps.payroll_record_id = pr.id
       JOIN employees e ON ps.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       CROSS JOIN company_settings cs
       WHERE ps.id = ? OR ps.payroll_record_id = ? OR ps.payslip_number = ?`,
      [id, id, id]
    );

    if (psRows.length === 0) throw new AppError('Payslip not found', 404);
    const payslip = psRows[0];

    // Authoritative Security Guard: If logged in as Employee, verify ownership!
    if (req.user?.roleName === 'employee') {
      const empId = await resolveEmployeeId(req);
      if (payslip.employee_id !== empId) {
        throw new AppError('Unauthorized: You can only view your own payslips', 403, 'FORBIDDEN_RESOURCE');
      }
    }

    if (typeof payslip.breakdown === 'string') {
      try {
        payslip.breakdown = JSON.parse(payslip.breakdown);
      } catch (e) {}
    }

    return sendSuccess(res, payslip);
  } catch (error) {
    next(error);
  }
}

export async function getMyPayslips(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) {
      throw new AppError('No employee profile associated with this account', 404);
    }

    const payslips = await query<any[]>(
      `SELECT ps.*, pr.gross_salary, pr.total_deductions, pr.net_salary, pr.payment_status
       FROM payslips ps
       JOIN payroll_records pr ON ps.payroll_record_id = pr.id
       WHERE ps.employee_id = ?
       ORDER BY ps.year DESC, ps.month DESC`,
      [employeeId]
    );

    return sendSuccess(res, payslips);
  } catch (error) {
    next(error);
  }
}
