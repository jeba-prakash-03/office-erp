import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listLeaveTypes(req: Request, res: Response, next: NextFunction) {
  try {
    const types = await query<any[]>('SELECT * FROM leave_types ORDER BY name ASC');
    res.json({ success: true, data: types });
  } catch (error) {
    next(error);
  }
}

export async function createLeaveType(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, daysAllowedPerYear, isPaid, requiresAttachment, description } = req.body;
    if (!name) throw new AppError('Leave type name is required', 400);

    const id = `leave-${uuidv4()}`;
    await query(
      `INSERT INTO leave_types (id, name, days_allowed_per_year, is_paid, requires_attachment, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, name.trim(), daysAllowedPerYear || 12, isPaid !== false ? 1 : 0, requiresAttachment ? 1 : 0, description || null]
    );

    res.status(201).json({ success: true, message: 'Leave type created successfully', data: { id } });
  } catch (error) {
    next(error);
  }
}

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

export async function getMyLeaveBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = await resolveEmployeeId(req);
    const year = parseInt(req.query.year as string || `${new Date().getFullYear()}`, 10);

    if (!employeeId) {
      // If super admin has no employee profile, return general balance summaries or empty list
      return res.json({ success: true, data: [] });
    }

    // Check if balances exist for this year, if not auto-initialize from leave_types
    let balances = await query<any[]>(
      `SELECT lb.*, lt.name as leave_type_name, lt.is_paid, lt.requires_attachment, lt.description
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.employee_id = ? AND lb.year = ?
       ORDER BY lt.name ASC`,
      [employeeId, year]
    );

    if (balances.length === 0) {
      const types = await query<any[]>('SELECT * FROM leave_types');
      for (const lt of types) {
        const balId = `bal-${uuidv4()}`;
        await query(
          `INSERT IGNORE INTO leave_balances (id, employee_id, leave_type_id, year, total_days, used_days, pending_days, remaining_days, created_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?, NOW())`,
          [balId, employeeId, lt.id, year, lt.days_allowed_per_year, lt.days_allowed_per_year]
        );
      }

      balances = await query<any[]>(
        `SELECT lb.*, lt.name as leave_type_name, lt.is_paid, lt.requires_attachment, lt.description
         FROM leave_balances lb
         JOIN leave_types lt ON lb.leave_type_id = lt.id
         WHERE lb.employee_id = ? AND lb.year = ?
         ORDER BY lt.name ASC`,
        [employeeId, year]
      );
    }

    res.json({ success: true, data: balances });
  } catch (error) {
    next(error);
  }
}

export async function applyLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) throw new AppError('Employee profile not found. Please link an employee record.', 400);

    const leaveTypeId = req.body.leaveTypeId || req.body.leave_type_id;
    const startDate = req.body.startDate || req.body.start_date;
    const endDate = req.body.endDate || req.body.end_date;
    const totalDays = req.body.totalDays || req.body.total_days;
    const reason = req.body.reason;
    const attachmentUrl = req.body.attachmentUrl || req.body.attachment_url;

    if (!leaveTypeId || !startDate || !endDate || !totalDays || !reason) {
      throw new AppError('Leave type, start date, end date, total days, and reason are required', 400);
    }

    const days = parseFloat(String(totalDays));
    const year = new Date(startDate).getFullYear();

    // Check balance
    const balanceRows = await query<any[]>(
      'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
      [employeeId, leaveTypeId, year]
    );

    if (balanceRows.length > 0) {
      const balance = balanceRows[0];
      if (balance.remaining_days - balance.pending_days < days) {
        throw new AppError(`Insufficient leave balance. You have ${balance.remaining_days - balance.pending_days} days available.`, 400);
      }
    }

    const requestId = `lr-${uuidv4()}`;

    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO leave_requests (
          id, employee_id, leave_type_id, start_date, end_date, total_days, reason, attachment_url, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [requestId, employeeId, leaveTypeId, startDate, endDate, days, reason.trim(), attachmentUrl || null]
      );

      // Increment pending days
      await conn.query(
        `UPDATE leave_balances 
         SET pending_days = pending_days + ? 
         WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
        [days, employeeId, leaveTypeId, year]
      );
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'APPLY_LEAVE',
      module: 'LEAVE',
      recordId: requestId,
      newValue: { leaveTypeId, startDate, endDate, totalDays: days },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Leave application submitted successfully', data: { id: requestId } });
  } catch (error) {
    next(error);
  }
}

export async function listLeaveRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const status = req.query.status as string || '';
    const departmentId = req.query.departmentId as string || '';
    const employeeId = req.query.employeeId as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // If filtering for logged in user's own requests
    if (req.query.myRequests === 'true' && req.user?.employeeId) {
      whereClause += ' AND lr.employee_id = ?';
      params.push(req.user.employeeId);
    } else if (employeeId) {
      whereClause += ' AND lr.employee_id = ?';
      params.push(employeeId);
    }

    if (status) {
      whereClause += ' AND lr.status = ?';
      params.push(status);
    }
    if (departmentId) {
      whereClause += ' AND e.department_id = ?';
      params.push(departmentId);
    }

    const countRows = await query<any[]>(
      `SELECT COUNT(*) as total 
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.id
       ${whereClause}`,
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

    res.json({
      success: true,
      data: requests,
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

export async function reviewLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError('Status must be either approved or rejected', 400);
    }

    const reqRows = await query<any[]>('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (reqRows.length === 0) throw new AppError('Leave request not found', 404);

    const leaveReq = reqRows[0];
    if (leaveReq.status !== 'pending') {
      throw new AppError(`Leave request is already ${leaveReq.status}`, 400);
    }

    const year = new Date(leaveReq.start_date).getFullYear();

    await withTransaction(async (conn) => {
      // 1. Update request status
      await conn.query(
        `UPDATE leave_requests 
         SET status = ?, approved_by_user_id = ?, reviewer_remarks = ?
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

        // Mark attendance as 'leave' for each day in range
        const start = new Date(leaveReq.start_date);
        const end = new Date(leaveReq.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          await conn.query(
            `INSERT INTO attendance (id, employee_id, date, status, notes, created_at)
             VALUES (?, ?, ?, 'leave', 'Approved Leave', NOW())
             ON DUPLICATE KEY UPDATE status = 'leave', notes = 'Approved Leave'`,
            [uuidv4(), leaveReq.employee_id, dateStr]
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

      // Notify employee
      const empUser = await conn.query('SELECT user_id FROM employees WHERE id = ?', [leaveReq.employee_id]);
      const userRows = empUser[0] as any[];
      if (userRows[0]?.user_id) {
        await conn.query(
          `INSERT INTO notifications (id, user_id, title, message, type, link, created_at)
           VALUES (?, ?, ?, ?, 'leave_status', '/leave', NOW())`,
          [uuidv4(), userRows[0].user_id, `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`, `Your leave application from ${leaveReq.start_date} to ${leaveReq.end_date} has been ${status}.`, ]
        );
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: `REVIEW_LEAVE_${status.toUpperCase()}`,
      module: 'LEAVE',
      recordId: id,
      newValue: { status, remarks },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Leave request ${status} successfully` });
  } catch (error) {
    next(error);
  }
}
