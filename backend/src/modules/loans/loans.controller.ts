import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listLoans(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as string || '';
    const employeeId = req.query.employeeId as string || '';

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (req.query.myLoans === 'true' && req.user?.employeeId) {
      whereClause += ' AND el.employee_id = ?';
      params.push(req.user.employeeId);
    } else if (employeeId) {
      whereClause += ' AND el.employee_id = ?';
      params.push(employeeId);
    }

    if (status) {
      whereClause += ' AND el.status = ?';
      params.push(status);
    }

    const loans = await query<any[]>(
      `SELECT el.*, 
              e.employee_id as employee_code,
              CONCAT(e.first_name, ' ', e.last_name) as employee_name,
              d.name as department_name
       FROM employee_loans el
       JOIN employees e ON el.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       ${whereClause}
       ORDER BY el.created_at DESC`,
      params
    );

    res.json({ success: true, data: loans });
  } catch (error) {
    next(error);
  }
}

export async function createLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const { employeeId, type, amount, totalTenureMonths, reason } = req.body;

    const targetEmpId = employeeId || req.user?.employeeId;
    if (!targetEmpId) throw new AppError('Employee ID required', 400);

    const parsedAmount = parseFloat(amount);
    const tenure = parseInt(totalTenureMonths || '1', 10);
    const emi = Math.round((parsedAmount / tenure) * 100) / 100;

    const loanId = `loan-${uuidv4()}`;
    await query(
      `INSERT INTO employee_loans (
        id, employee_id, type, amount, total_tenure_months, monthly_emi,
        paid_amount, remaining_balance, reason, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, ?, 'pending', NOW())`,
      [loanId, targetEmpId, type || 'loan', parsedAmount, tenure, emi, parsedAmount, reason || null]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'APPLY_LOAN',
      module: 'LOANS',
      recordId: loanId,
      newValue: { employeeId: targetEmpId, amount: parsedAmount, tenure },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Loan / Advance request submitted', data: { id: loanId } });
  } catch (error) {
    next(error);
  }
}

export async function reviewLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' (approved) or 'rejected'

    if (!['active', 'rejected', 'repaid'].includes(status)) {
      throw new AppError('Invalid loan status transition', 400);
    }

    await query(
      'UPDATE employee_loans SET status = ?, disbursed_at = IF(? = "active", CURDATE(), disbursed_at) WHERE id = ?',
      [status, status, id]
    );

    res.json({ success: true, message: `Loan ${status === 'active' ? 'approved' : status} successfully` });
  } catch (error) {
    next(error);
  }
}
