import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';
import { getCompanyTimezone, getBusinessDate, formatDuration } from '../../utils/dateUtils';
import { ApprovalService } from '../../services/approval.service';

function formatForMySQLDateTime(val: string | Date): string {
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    throw new AppError(`Invalid date/time value: ${val}`, 400);
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Helper to resolve employee profile
async function resolveEmployeeId(req: Request): Promise<string | null> {
  if (req.user?.employeeId) return req.user.employeeId;
  if (req.user?.id) {
    const rows = await query<any[]>('SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', [req.user.id]);
    if (rows.length > 0) return rows[0].id;
  }
  return null;
}

// ---------------------------------------------------------------------------------
// A. EMPLOYEE SELF-SERVICE ENDPOINTS
// ---------------------------------------------------------------------------------

/**
 * GET /api/attendance/me
 * Returns today's punch status and shift progress for the logged-in employee.
 */
export async function getMyTodayStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = await resolveEmployeeId(req);
    const tz = await getCompanyTimezone();
    const today = getBusinessDate(tz);

    if (!employeeId) {
      return res.json({
        success: true,
        data: {
          hasEmployeeProfile: false,
          employeeId: null,
          date: today,
          status: 'no_profile',
          message: 'No employee profile linked to this user account.',
          checkIn: null,
          checkOut: null,
          totalHours: 0,
          overtimeHours: 0,
          workingHoursFormatted: '0h 00m',
          overtimeHoursFormatted: '0h 00m',
          canClockIn: false,
          canClockOut: false,
          isClockedIn: false,
          isClockedOut: false,
          isOnLeave: false,
        },
      });
    }

    // 1. Check if employee is on approved leave today
    const leaveRows = await query<any[]>(
      `SELECT lr.id, lt.name as leave_type, lr.reason 
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.employee_id = ? AND lr.status = 'approved' AND ? BETWEEN lr.start_date AND lr.end_date
       LIMIT 1`,
      [employeeId, today]
    );

    const isOnLeave = leaveRows.length > 0;
    const leaveReason = isOnLeave ? leaveRows[0].leave_type : null;

    // 2. Fetch today's attendance row if any
    const records = await query<any[]>(
      `SELECT a.*, 
              CONCAT(e.first_name, ' ', e.last_name) as employee_name,
              e.employee_id as employee_code
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.employee_id = ? AND a.date = ?`,
      [employeeId, today]
    );

    if (records.length === 0) {
      return res.json({
        success: true,
        data: {
          hasEmployeeProfile: true,
          employeeId,
          date: today,
          checkIn: null,
          checkOut: null,
          totalHours: 0,
          overtimeHours: 0,
          workingHoursFormatted: '0h 00m',
          overtimeHoursFormatted: '0h 00m',
          status: isOnLeave ? 'on_leave' : 'not_marked',
          canClockIn: !isOnLeave,
          canClockOut: false,
          isClockedIn: false,
          isClockedOut: false,
          isOnLeave,
          leaveReason,
        },
      });
    }

    const rec = records[0];
    const isClockedIn = Boolean(rec.check_in && !rec.check_out);
    const isClockedOut = Boolean(rec.check_out);

    let currentWorkingHours = Number(rec.total_hours || 0);
    if (isClockedIn && rec.check_in) {
      const checkInTime = new Date(rec.check_in).getTime();
      const nowTime = new Date().getTime();
      currentWorkingHours = Math.max(0, (nowTime - checkInTime) / (1000 * 3600));
    }

    const currentStatus = isOnLeave
      ? 'on_leave'
      : isClockedOut
      ? 'completed'
      : isClockedIn
      ? 'working'
      : rec.status || 'present';

    res.json({
      success: true,
      data: {
        hasEmployeeProfile: true,
        id: rec.id,
        employeeId: rec.employee_id,
        employeeName: rec.employee_name,
        employeeCode: rec.employee_code,
        date: rec.date,
        checkIn: rec.check_in,
        checkOut: rec.check_out,
        totalHours: Number(rec.total_hours || 0),
        overtimeHours: Number(rec.overtime_hours || 0),
        workingHoursFormatted: formatDuration(currentWorkingHours),
        overtimeHoursFormatted: formatDuration(rec.overtime_hours),
        status: currentStatus,
        canClockIn: !rec.check_in && !isOnLeave,
        canClockOut: isClockedIn,
        isClockedIn,
        isClockedOut,
        isOnLeave,
        leaveReason,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attendance/my-history
 * Returns attendance log history for the authenticated employee only.
 */
export async function getMyAttendanceHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 30, total: 0, totalPages: 0 } });
    }

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '31', 10);
    const month = String(req.query.month || '').trim();
    const status = String(req.query.status || '').trim();
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE a.employee_id = ? AND a.date <= CURDATE()';
    const params: any[] = [employeeId];

    if (month) {
      if (month.includes('-')) {
        const [y, m] = month.split('-');
        whereClause += ' AND YEAR(a.date) = ? AND MONTH(a.date) = ?';
        params.push(parseInt(y, 10), parseInt(m, 10));
      } else {
        whereClause += ' AND MONTH(a.date) = ?';
        params.push(parseInt(month, 10));
      }
    }

    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM attendance a ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT a.*, 
             e.employee_id as employee_code,
             CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      ${whereClause}
      ORDER BY a.date DESC, a.check_in DESC
      LIMIT ? OFFSET ?
    `;

    const records = await query<any[]>(dataSql, [...params, limit, offset]);

    const formattedRecords = records.map((r) => ({
      ...r,
      working_hours_formatted: formatDuration(r.total_hours),
      overtime_hours_formatted: formatDuration(r.overtime_hours),
    }));

    res.json({
      success: true,
      data: formattedRecords,
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

/**
 * POST /api/attendance/clock-in
 * Employee punch in. Enforces single punch, leave verification, and company business date.
 */
export async function clockIn(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) {
      throw new AppError('No employee profile associated with your user account. Please ensure an employee record is linked.', 400);
    }

    const tz = await getCompanyTimezone();
    const today = getBusinessDate(tz);
    const ip = req.ip || req.socket.remoteAddress || '';

    // 1. Check if employee is on approved leave today
    const leaveRows = await query<any[]>(
      `SELECT lr.id, lt.name as leave_type 
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.employee_id = ? AND lr.status = 'approved' AND ? BETWEEN lr.start_date AND lr.end_date
       LIMIT 1`,
      [employeeId, today]
    );
    if (leaveRows.length > 0) {
      throw new AppError(`You are on approved ${leaveRows[0].leave_type} today. Clock-in is disabled.`, 400);
    }

    // 2. Check if already clocked in today
    const existing = await query<any[]>(
      'SELECT id, check_in, check_out, status FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existing.length > 0 && existing[0].check_in) {
      throw new AppError('Already clocked in today.', 400);
    }

    const now = new Date();
    // Standard threshold: 9:30 AM
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const isLate = currentHour > 9 || (currentHour === 9 && currentMin > 30);
    const status = isLate ? 'late' : 'present';

    const attendanceId = existing.length > 0 ? existing[0].id : `att-${uuidv4()}`;

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
      action: 'CLOCK_IN',
      module: 'ATTENDANCE',
      recordId: attendanceId,
      newValue: { date: today, status },
      ipAddress: ip,
    });

    const updated = await query<any[]>('SELECT * FROM attendance WHERE id = ?', [attendanceId]);

    res.json({
      success: true,
      message: `Clocked in successfully at ${now.toLocaleTimeString()} (${status})`,
      data: {
        id: attendanceId,
        date: today,
        checkIn: updated[0]?.check_in || now.toISOString(),
        check_in: updated[0]?.check_in || now.toISOString(),
        checkOut: null,
        check_out: null,
        status,
        canClockIn: false,
        canClockOut: true,
        isClockedIn: true,
        isClockedOut: false,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/attendance/clock-out
 * Employee punch out. Calculates exact working duration and overtime.
 */
export async function clockOut(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) {
      throw new AppError('No employee profile associated with your user account.', 400);
    }

    const tz = await getCompanyTimezone();
    const today = getBusinessDate(tz);
    const ip = req.ip || req.socket.remoteAddress || '';

    const existing = await query<any[]>(
      'SELECT id, check_in, check_out, break_minutes FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existing.length === 0 || !existing[0].check_in) {
      throw new AppError('Cannot clock out because you have not clocked in yet today.', 400);
    }

    if (existing[0].check_out) {
      throw new AppError('Already clocked out for today.', 400);
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
      action: 'CLOCK_OUT',
      module: 'ATTENDANCE',
      recordId: existing[0].id,
      newValue: { date: today, totalHours, overtimeHours },
      ipAddress: ip,
    });

    const updated = await query<any[]>('SELECT * FROM attendance WHERE id = ?', [existing[0].id]);
    const durationFormatted = formatDuration(totalHours);

    res.json({
      success: true,
      message: `Clocked out successfully. Total working duration: ${durationFormatted}`,
      data: {
        id: existing[0].id,
        date: today,
        checkIn: updated[0]?.check_in,
        check_in: updated[0]?.check_in,
        checkOut: updated[0]?.check_out,
        check_out: updated[0]?.check_out,
        totalHours,
        total_hours: totalHours,
        overtimeHours,
        overtime_hours: overtimeHours,
        workingHoursFormatted: durationFormatted,
        working_hours_formatted: durationFormatted,
        overtimeHoursFormatted: formatDuration(overtimeHours),
        overtime_hours_formatted: formatDuration(overtimeHours),
        status: updated[0]?.status,
        canClockIn: false,
        canClockOut: false,
        isClockedIn: false,
        isClockedOut: true,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------------
// B. HR / ADMIN ATTENDANCE MANAGEMENT ENDPOINTS
// ---------------------------------------------------------------------------------

/**
 * GET /api/attendance/overview
 * Returns today's company-wide attendance counts: total, present, absent, late, on leave, missing punch.
 */
export async function getAttendanceOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const tz = await getCompanyTimezone();
    const queryDate = (req.query.date as string) || getBusinessDate(tz);

    // Total active employees
    const empCountRows = await query<any[]>(
      'SELECT COUNT(*) as count FROM employees WHERE employment_status = "active" AND deleted_at IS NULL'
    );
    const totalEmployees = Number(empCountRows[0]?.count || 0);

    // Attendance stats for queryDate
    const attStatsRows = await query<any[]>(
      `SELECT 
         COUNT(DISTINCT a.employee_id) as marked_count,
         SUM(CASE WHEN a.check_in IS NOT NULL THEN 1 ELSE 0 END) as present_count,
         SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
         SUM(CASE WHEN a.check_in IS NOT NULL AND a.check_out IS NULL THEN 1 ELSE 0 END) as missing_punch_count
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.date = ? AND e.employment_status = "active" AND e.deleted_at IS NULL`,
      [queryDate]
    );

    const presentCount = Number(attStatsRows[0]?.present_count || 0);
    const lateCount = Number(attStatsRows[0]?.late_count || 0);
    const missingPunchCount = Number(attStatsRows[0]?.missing_punch_count || 0);

    // Approved leaves covering queryDate
    const leaveCountRows = await query<any[]>(
      `SELECT COUNT(DISTINCT lr.employee_id) as on_leave_count
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.id
       WHERE lr.status = 'approved' AND ? BETWEEN lr.start_date AND lr.end_date
         AND e.employment_status = "active" AND e.deleted_at IS NULL`,
      [queryDate]
    );
    const onLeaveCount = Number(leaveCountRows[0]?.on_leave_count || 0);

    // Absent count = total employees - (present + on leave)
    const absentCount = Math.max(0, totalEmployees - (presentCount + onLeaveCount));

    res.json({
      success: true,
      data: {
        date: queryDate,
        totalEmployees,
        present: presentCount,
        presentCount,
        absent: absentCount,
        absentCount,
        late: lateCount,
        lateCount,
        onLeave: onLeaveCount,
        onLeaveCount,
        missingPunch: missingPunchCount,
        missingPunchCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attendance
 * Administrative listing with rich filters (date, range, department, employee search, status).
 */
export async function listAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const tz = await getCompanyTimezone();
    const today = getBusinessDate(tz);

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const date = String(req.query.date || '').trim();
    const startDate = String(req.query.startDate || '').trim();
    const endDate = String(req.query.endDate || '').trim();
    const month = String(req.query.month || '').trim();
    const departmentId = String(req.query.departmentId || req.query.department_id || '').trim();
    const employeeId = String(req.query.employeeId || req.query.employee_id || '').trim();
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || req.query.q || '').trim();
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE e.deleted_at IS NULL AND a.date <= CURDATE()';
    const params: any[] = [];

    // Role-based scoping for Team Lead / PM
    if (req.user?.roleName === 'team_lead' || req.user?.roleName === 'project_manager') {
      if (req.user?.employeeId) {
        whereClause += ' AND (e.reporting_manager_id = ? OR a.employee_id = ?)';
        params.push(req.user.employeeId, req.user.employeeId);
      }
    }

    if (date) {
      whereClause += ' AND a.date = ?';
      params.push(date);
    } else if (startDate && endDate) {
      whereClause += ' AND a.date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (month) {
      if (month.includes('-')) {
        const [y, m] = month.split('-');
        whereClause += ' AND YEAR(a.date) = ? AND MONTH(a.date) = ?';
        params.push(parseInt(y, 10), parseInt(m, 10));
      } else {
        whereClause += ' AND MONTH(a.date) = ?';
        params.push(parseInt(month, 10));
      }
    } else if (!req.query.allDates) {
      // Default to today for HR/Admin daily dashboard
      whereClause += ' AND a.date = ?';
      params.push(today);
    }

    if (departmentId) {
      whereClause += ' AND (e.department_id = ? OR d.name = ?)';
      params.push(departmentId, departmentId);
    }
    if (employeeId) {
      whereClause += ' AND a.employee_id = ?';
      params.push(employeeId);
    }
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }
    if (search) {
      whereClause += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_id LIKE ? OR CONCAT(e.first_name, " ", e.last_name) LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const countRows = await query<any[]>(
      `SELECT COUNT(*) as total 
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT a.*, 
             e.employee_id as employee_code,
             CONCAT(e.first_name, ' ', e.last_name) as employee_name,
             e.profile_photo,
             e.designation,
             d.name as department_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereClause}
      ORDER BY a.date DESC, a.check_in DESC
      LIMIT ? OFFSET ?
    `;

    const records = await query<any[]>(dataSql, [...params, limit, offset]);

    const formatted = records.map((r) => ({
      ...r,
      working_hours_formatted: formatDuration(r.total_hours),
      overtime_hours_formatted: formatDuration(r.overtime_hours),
    }));

    res.json({
      success: true,
      data: formatted,
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

/**
 * POST /api/attendance/admin-correction
 * HR / Admin direct manual correction of an employee's attendance record with mandatory reason and audit log.
 */
export async function adminManualCorrection(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.body.employeeId || req.body.employee_id;
    const date = req.body.date;
    const checkIn = req.body.checkIn || req.body.check_in || req.body.clock_in;
    const checkOut = req.body.checkOut || req.body.check_out || req.body.clock_out;
    const status = req.body.status;
    const reason = req.body.reason;

    if (!employeeId || !date || !reason || !String(reason).trim()) {
      throw new AppError('Employee, date, and correction reason are mandatory', 400);
    }

    const tz = await getCompanyTimezone();
    const today = getBusinessDate(tz);
    if (date > today) {
      throw new AppError('Cannot record attendance for future dates', 400);
    }

    const formattedIn = checkIn ? formatForMySQLDateTime(checkIn) : null;
    const formattedOut = checkOut ? formatForMySQLDateTime(checkOut) : null;

    let totalHours = 0;
    let overtimeHours = 0;
    if (formattedIn && formattedOut) {
      const inTime = new Date(formattedIn).getTime();
      const outTime = new Date(formattedOut).getTime();
      if (outTime < inTime) {
        throw new AppError('Clock-out time cannot be earlier than clock-in time', 400);
      }
      totalHours = Math.round(((outTime - inTime) / (1000 * 3600)) * 100) / 100;
      overtimeHours = Math.max(0, Math.round((totalHours - 8.0) * 100) / 100);
    }

    const existing = await query<any[]>('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employeeId, date]);
    const attendanceId = existing.length > 0 ? existing[0].id : `att-${uuidv4()}`;

    if (existing.length > 0) {
      await query(
        `UPDATE attendance 
         SET check_in = ?, check_out = ?, total_hours = ?, overtime_hours = ?, status = ?, notes = ?
         WHERE id = ?`,
        [formattedIn, formattedOut, totalHours, overtimeHours, status || 'present', `Manual correction: ${reason}`, attendanceId]
      );
    } else {
      await query(
        `INSERT INTO attendance (id, employee_id, date, check_in, check_out, total_hours, overtime_hours, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [attendanceId, employeeId, date, formattedIn, formattedOut, totalHours, overtimeHours, status || 'present', `Manual entry: ${reason}`]
      );
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'ADMIN_ATTENDANCE_CORRECTION',
      module: 'ATTENDANCE',
      recordId: attendanceId,
      previousValue: existing[0] || null,
      newValue: { employeeId, date, checkIn: formattedIn, checkOut: formattedOut, status, reason },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Attendance record updated successfully with audit trail.',
      data: { id: attendanceId, totalHours, workingHoursFormatted: formatDuration(totalHours) },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------------
// C. ATTENDANCE CORRECTION WORKFLOW (EMPLOYEE REQUEST & APPROVAL)
// ---------------------------------------------------------------------------------

/**
 * POST /api/attendance/corrections
 * Employee requests a correction for a past attendance date.
 */
export async function requestCorrection(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) throw new AppError('Employee profile required to request correction', 400);

    const date = req.body.date;
    const rawIn = req.body.requestedCheckIn || req.body.requested_check_in || req.body.requested_clock_in;
    const rawOut = req.body.requestedCheckOut || req.body.requested_check_out || req.body.requested_clock_out;
    const reason = req.body.reason;
    const attendanceId = req.body.attendanceId || req.body.attendance_id;

    if (!date || !rawIn || !rawOut || !reason) {
      throw new AppError('Date, Requested Check-in, Requested Check-out, and Reason are required', 400);
    }

    const tz = await getCompanyTimezone();
    const today = getBusinessDate(tz);
    if (date > today) {
      throw new AppError('Cannot request attendance correction for future dates', 400);
    }

    const inVal = rawIn.length <= 8 ? `${date}T${rawIn.length === 5 ? rawIn + ':00' : rawIn}` : rawIn;
    const outVal = rawOut.length <= 8 ? `${date}T${rawOut.length === 5 ? rawOut + ':00' : rawOut}` : rawOut;

    const checkInFormatted = formatForMySQLDateTime(inVal);
    const checkOutFormatted = formatForMySQLDateTime(outVal);

    const inTime = new Date(checkInFormatted).getTime();
    const outTime = new Date(checkOutFormatted).getTime();
    if (outTime <= inTime) {
      throw new AppError('Requested check-out must be later than requested check-in', 400);
    }

    const correctionId = `corr-${uuidv4()}`;
    await query(
      `INSERT INTO attendance_corrections (
        id, attendance_id, employee_id, date, requested_check_in, requested_check_out, reason, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [correctionId, attendanceId || null, employeeId, date, checkInFormatted, checkOutFormatted, reason.trim()]
    );

    // Resolve Manager for approval
    const empInfo = await query<any[]>('SELECT reporting_manager_id FROM employees WHERE id = ?', [employeeId]);
    const managerId = empInfo[0]?.reporting_manager_id || null;

    // Register in Universal Approval Engine
    await ApprovalService.submitRequest({
      entityType: 'attendance_correction',
      entityId: correctionId,
      requesterId: employeeId,
      currentApproverId: managerId,
      comments: `Attendance correction for ${date}: ${reason.trim()}`,
      actorUserId: req.user!.id,
      actorRole: req.user!.roleName,
    });

    res.status(201).json({
      success: true,
      message: 'Attendance correction request submitted for review',
      data: { id: correctionId },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attendance/corrections
 * Lists correction requests (filterable by status).
 */
export async function listCorrections(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as string || '';
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // If employee viewing their own
    if (req.query.myCorrections === 'true' && req.user?.employeeId) {
      whereClause += ' AND ac.employee_id = ?';
      params.push(req.user.employeeId);
    }

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

/**
 * PUT /api/attendance/corrections/:id/review
 * Approves or rejects correction request with self-approval protection.
 */
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

    // Self-approval guard
    if (corr.employee_id === req.user?.employeeId && req.user?.roleName !== 'super_admin') {
      throw new AppError('Self-approval violation: You cannot approve your own attendance correction', 403);
    }

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
        const diffHours = Math.round((Math.max(0, (outTime - inTime) / (1000 * 3600))) * 100) / 100;
        const otHours = Math.max(0, Math.round((diffHours - 8.0) * 100) / 100);

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
             ON DUPLICATE KEY UPDATE check_in = VALUES(check_in), check_out = VALUES(check_out), total_hours = VALUES(total_hours), overtime_hours = VALUES(overtime_hours), status = 'present'`,
            [uuidv4(), corr.employee_id, corr.date, corr.requested_check_in, corr.requested_check_out, diffHours, otHours]
          );
        }
      }
    });

    try {
      await ApprovalService.processDecision({
        entityType: 'attendance_correction',
        entityId: id,
        action: status === 'approved' ? 'approve' : 'reject',
        actorUserId: req.user!.id,
        actorEmployeeId: req.user!.employeeId,
        actorRole: req.user!.roleName,
        actorPermissions: req.user!.permissions,
        remarks,
      });
    } catch (e) {}

    res.json({ success: true, message: `Attendance correction ${status} successfully` });
  } catch (error) {
    next(error);
  }
}

// Aliases for backwards compatibility
export const checkIn = clockIn;
export const checkOut = clockOut;
export const getTodayStatus = getMyTodayStatus;

