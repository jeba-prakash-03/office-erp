import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';
import { sendSuccess } from '../../utils/response';

// Mapping between DB enum and Grid UI Code
const STATUS_TO_CODE: Record<string, string> = {
  present: 'P',
  absent: 'A',
  leave: 'L',
  half_day: 'HD',
  holiday: 'H',
  week_off: 'WO',
  not_marked: 'NM',
};

const CODE_TO_STATUS: Record<string, string> = {
  P: 'present',
  PRESENT: 'present',
  A: 'absent',
  ABSENT: 'absent',
  L: 'leave',
  LEAVE: 'leave',
  HD: 'half_day',
  HALF_DAY: 'half_day',
  H: 'holiday',
  HOLIDAY: 'holiday',
  WO: 'week_off',
  WEEK_OFF: 'week_off',
  NM: 'not_marked',
  NOT_MARKED: 'not_marked',
};

// Helper: resolve logged-in employee ID
async function resolveEmployeeId(req: Request): Promise<string | null> {
  if (req.user?.employeeId) return req.user.employeeId;
  if (req.user?.id) {
    const rows = await query<any[]>('SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', [req.user.id]);
    if (rows.length > 0) return rows[0].id;
  }
  return null;
}

/**
 * GET /api/attendance/sheet
 * Fetch monthly attendance spreadsheet grid for all active employees
 */
export async function getMonthlyAttendanceSheet(req: Request, res: Response, next: NextFunction) {
  try {
    const month = parseInt(req.query.month as string || String(new Date().getMonth() + 1), 10);
    const year = parseInt(req.query.year as string || String(new Date().getFullYear()), 10);

    if (month < 1 || month > 12 || isNaN(year)) {
      throw new AppError('Valid month (1-12) and year are required', 400);
    }

    // Calculate total days for the selected month (e.g. Feb: 28/29, Apr: 30, Oct: 31)
    const totalDays = new Date(year, month, 0).getDate();

    // Check month lock status
    const monthRows = await query<any[]>(
      `SELECT m.*, u.first_name as finalized_by_name
       FROM attendance_months m
       LEFT JOIN users u ON m.finalized_by_user_id = u.id
       WHERE m.month = ? AND m.year = ?`,
      [month, year]
    );

    const monthStatus = monthRows.length > 0 ? monthRows[0].status : 'draft';
    const finalizedInfo = monthRows.length > 0 && monthRows[0].status === 'finalized' ? {
      finalizedBy: monthRows[0].finalized_by_name || 'Admin',
      finalizedAt: monthRows[0].finalized_at,
      notes: monthRows[0].notes,
    } : null;

    // Fetch all active employees
    const employees = await query<any[]>(
      `SELECT e.id, e.employee_id, e.first_name, e.last_name, e.designation, d.name as department_name, e.profile_photo
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.deleted_at IS NULL AND e.employment_status = 'active'
       ORDER BY e.first_name ASC, e.last_name ASC`
    );

    // Fetch attendance records for this month
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

    const attendanceRows = await query<any[]>(
      `SELECT employee_id, date, status, notes
       FROM attendance
       WHERE date BETWEEN ? AND ?`,
      [startDateStr, endDateStr]
    );

    // Fetch Holidays in this month
    const holidays = await query<any[]>(
      `SELECT name, date FROM holidays WHERE date BETWEEN ? AND ?`,
      [startDateStr, endDateStr]
    );
    const holidayDates = new Set(holidays.map(h => typeof h.date === 'string' ? h.date.slice(0, 10) : new Date(h.date).toISOString().slice(0, 10)));

    // Index attendance by employeeId and day
    const attMap: Record<string, Record<number, { code: string; status: string; notes: string | null }>> = {};
    for (const r of attendanceRows) {
      const d = new Date(r.date);
      const dayNum = d.getDate();
      if (!attMap[r.employee_id]) attMap[r.employee_id] = {};
      const code = STATUS_TO_CODE[r.status] || 'P';
      attMap[r.employee_id][dayNum] = { code, status: r.status, notes: r.notes || null };
    }

    // Company Totals
    let compPresent = 0;
    let compAbsent = 0;
    let compLeave = 0;
    let compHalfDay = 0;
    let compHoliday = 0;
    let compWeekOff = 0;
    let compNotMarked = 0;

    // Format employee grid rows
    const employeeRows = employees.map((emp) => {
      const days: Record<string, string> = {};
      let present = 0;
      let absent = 0;
      let leave = 0;
      let halfDay = 0;
      let holiday = 0;
      let weekOff = 0;
      let notMarked = 0;

      for (let day = 1; day <= totalDays; day++) {
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        let code = 'NM'; // Default: Not Marked
        if (attMap[emp.id] && attMap[emp.id][day]) {
          code = attMap[emp.id][day].code;
        } else if (holidayDates.has(dateStr)) {
          code = 'H';
        } else if (dayOfWeek === 0 || dayOfWeek === 6) {
          code = 'WO';
        }

        days[String(day)] = code;

        // Aggregate counts
        if (code === 'P') { present++; compPresent++; }
        else if (code === 'A') { absent++; compAbsent++; }
        else if (code === 'L') { leave++; compLeave++; }
        else if (code === 'HD') { halfDay++; compHalfDay++; }
        else if (code === 'H') { holiday++; compHoliday++; }
        else if (code === 'WO') { weekOff++; compWeekOff++; }
        else if (code === 'NM') { notMarked++; compNotMarked++; }
      }

      return {
        id: emp.id,
        employeeId: emp.employee_id,
        name: `${emp.first_name} ${emp.last_name}`,
        firstName: emp.first_name,
        lastName: emp.last_name,
        designation: emp.designation,
        department: emp.department_name || 'General',
        days,
        summary: {
          present,
          absent,
          leave,
          halfDay,
          holiday,
          weekOff,
          notMarked,
          totalWorkingDays: totalDays - weekOff - holiday,
        },
      };
    });

    return sendSuccess(res, {
      month,
      year,
      totalDays,
      status: monthStatus,
      isFinalized: monthStatus === 'finalized',
      finalizedInfo,
      employees: employeeRows,
      companyTotals: {
        totalEmployees: employees.length,
        totalPresent: compPresent,
        totalAbsent: compAbsent,
        totalLeave: compLeave,
        totalHalfDay: compHalfDay,
        totalHoliday: compHoliday,
        totalWeekOff: compWeekOff,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/attendance/sheet
 * Bulk save changes made in the interactive spreadsheet matrix
 */
export async function saveMonthlyAttendanceSheet(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year, updates } = req.body;

    if (!month || !year || !updates) {
      throw new AppError('Month, year, and updates payload are required', 400);
    }

    // 1. Verify lock status
    const monthRows = await query<any[]>(
      'SELECT status FROM attendance_months WHERE month = ? AND year = ?',
      [month, year]
    );

    if (monthRows.length > 0 && monthRows[0].status === 'finalized') {
      throw new AppError(
        'Attendance for this month has been FINALIZED and locked. Reopen the month before saving changes.',
        403,
        'ATTENDANCE_FINALIZED_LOCKED'
      );
    }

    const userId = req.user?.id || null;
    let savedCount = 0;

    // If updates is array of { employeeId, day, status / code }
    if (Array.isArray(updates)) {
      for (const item of updates) {
        const employeeId = item.employeeId || item.employee_id;
        const day = item.day || (item.date ? parseInt(String(item.date).split('-')[2], 10) : null);
        const rawStatus = item.status || item.code;
        if (!employeeId || !day || !rawStatus) continue;

        const codeUpper = String(rawStatus).toUpperCase();
        const dbStatus = CODE_TO_STATUS[codeUpper] || 'present';
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const attId = `att-${employeeId}-${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        await query(
          `INSERT INTO attendance (id, employee_id, date, status, updated_by_user_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), updated_by_user_id = VALUES(updated_by_user_id)`,
          [attId, employeeId, dateStr, dbStatus, userId]
        );
        savedCount++;
      }
    } else if (typeof updates === 'object') {
      // Map format: { [employeeId]: { [day]: code } }
      for (const [employeeId, dayMap] of Object.entries(updates)) {
        if (!dayMap || typeof dayMap !== 'object') continue;
        for (const [dayStr, rawStatus] of Object.entries(dayMap as Record<string, string>)) {
          const day = parseInt(dayStr, 10);
          if (isNaN(day)) continue;

          const codeUpper = String(rawStatus).toUpperCase();
          const dbStatus = CODE_TO_STATUS[codeUpper] || 'present';
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const attId = `att-${employeeId}-${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          await query(
            `INSERT INTO attendance (id, employee_id, date, status, updated_by_user_id)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), updated_by_user_id = VALUES(updated_by_user_id)`,
            [attId, employeeId, dateStr, dbStatus, userId]
          );
          savedCount++;
        }
      }
    }

    // Ensure attendance_months record exists in draft
    await query(
      `INSERT INTO attendance_months (id, month, year, status)
       VALUES (?, ?, ?, 'draft')
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [`att-month-${month}-${year}`, month, year]
    );

    // Audit Log
    await logAudit({
      userId,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'ATTENDANCE_BULK_SAVE',
      module: 'ATTENDANCE',
      recordId: `${year}-${month}`,
      newValue: { month, year, recordsUpdated: savedCount },
      ipAddress: req.ip,
    });

    return sendSuccess(res, {
      savedCount,
      month,
      year,
    }, undefined, 200, 'Attendance Saved Successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/attendance/finalize
 * Lock the monthly attendance sheet
 */
export async function finalizeMonthlyAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year, notes } = req.body;
    if (!month || !year) {
      throw new AppError('Month and year are required', 400);
    }

    const userId = req.user?.id || null;
    const monthId = `att-month-${month}-${year}`;

    await query(
      `INSERT INTO attendance_months (id, month, year, status, finalized_by_user_id, finalized_at, notes)
       VALUES (?, ?, ?, 'finalized', ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE status = 'finalized', finalized_by_user_id = VALUES(finalized_by_user_id), finalized_at = NOW(), notes = VALUES(notes)`,
      [monthId, month, year, userId, notes || null]
    );

    await logAudit({
      userId,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'ATTENDANCE_FINALIZED',
      module: 'ATTENDANCE',
      recordId: monthId,
      newValue: { month, year, status: 'finalized' },
      ipAddress: req.ip,
    });

    return sendSuccess(res, {
      month,
      year,
      status: 'finalized',
    }, undefined, 200, 'Attendance for this month has been finalized and locked for payroll.');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/attendance/reopen
 * Unlock the monthly attendance sheet for modifications (Super Admin / authorized Admin)
 */
export async function reopenMonthlyAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      throw new AppError('Month and year are required', 400);
    }

    const userId = req.user?.id || null;
    const monthId = `att-month-${month}-${year}`;

    await query(
      `UPDATE attendance_months
       SET status = 'draft', finalized_by_user_id = NULL, finalized_at = NULL
       WHERE month = ? AND year = ?`,
      [month, year]
    );

    await logAudit({
      userId,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'ATTENDANCE_REOPENED',
      module: 'ATTENDANCE',
      recordId: monthId,
      newValue: { month, year, status: 'draft' },
      ipAddress: req.ip,
    });

    return sendSuccess(res, {
      month,
      year,
      status: 'draft',
    }, undefined, 200, 'Attendance has been reopened for editing.');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attendance/export
 * Export attendance spreadsheet matching the exact grid layout
 */
export async function exportAttendanceGrid(req: Request, res: Response, next: NextFunction) {
  try {
    const month = parseInt(req.query.month as string || String(new Date().getMonth() + 1), 10);
    const year = parseInt(req.query.year as string || String(new Date().getFullYear()), 10);
    const totalDays = new Date(year, month, 0).getDate();

    const employees = await query<any[]>(
      `SELECT e.id, e.employee_id, e.first_name, e.last_name, d.name as department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.deleted_at IS NULL AND e.employment_status = 'active'
       ORDER BY e.first_name ASC`
    );

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

    const attendanceRows = await query<any[]>(
      `SELECT employee_id, date, status FROM attendance WHERE date BETWEEN ? AND ?`,
      [startDateStr, endDateStr]
    );

    const attMap: Record<string, Record<number, string>> = {};
    for (const r of attendanceRows) {
      const d = new Date(r.date);
      if (!attMap[r.employee_id]) attMap[r.employee_id] = {};
      attMap[r.employee_id][d.getDate()] = STATUS_TO_CODE[r.status] || 'P';
    }

    // Build CSV Headers
    const dayHeaders = Array.from({ length: totalDays }, (_, i) => String(i + 1));
    const headers = ['Employee ID', 'Employee Name', 'Department', ...dayHeaders, 'Present', 'Absent', 'Leave', 'Half Day', 'Holiday', 'Week Off'];

    const csvRows = [headers.join(',')];

    for (const emp of employees) {
      let present = 0, absent = 0, leave = 0, halfDay = 0, holiday = 0, weekOff = 0;
      const dayValues: string[] = [];

      for (let day = 1; day <= totalDays; day++) {
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay();
        let code = 'P';

        if (attMap[emp.id] && attMap[emp.id][day]) {
          code = attMap[emp.id][day];
        } else if (dayOfWeek === 0 || dayOfWeek === 6) {
          code = 'WO';
        }

        dayValues.push(code);

        if (code === 'P') present++;
        else if (code === 'A') absent++;
        else if (code === 'L') leave++;
        else if (code === 'HD') halfDay++;
        else if (code === 'H') holiday++;
        else if (code === 'WO') weekOff++;
      }

      const row = [
        `"${emp.employee_id}"`,
        `"${emp.first_name} ${emp.last_name}"`,
        `"${emp.department_name || 'General'}"`,
        ...dayValues,
        present,
        absent,
        leave,
        halfDay,
        holiday,
        weekOff,
      ];
      csvRows.push(row.join(','));
    }

    const csvData = csvRows.join('\n');
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const filename = `Attendance_${monthName}_${year}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attendance/my
 * Employee Self-Service Attendance view
 */
export async function getMyAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) {
      throw new AppError('No employee profile linked to your user account', 404);
    }

    const month = parseInt(req.query.month as string || String(new Date().getMonth() + 1), 10);
    const year = parseInt(req.query.year as string || String(new Date().getFullYear()), 10);
    const totalDays = new Date(year, month, 0).getDate();

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

    const records = await query<any[]>(
      `SELECT date, status, notes FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC`,
      [employeeId, startDateStr, endDateStr]
    );

    const dayMap: Record<number, string> = {};
    let present = 0, absent = 0, leave = 0, halfDay = 0, holiday = 0, weekOff = 0, notMarked = 0;

    for (const r of records) {
      const d = new Date(r.date);
      const code = STATUS_TO_CODE[r.status] || 'P';
      dayMap[d.getDate()] = code;
    }

    const days: Record<string, string> = {};
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      let code = dayMap[day] || (dayOfWeek === 0 || dayOfWeek === 6 ? 'WO' : 'NM');
      days[String(day)] = code;

      if (code === 'P') present++;
      else if (code === 'A') absent++;
      else if (code === 'L') leave++;
      else if (code === 'HD') halfDay++;
      else if (code === 'H') holiday++;
      else if (code === 'WO') weekOff++;
      else if (code === 'NM') notMarked++;
    }

    return sendSuccess(res, {
      month,
      year,
      totalDays,
      days,
      records,
      summary: {
        present,
        absent,
        leave,
        halfDay,
        holiday,
        weekOff,
        notMarked,
      },
    });
  } catch (error) {
    next(error);
  }
}
