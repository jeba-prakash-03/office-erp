import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listTimesheets(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const projectId = req.query.projectId as string || '';
    const employeeId = req.query.employeeId as string || '';
    const status = req.query.status as string || '';
    const startDate = req.query.startDate as string || '';
    const endDate = req.query.endDate as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (req.query.myTimesheets === 'true' && req.user?.employeeId) {
      whereClause += ' AND ts.employee_id = ?';
      params.push(req.user.employeeId);
    } else if (employeeId) {
      whereClause += ' AND ts.employee_id = ?';
      params.push(employeeId);
    }

    if (projectId) {
      whereClause += ' AND ts.project_id = ?';
      params.push(projectId);
    }
    if (status) {
      whereClause += ' AND ts.status = ?';
      params.push(status);
    }
    if (startDate && endDate) {
      whereClause += ' AND ts.date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM timesheets ts ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT ts.*, 
             p.name as project_name, p.project_code,
             t.title as task_title, t.task_code,
             e.employee_id as employee_code,
             CONCAT(e.first_name, ' ', e.last_name) as employee_name,
             e.profile_photo,
             CONCAT(u.first_name, ' ', u.last_name) as approved_by_name
      FROM timesheets ts
      JOIN projects p ON ts.project_id = p.id
      JOIN employees e ON ts.employee_id = e.id
      LEFT JOIN tasks t ON ts.task_id = t.id
      LEFT JOIN users u ON ts.approved_by_user_id = u.id
      ${whereClause}
      ORDER BY ts.date DESC, ts.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const timesheets = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: timesheets,
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

export async function logTimesheet(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) throw new AppError('Employee profile required to log time', 400);

    const { projectId, taskId, date, startTime, endTime, hours, description, isBillable } = req.body;
    if (!projectId || !date || !hours || !description) {
      throw new AppError('Project, date, hours, and description are required', 400);
    }

    const parsedHours = parseFloat(hours);
    const timesheetId = `ts-${uuidv4()}`;

    await query(
      `INSERT INTO timesheets (
        id, employee_id, project_id, task_id, date, start_time, end_time,
        hours, description, is_billable, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NOW())`,
      [
        timesheetId, employeeId, projectId, taskId || null, date,
        startTime || null, endTime || null, parsedHours, description.trim(),
        isBillable !== false ? 1 : 0
      ]
    );

    // If task is linked, update task actual_hours
    if (taskId) {
      await query(
        'UPDATE tasks SET actual_hours = actual_hours + ? WHERE id = ?',
        [parsedHours, taskId]
      );
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'LOG_TIMESHEET',
      module: 'TIMESHEETS',
      recordId: timesheetId,
      newValue: { projectId, hours: parsedHours, date },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Timesheet logged successfully', data: { id: timesheetId } });
  } catch (error) {
    next(error);
  }
}

export async function reviewTimesheet(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError('Status must be approved or rejected', 400);
    }

    await query(
      'UPDATE timesheets SET status = ?, approved_by_user_id = ? WHERE id = ?',
      [status, req.user!.id, id]
    );

    res.json({ success: true, message: `Timesheet ${status} successfully` });
  } catch (error) {
    next(error);
  }
}

export async function deleteTimesheet(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM timesheets WHERE id = ?', [id]);
    res.json({ success: true, message: 'Timesheet deleted successfully' });
  } catch (error) {
    next(error);
  }
}
