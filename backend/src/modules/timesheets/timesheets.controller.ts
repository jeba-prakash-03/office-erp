import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';
import { ApprovalService } from '../../services/approval.service';

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

    // Client isolation: Clients only see timesheets on their projects
    if (req.user?.clientId) {
      whereClause += ' AND p.client_id = ? AND ts.status = "approved"';
      params.push(req.user.clientId);
    } else if (req.query.myTimesheets === 'true' && req.user?.employeeId) {
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

    const countRows = await query<any[]>(
      `SELECT COUNT(*) as total 
       FROM timesheets ts 
       JOIN projects p ON ts.project_id = p.id
       ${whereClause}`,
      params
    );
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
    let employeeId = req.user?.employeeId;
    if (!employeeId && req.user?.id) {
      const empRows = await query<any[]>('SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', [req.user.id]);
      if (empRows.length > 0) employeeId = empRows[0].id;
    }
    if (!employeeId) throw new AppError('Employee profile required to log time', 400);

    const projectId = req.body.projectId || req.body.project_id;
    const taskId = req.body.taskId || req.body.task_id;
    const date = req.body.date || req.body.workDate || req.body.work_date;
    const rawHours = req.body.hours !== undefined ? req.body.hours : (req.body.hours_logged !== undefined ? req.body.hours_logged : req.body.hoursLogged);
    const description = req.body.description || req.body.work_description || req.body.workDescription || req.body.notes;
    const isBillable = req.body.isBillable !== undefined ? req.body.isBillable : (req.body.is_billable !== undefined ? req.body.is_billable : true);
    const startTime = req.body.startTime || req.body.start_time;
    const endTime = req.body.endTime || req.body.end_time;

    if (!projectId || !date || rawHours === undefined || rawHours === null || rawHours === '' || !description) {
      throw new AppError('Project, date, hours, and description are required', 400);
    }

    const parsedHours = parseFloat(String(rawHours));
    if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      throw new AppError('Hours must be a valid number between 0.1 and 24', 400);
    }

    // Verify project exists & get Project Manager
    const projRows = await query<any[]>('SELECT id, name, project_manager_id FROM projects WHERE id = ?', [projectId]);
    if (projRows.length === 0) {
      throw new AppError('Selected project does not exist', 404);
    }
    const project = projRows[0];

    // If task is specified, verify it belongs to project
    if (taskId) {
      const taskRows = await query<any[]>('SELECT id, project_id FROM tasks WHERE id = ?', [taskId]);
      if (taskRows.length === 0 || taskRows[0].project_id !== projectId) {
        throw new AppError('Selected task does not belong to this project', 400);
      }
    }

    const timesheetId = `ts-${uuidv4()}`;

    await query(
      `INSERT INTO timesheets (
        id, employee_id, project_id, task_id, date, start_time, end_time,
        hours, description, is_billable, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NOW())`,
      [
        timesheetId, employeeId, projectId, taskId || null, date,
        startTime || null, endTime || null, parsedHours, String(description).trim(),
        isBillable ? 1 : 0
      ]
    );

    // If task is linked, update task actual_hours
    if (taskId) {
      await query(
        'UPDATE tasks SET actual_hours = actual_hours + ? WHERE id = ?',
        [parsedHours, taskId]
      );
    }

    // Register with Universal Approval Engine
    await ApprovalService.submitRequest({
      entityType: 'timesheet',
      entityId: timesheetId,
      requesterId: employeeId,
      currentApproverId: project.project_manager_id || null,
      comments: `Timesheet log: ${parsedHours}h on ${project.name}`,
      actorUserId: req.user!.id,
      actorRole: req.user!.roleName,
    });

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
    const { status, remarks } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError('Status must be approved or rejected', 400);
    }

    const tsRows = await query<any[]>('SELECT * FROM timesheets WHERE id = ?', [id]);
    if (tsRows.length === 0) throw new AppError('Timesheet not found', 404);

    const timesheet = tsRows[0];

    // Self-approval guard: Cannot approve own timesheet
    if (timesheet.employee_id === req.user?.employeeId && req.user?.roleName !== 'super_admin') {
      throw new AppError('Self-approval violation: You cannot approve your own timesheet', 403);
    }

    await query(
      'UPDATE timesheets SET status = ?, approved_by_user_id = ?, updated_at = NOW() WHERE id = ?',
      [status, req.user!.id, id]
    );

    try {
      await ApprovalService.processDecision({
        entityType: 'timesheet',
        entityId: id,
        action: status === 'approved' ? 'approve' : 'reject',
        actorUserId: req.user!.id,
        actorEmployeeId: req.user!.employeeId,
        actorRole: req.user!.roleName,
        actorPermissions: req.user!.permissions,
        remarks,
      });
    } catch (e) {}

    res.json({ success: true, message: `Timesheet ${status} successfully` });
  } catch (error) {
    next(error);
  }
}

export async function deleteTimesheet(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const tsRows = await query<any[]>('SELECT * FROM timesheets WHERE id = ?', [id]);
    if (tsRows.length === 0) throw new AppError('Timesheet not found', 404);

    const timesheet = tsRows[0];
    const isOwner = req.user?.employeeId && timesheet.employee_id === req.user.employeeId;
    const isAdmin = req.user?.roleName === 'super_admin' || req.user?.roleName === 'admin' || req.user?.roleName === 'project_manager';

    if (!isOwner && !isAdmin) {
      throw new AppError('You do not have permission to delete this timesheet', 403);
    }

    // Revert task actual_hours if task linked
    if (timesheet.task_id && timesheet.hours) {
      await query(
        'UPDATE tasks SET actual_hours = GREATEST(0, actual_hours - ?) WHERE id = ?',
        [timesheet.hours, timesheet.task_id]
      );
    }

    await query('DELETE FROM timesheets WHERE id = ?', [id]);
    await query('DELETE FROM approval_requests WHERE entity_type = "timesheet" AND entity_id = ?', [id]);

    res.json({ success: true, message: 'Timesheet deleted successfully' });
  } catch (error) {
    next(error);
  }
}
