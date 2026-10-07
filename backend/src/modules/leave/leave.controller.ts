import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';
import { sendSuccess, sendCreated } from '../../utils/response';

// Helper to resolve employee ID
async function resolveEmployeeId(req: Request): Promise<string | null> {
  if (req.user?.employeeId) return req.user.employeeId;
  const bodyOrQuery = req.body?.employee_id || req.body?.employeeId || req.query?.employee_id || req.query?.employeeId;
  if (bodyOrQuery) return String(bodyOrQuery);
  if (req.user?.id) {
    const rows = await query<any[]>('SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', [req.user.id]);
    if (rows.length > 0) return rows[0].id;
  }
  return null;
}

/**
 * GET /api/leave/types
 * List configurable leave types
 */
export async function listLeaveTypes(req: Request, res: Response, next: NextFunction) {
  try {
    const types = await query<any[]>('SELECT * FROM leave_types ORDER BY name ASC');
    return sendSuccess(res, types);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/leave/types
 * Create new configurable leave type
 */
export async function createLeaveType(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, daysAllowedPerYear, isPaid, isActive, description } = req.body;
    if (!name) throw new AppError('Leave type name is required', 400);

    const id = `lt-${uuidv4().slice(0, 8)}`;
    await query(
      `INSERT INTO leave_types (id, name, days_allowed_per_year, is_paid, is_active, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, name.trim(), daysAllowedPerYear || 12, isPaid !== false ? 1 : 0, isActive !== false ? 1 : 0, description || null]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_LEAVE_TYPE',
      module: 'LEAVE',
      recordId: id,
      newValue: { name, daysAllowedPerYear, isPaid },
      ipAddress: req.ip,
    });

    return sendCreated(res, { id, name }, 'Leave type created successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/leave/types/:id
 * Update configurable leave type
 */
export async function updateLeaveType(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, daysAllowedPerYear, isPaid, isActive, description } = req.body;

    await query(
      `UPDATE leave_types
       SET name = COALESCE(?, name),
           days_allowed_per_year = COALESCE(?, days_allowed_per_year),
           is_paid = COALESCE(?, is_paid),
           is_active = COALESCE(?, is_active),
           description = COALESCE(?, description),
           updated_at = NOW()
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        daysAllowedPerYear !== undefined ? daysAllowedPerYear : null,
        isPaid !== undefined ? (isPaid ? 1 : 0) : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        description !== undefined ? description : null,
        id,
      ]
    );

    return sendSuccess(res, { id, updated: true }, undefined, 200, 'Leave type updated successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/leave/types/:id
 * Delete leave type
 */
export async function deleteLeaveType(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM leave_types WHERE id = ?', [id]);
    return sendSuccess(res, { id, deleted: true }, undefined, 200, 'Leave type deleted successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/leave/balances
 * Get leave balances for an employee or all employees
 */
export async function getLeaveBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedEmpId = req.query.employeeId as string || req.query.employee_id as string;
    let employeeId = requestedEmpId;

    if (!employeeId || req.user?.roleName === 'employee') {
      employeeId = await resolveEmployeeId(req) || '';
    }

    const year = parseInt(req.query.year as string || `${new Date().getFullYear()}`, 10);

    if (!employeeId) {
      return sendSuccess(res, []);
    }

    // Auto-initialize missing leave balances from active leave_types if needed
    const types = await query<any[]>('SELECT id, name, days_allowed_per_year, is_paid FROM leave_types WHERE is_active = 1');
    for (const lt of types) {
      await query(
        `INSERT IGNORE INTO leave_balances (id, employee_id, leave_type_id, year, total_days, used_days, pending_days, remaining_days)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
        [`lb-${employeeId}-${lt.id}-${year}`, employeeId, lt.id, year, lt.days_allowed_per_year, lt.days_allowed_per_year]
      );
    }

    const balances = await query<any[]>(
      `SELECT lb.*, lt.name as leave_type_name, lt.is_paid, lt.description
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.employee_id = ? AND lb.year = ?
       ORDER BY lt.name ASC`,
      [employeeId, year]
    );

    return sendSuccess(res, balances);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/leave/apply
 * Employee applies for leave
 */
export async function applyLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const leaveTypeId = req.body.leaveTypeId || req.body.leave_type_id;
    const startDate = req.body.startDate || req.body.start_date;
    const endDate = req.body.endDate || req.body.end_date;
    const reason = req.body.reason;
    const attachmentUrl = req.body.attachmentUrl || req.body.attachment_url;
    let employeeId = await resolveEmployeeId(req);

    if (req.body.employeeId && req.user?.roleName !== 'employee') {
      employeeId = req.body.employeeId;
    }

    if (!employeeId) {
      throw new AppError('No employee profile associated with this account', 400);
    }

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      throw new AppError('Leave type, start date, end date, and reason are required', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      throw new AppError('End date cannot be earlier than start date', 400);
    }

    // Calculate business days
    let totalDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) { // exclude Sat/Sun
        totalDays++;
      }
    }
    if (totalDays === 0) totalDays = 1;

    const year = start.getFullYear();

    // Check balance
    const balanceRows = await query<any[]>(
      'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
      [employeeId, leaveTypeId, year]
    );

    if (balanceRows.length > 0) {
      const remaining = Number(balanceRows[0].remaining_days);
      const pending = Number(balanceRows[0].pending_days);
      if (remaining - pending < totalDays) {
        throw new AppError(`Insufficient leave balance. Available: ${remaining - pending} days, Requested: ${totalDays} days.`, 400, 'INSUFFICIENT_LEAVE_BALANCE');
      }
    }

    const requestId = `lr-${uuidv4().slice(0, 8)}`;

    await withTransaction(async (conn) => {
      // Insert leave request
      await conn.query(
        `INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, attachment_url, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [requestId, employeeId, leaveTypeId, startDate, endDate, totalDays, reason, attachmentUrl || null]
      );

      // Increase pending days in balance
      await conn.query(
        `UPDATE leave_balances
         SET pending_days = pending_days + ?
         WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
        [totalDays, employeeId, leaveTypeId, year]
      );
    });

    // Notify admins
    const adminUsers = await query<any[]>('SELECT id FROM users WHERE role_id IN ("role-super-admin", "role-admin")');
    for (const adm of adminUsers) {
      await query(
        `INSERT INTO notifications (id, user_id, title, message, type)
         VALUES (?, ?, 'New Leave Request', 'An employee has submitted a leave application awaiting approval.', 'info')`,
        [uuidv4(), adm.id]
      );
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'LEAVE_APPLY',
      module: 'LEAVE',
      recordId: requestId,
      newValue: { leaveTypeId, startDate, endDate, totalDays },
      ipAddress: req.ip,
    });

    return sendCreated(res, { id: requestId, totalDays, status: 'pending' }, 'Leave application submitted successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/leave/requests
 * List leave requests
 */
export async function listLeaveRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const status = req.query.status as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // If Employee role -> force filter to own requests only!
    if (req.user?.roleName === 'employee') {
      const empId = await resolveEmployeeId(req);
      whereClause += ' AND lr.employee_id = ?';
      params.push(empId);
    } else if (req.query.employeeId || req.query.employee_id) {
      whereClause += ' AND lr.employee_id = ?';
      params.push(req.query.employeeId || req.query.employee_id);
    }

    if (status) {
      whereClause += ' AND lr.status = ?';
      params.push(status);
    }

    const countRows = await query<any[]>(
      `SELECT COUNT(*) as total FROM leave_requests lr ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT lr.*,
             lt.name as leave_type_name, lt.is_paid,
             e.employee_id as employee_code,
             CONCAT(e.first_name, ' ', e.last_name) as employee_name,
             e.profile_photo,
             d.name as department_name,
             CONCAT(u.first_name, ' ', u.last_name) as approved_by_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users u ON lr.approved_by_user_id = u.id
      ${whereClause}
      ORDER BY lr.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const requests = await query<any[]>(dataSql, [...params, limit, offset]);

    return sendSuccess(res, requests, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/leave/requests/:id/review
 * Admin approves or rejects leave request
 */
export async function reviewLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body; // 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError('Status must be either approved or rejected', 400);
    }

    const reqRows = await query<any[]>(
      'SELECT lr.*, e.user_id as employee_user_id FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.id = ?',
      [id]
    );
    if (reqRows.length === 0) throw new AppError('Leave request not found', 404);

    const leaveReq = reqRows[0];
    if (leaveReq.status !== 'pending') {
      throw new AppError(`Leave request has already been ${leaveReq.status}`, 400);
    }

    const year = new Date(leaveReq.start_date).getFullYear();

    await withTransaction(async (conn) => {
      // 1. Update request status
      await conn.query(
        `UPDATE leave_requests
         SET status = ?, approved_by_user_id = ?, reviewer_remarks = ?, updated_at = NOW()
         WHERE id = ?`,
        [status, req.user!.id, remarks || null, id]
      );

      // 2. Adjust leave balances
      if (status === 'approved') {
        await conn.query(
          `UPDATE leave_balances
           SET pending_days = GREATEST(0, pending_days - ?),
               used_days = used_days + ?,
               remaining_days = GREATEST(0, remaining_days - ?)
           WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
          [leaveReq.total_days, leaveReq.total_days, leaveReq.total_days, leaveReq.employee_id, leaveReq.leave_type_id, year]
        );

        // 3. ATTENDANCE INTEGRATION: Automatically mark attendance as 'leave' for ALL dates in range!
        const start = new Date(leaveReq.start_date);
        const end = new Date(leaveReq.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const attId = `att-${leaveReq.employee_id}-${dateStr}`;
          await conn.query(
            `INSERT INTO attendance (id, employee_id, date, status, notes, updated_by_user_id)
             VALUES (?, ?, ?, 'leave', 'Approved Leave', ?)
             ON DUPLICATE KEY UPDATE status = 'leave', notes = 'Approved Leave', updated_by_user_id = VALUES(updated_by_user_id)`,
            [attId, leaveReq.employee_id, dateStr, req.user!.id]
          );
        }
      } else {
        // Rejected: release pending days
        await conn.query(
          `UPDATE leave_balances
           SET pending_days = GREATEST(0, pending_days - ?)
           WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
          [leaveReq.total_days, leaveReq.employee_id, leaveReq.leave_type_id, year]
        );
      }
    });

    // Notify employee
    if (leaveReq.employee_user_id) {
      await query(
        `INSERT INTO notifications (id, user_id, title, message, type)
         VALUES (?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          leaveReq.employee_user_id,
          `Leave Request ${status.toUpperCase()}`,
          `Your leave request for ${leaveReq.start_date} to ${leaveReq.end_date} has been ${status}.${remarks ? ' Reason: ' + remarks : ''}`,
          status === 'approved' ? 'success' : 'warning',
        ]
      );
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: `LEAVE_${status.toUpperCase()}`,
      module: 'LEAVE',
      recordId: id,
      newValue: { status, remarks },
      ipAddress: req.ip,
    });

    return sendSuccess(res, { id, status }, undefined, 200, `Leave request ${status} successfully`);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/leave/requests/:id/cancel
 * Cancel eligible leave request
 */
export async function cancelLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const reqRows = await query<any[]>('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (reqRows.length === 0) throw new AppError('Leave request not found', 404);

    const leaveReq = reqRows[0];
    const employeeId = await resolveEmployeeId(req);
    const isOwner = employeeId && leaveReq.employee_id === employeeId;
    const isAdmin = req.user?.roleName === 'super_admin' || req.user?.roleName === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AppError('You do not have permission to cancel this leave request', 403);
    }

    if (leaveReq.status === 'cancelled' || leaveReq.status === 'rejected') {
      throw new AppError(`Leave request is already ${leaveReq.status}`, 400);
    }

    const year = new Date(leaveReq.start_date).getFullYear();

    await withTransaction(async (conn) => {
      if (leaveReq.status === 'pending') {
        await conn.query(
          `UPDATE leave_balances
           SET pending_days = GREATEST(0, pending_days - ?)
           WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
          [leaveReq.total_days, leaveReq.employee_id, leaveReq.leave_type_id, year]
        );
      } else if (leaveReq.status === 'approved') {
        await conn.query(
          `UPDATE leave_balances
           SET used_days = GREATEST(0, used_days - ?),
               remaining_days = remaining_days + ?
           WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
          [leaveReq.total_days, leaveReq.total_days, leaveReq.employee_id, leaveReq.leave_type_id, year]
        );

        // Delete / revert attendance
        const start = new Date(leaveReq.start_date);
        const end = new Date(leaveReq.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          await conn.query(
            `DELETE FROM attendance WHERE employee_id = ? AND date = ? AND status = 'leave' AND notes = 'Approved Leave'`,
            [leaveReq.employee_id, dateStr]
          );
        }
      }

      await conn.query('UPDATE leave_requests SET status = "cancelled", updated_at = NOW() WHERE id = ?', [id]);
    });

    return sendSuccess(res, { id, status: 'cancelled' }, undefined, 200, 'Leave request cancelled successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Holidays Management
 */
export async function listHolidays(req: Request, res: Response, next: NextFunction) {
  try {
    const year = parseInt(req.query.year as string || `${new Date().getFullYear()}`, 10);
    const holidays = await query<any[]>(
      'SELECT * FROM holidays WHERE YEAR(date) = ? ORDER BY date ASC',
      [year]
    );
    return sendSuccess(res, holidays);
  } catch (error) {
    next(error);
  }
}

export async function createHoliday(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, date, description, isOptional } = req.body;
    if (!name || !date) throw new AppError('Holiday name and date are required', 400);

    const id = `hol-${uuidv4().slice(0, 8)}`;
    await query(
      `INSERT INTO holidays (id, name, date, description, is_optional, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, name, date, description || null, isOptional ? 1 : 0]
    );

    return sendCreated(res, { id, name, date }, 'Holiday created successfully');
  } catch (error) {
    next(error);
  }
}

export async function deleteHoliday(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM holidays WHERE id = ?', [id]);
    return sendSuccess(res, { id, deleted: true }, undefined, 200, 'Holiday deleted successfully');
  } catch (error) {
    next(error);
  }
}
