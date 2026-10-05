import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function checkIn(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
      throw new AppError('No employee profile associated with your user account.', 400);
    }

    const today = new Date().toISOString().split('T')[0];
    const ip = req.ip || req.socket.remoteAddress || '';

    // Check if already checked in today
    const existing = await query<any[]>(
      'SELECT id, check_in, check_out FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existing.length > 0 && existing[0].check_in) {
      throw new AppError('You have already checked in for today', 400);
    }

    const now = new Date();
    // Default standard check-in hour 09:30
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
    const status = isLate ? 'late' : 'present';

    const attendanceId = existing.length > 0 ? existing[0].id : uuidv4();

    if (existing.length > 0) {
      await query(
        'UPDATE attendance SET check_in = NOW(), status = ?, ip_address = ? WHERE id = ?',
        [status, ip, attendanceId]
      );
    } else {
      await query(
        `INSERT INTO attendance (id, employee_id, date, check_in, status, ip_address, created_at)
         VALUES (?, ?, ?, NOW(), ?, ?, NOW())`,
        [attendanceId, employeeId, today, status, ip]
      );
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CHECK_IN',
      module: 'ATTENDANCE',
      recordId: attendanceId,
      newValue: { date: today, status },
      ipAddress: ip,
    });

    res.json({
      success: true,
      message: `Checked in successfully at ${now.toLocaleTimeString()} (${status})`,
      data: { checkIn: now.toISOString(), status },
    });
  } catch (error) {
    next(error);
  }
}

export async function checkOut(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
      throw new AppError('No employee profile associated with your user account.', 400);
    }

    const today = new Date().toISOString().split('T')[0];
    const ip = req.ip || req.socket.remoteAddress || '';

    const existing = await query<any[]>(
      'SELECT id, check_in, check_out, break_minutes FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existing.length === 0 || !existing[0].check_in) {
      throw new AppError('You have not checked in yet today', 400);
    }

    if (existing[0].check_out) {
      throw new AppError('You have already checked out for today', 400);
    }

    const checkInTime = new Date(existing[0].check_in).getTime();
    const nowTime = new Date().getTime();
    const breakMinutes = existing[0].break_minutes || 0;

    const diffMinutes = Math.max(0, (nowTime - checkInTime) / (1000 * 60) - breakMinutes);
    const totalHours = Math.round((diffMinutes / 60) * 100) / 100;
    const overtimeHours = Math.max(0, Math.round((totalHours - 8.0) * 100) / 100);

    await query(
      `UPDATE attendance 
       SET check_out = NOW(),
           total_hours = ?,
           overtime_hours = ?
       WHERE id = ?`,
      [totalHours, overtimeHours, existing[0].id]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CHECK_OUT',
      module: 'ATTENDANCE',
      recordId: existing[0].id,
      newValue: { date: today, totalHours, overtimeHours },
      ipAddress: ip,
    });

    res.json({
      success: true,
      message: `Checked out successfully. Total hours: ${totalHours} hrs`,
      data: { checkOut: new Date().toISOString(), totalHours, overtimeHours },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTodayStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
      return res.json({ success: true, data: null });
    }

    const today = new Date().toISOString().split('T')[0];
    const records = await query<any[]>(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    res.json({ success: true, data: records[0] || null });
  } catch (error) {
    next(error);
  }
}

export async function listAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const date = req.query.date as string || '';
    const month = req.query.month as string || '';
    const year = req.query.year as string || '';
    const departmentId = req.query.departmentId as string || '';
    const employeeId = req.query.employeeId as string || '';
    const status = req.query.status as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE e.deleted_at IS NULL';
    const params: any[] = [];

    if (date) {
      whereClause += ' AND a.date = ?';
      params.push(date);
    }
    if (month && year) {
      whereClause += ' AND MONTH(a.date) = ? AND YEAR(a.date) = ?';
      params.push(parseInt(month, 10), parseInt(year, 10));
    } else if (year) {
      whereClause += ' AND YEAR(a.date) = ?';
      params.push(parseInt(year, 10));
    }
    if (departmentId) {
      whereClause += ' AND e.department_id = ?';
      params.push(departmentId);
    }
    if (employeeId) {
      whereClause += ' AND a.employee_id = ?';
      params.push(employeeId);
    }
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }

    const countRows = await query<any[]>(
      `SELECT COUNT(*) as total 
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT a.*, 
             e.employee_id as employee_code,
             CONCAT(e.first_name, ' ', e.last_name) as employee_name,
             e.profile_photo,
             d.name as department_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereClause}
      ORDER BY a.date DESC, a.check_in DESC
      LIMIT ? OFFSET ?
    `;

    const records = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: records,
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

export async function requestCorrection(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) throw new AppError('Employee profile required', 400);

    const { date, requestedCheckIn, requestedCheckOut, reason, attendanceId } = req.body;
    if (!date || !requestedCheckIn || !requestedCheckOut || !reason) {
      throw new AppError('Date, Requested Check-in, Requested Check-out, and Reason are required', 400);
    }

    const correctionId = `corr-${uuidv4()}`;
    await query(
      `INSERT INTO attendance_corrections (
        id, attendance_id, employee_id, date, requested_check_in, requested_check_out, reason, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [correctionId, attendanceId || null, employeeId, date, requestedCheckIn, requestedCheckOut, reason.trim()]
    );

    res.status(201).json({ success: true, message: 'Attendance correction request submitted successfully', data: { id: correctionId } });
  } catch (error) {
    next(error);
  }
}

export async function listCorrections(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as string || '';
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND ac.status = ?';
      params.push(status);
    }

    const corrections = await query<any[]>(
      `SELECT ac.*, 
              e.employee_id as employee_code,
              CONCAT(e.first_name, ' ', e.last_name) as employee_name,
              e.profile_photo,
              d.name as department_name,
              CONCAT(u.first_name, ' ', u.last_name) as approved_by_name
       FROM attendance_corrections ac
       JOIN employees e ON ac.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN users u ON ac.approved_by_user_id = u.id
       ${whereClause}
       ORDER BY ac.created_at DESC`,
      params
    );

    res.json({ success: true, data: corrections });
  } catch (error) {
    next(error);
  }
}

export async function reviewCorrection(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError('Status must be either approved or rejected', 400);
    }

    const corrRows = await query<any[]>('SELECT * FROM attendance_corrections WHERE id = ?', [id]);
    if (corrRows.length === 0) throw new AppError('Correction request not found', 404);

    const corr = corrRows[0];

    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE attendance_corrections 
         SET status = ?, approved_by_user_id = ?, reviewer_remarks = ?
         WHERE id = ?`,
        [status, req.user!.id, remarks || null, id]
      );

      if (status === 'approved') {
        const inTime = new Date(corr.requested_check_in).getTime();
        const outTime = new Date(corr.requested_check_out).getTime();
        const diffHours = Math.max(0, (outTime - inTime) / (1000 * 60 * 60));
        const otHours = Math.max(0, diffHours - 8.0);

        if (corr.attendance_id) {
          await conn.query(
            `UPDATE attendance 
             SET check_in = ?, check_out = ?, total_hours = ?, overtime_hours = ?, status = 'present'
             WHERE id = ?`,
            [corr.requested_check_in, corr.requested_check_out, diffHours, otHours, corr.attendance_id]
          );
        } else {
          await conn.query(
            `INSERT INTO attendance (id, employee_id, date, check_in, check_out, total_hours, overtime_hours, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'present', NOW())
             ON DUPLICATE KEY UPDATE check_in = VALUES(check_in), check_out = VALUES(check_out), total_hours = VALUES(total_hours)`,
            [uuidv4(), corr.employee_id, corr.date, corr.requested_check_in, corr.requested_check_out, diffHours, otHours]
          );
        }
      }
    });

    res.json({ success: true, message: `Attendance correction ${status} successfully` });
  } catch (error) {
    next(error);
  }
}
