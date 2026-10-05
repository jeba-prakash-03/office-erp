import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const search = req.query.search as string || '';
    const status = req.query.status as string || '';
    const priority = req.query.priority as string || '';
    const projectId = req.query.projectId as string || '';
    const assignedEmployeeId = req.query.assignedEmployeeId as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Client portal isolation
    if (req.user?.roleName === 'client' && req.user?.clientId) {
      whereClause += ' AND p.client_id = ?';
      params.push(req.user.clientId);
    }

    // Employee isolation for "My Tasks" if non-admin and filtering self
    if (req.query.myTasks === 'true' && req.user?.employeeId) {
      whereClause += ' AND t.assigned_employee_id = ?';
      params.push(req.user.employeeId);
    }

    if (search) {
      whereClause += ' AND (t.title LIKE ? OR t.task_code LIKE ? OR p.name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }
    if (priority) {
      whereClause += ' AND t.priority = ?';
      params.push(priority);
    }
    if (projectId) {
      whereClause += ' AND t.project_id = ?';
      params.push(projectId);
    }
    if (assignedEmployeeId) {
      whereClause += ' AND t.assigned_employee_id = ?';
      params.push(assignedEmployeeId);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM tasks t JOIN projects p ON t.project_id = p.id ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT t.*, 
             p.name as project_name, p.project_code,
             CONCAT(e.first_name, ' ', e.last_name) as assigned_employee_name,
             e.profile_photo as assigned_employee_photo,
             CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
             COUNT(DISTINCT tc.id) as comment_count,
             COUNT(DISTINCT chk.id) as checklist_total,
             SUM(CASE WHEN chk.is_completed = 1 THEN 1 ELSE 0 END) as checklist_completed
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN employees e ON t.assigned_employee_id = e.id
      LEFT JOIN users cu ON t.created_by_user_id = cu.id
      LEFT JOIN task_comments tc ON tc.task_id = t.id
      LEFT JOIN task_checklists chk ON chk.task_id = t.id
      ${whereClause}
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const tasks = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: tasks,
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

export async function getKanbanTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.query.projectId as string || '';
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (projectId) {
      whereClause += ' AND t.project_id = ?';
      params.push(projectId);
    }
    if (req.user?.roleName === 'client' && req.user?.clientId) {
      whereClause += ' AND p.client_id = ?';
      params.push(req.user.clientId);
    }

    const tasks = await query<any[]>(
      `SELECT t.*, 
              p.name as project_name,
              CONCAT(e.first_name, ' ', e.last_name) as assigned_employee_name,
              e.profile_photo as assigned_employee_photo,
              COUNT(DISTINCT tc.id) as comment_count,
              COUNT(DISTINCT chk.id) as checklist_total,
              SUM(CASE WHEN chk.is_completed = 1 THEN 1 ELSE 0 END) as checklist_completed
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN employees e ON t.assigned_employee_id = e.id
       LEFT JOIN task_comments tc ON tc.task_id = t.id
       LEFT JOIN task_checklists chk ON chk.task_id = t.id
       ${whereClause}
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      params
    );

    const kanban = {
      backlog: tasks.filter((t) => t.status === 'backlog'),
      todo: tasks.filter((t) => t.status === 'todo'),
      in_progress: tasks.filter((t) => t.status === 'in_progress'),
      review: tasks.filter((t) => t.status === 'review'),
      blocked: tasks.filter((t) => t.status === 'blocked'),
      completed: tasks.filter((t) => t.status === 'completed'),
    };

    res.json({ success: true, data: kanban });
  } catch (error) {
    next(error);
  }
}

export async function getTaskById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const taskRows = await query<any[]>(
      `SELECT t.*, 
              p.name as project_name, p.project_code,
              CONCAT(e.first_name, ' ', e.last_name) as assigned_employee_name,
              e.email as assigned_employee_email,
              e.profile_photo as assigned_employee_photo,
              CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN employees e ON t.assigned_employee_id = e.id
       LEFT JOIN users cu ON t.created_by_user_id = cu.id
       WHERE t.id = ?`,
      [id]
    );

    if (taskRows.length === 0) throw new AppError('Task not found', 404);

    const task = taskRows[0];

    // Comments
    const comments = await query<any[]>(
      `SELECT tc.*, 
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              u.avatar_url
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = ?
       ORDER BY tc.created_at ASC`,
      [id]
    );

    // Attachments
    const attachments = await query<any[]>(
      `SELECT ta.*, CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
       FROM task_attachments ta
       LEFT JOIN users u ON ta.uploaded_by_user_id = u.id
       WHERE ta.task_id = ?
       ORDER BY ta.created_at DESC`,
      [id]
    );

    // Checklists
    const checklists = await query<any[]>(
      'SELECT * FROM task_checklists WHERE task_id = ? ORDER BY sort_order ASC, created_at ASC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...task,
        comments,
        attachments,
        checklists,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      taskCode, title, description, projectId, assignedEmployeeId,
      priority, status, dueDate, estimatedHours, checklists
    } = req.body;

    if (!title || !projectId) {
      throw new AppError('Task title and project are required', 400);
    }

    const code = taskCode || `TSK-${Math.floor(1000 + Math.random() * 9000)}`;
    const taskId = `task-${uuidv4()}`;

    // Get client ID from project
    const projRows = await query<any[]>('SELECT client_id FROM projects WHERE id = ?', [projectId]);
    const clientId = projRows[0]?.client_id || null;

    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO tasks (
          id, task_code, title, description, project_id, client_id,
          assigned_employee_id, created_by_user_id, priority, status,
          due_date, estimated_hours, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          taskId, code, title.trim(), description || null, projectId, clientId,
          assignedEmployeeId || null, req.user?.id || null, priority || 'medium',
          status || 'todo', dueDate || null, estimatedHours || 0.00
        ]
      );

      // Add Checklists if provided
      if (Array.isArray(checklists)) {
        for (let i = 0; i < checklists.length; i++) {
          const item = checklists[i];
          if (item && item.title) {
            await conn.query(
              `INSERT INTO task_checklists (id, task_id, title, is_completed, sort_order, created_at)
               VALUES (?, ?, ?, 0, ?, NOW())`,
              [uuidv4(), taskId, item.title, i]
            );
          }
        }
      }

      // If assigned, create a notification for that employee's user
      if (assignedEmployeeId) {
        const empUser = await conn.query('SELECT user_id FROM employees WHERE id = ?', [assignedEmployeeId]);
        const userRows = empUser[0] as any[];
        if (userRows[0]?.user_id) {
          await conn.query(
            `INSERT INTO notifications (id, user_id, title, message, type, link, created_at)
             VALUES (?, ?, ?, ?, 'task_assignment', ?, NOW())`,
            [uuidv4(), userRows[0].user_id, 'New Task Assigned', `You have been assigned to task: "${title}"`, `/tasks/${taskId}`]
          );
        }
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_TASK',
      module: 'TASKS',
      recordId: taskId,
      newValue: { taskCode: code, title, projectId, assignedEmployeeId },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Task created successfully', data: { id: taskId } });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const {
      title, description, assignedEmployeeId, priority, status,
      dueDate, estimatedHours, actualHours
    } = req.body;

    const existing = await query<any[]>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('Task not found', 404);

    const oldStatus = existing[0].status;
    const completedAt = (status === 'completed' && oldStatus !== 'completed') ? new Date() : (status && status !== 'completed' ? null : existing[0].completed_at);

    await query(
      `UPDATE tasks 
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           assigned_employee_id = ?,
           priority = COALESCE(?, priority),
           status = COALESCE(?, status),
           due_date = ?,
           estimated_hours = COALESCE(?, estimated_hours),
           actual_hours = COALESCE(?, actual_hours),
           completed_at = ?
       WHERE id = ?`,
      [
        title, description, assignedEmployeeId || null,
        priority, status, dueDate || null, estimatedHours,
        actualHours, completedAt, id
      ]
    );

    // If status changed to completed, notify creator
    if (status === 'completed' && oldStatus !== 'completed' && existing[0].created_by_user_id) {
      await query(
        `INSERT INTO notifications (id, user_id, title, message, type, link, created_at)
         VALUES (?, ?, ?, ?, 'task_status', ?, NOW())`,
        [uuidv4(), existing[0].created_by_user_id, 'Task Completed', `Task "${existing[0].title}" was marked as completed.`, `/tasks/${id}`]
      );
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_TASK',
      module: 'TASKS',
      recordId: id,
      previousValue: existing[0],
      newValue: req.body,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function addTaskComment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) throw new AppError('Comment text cannot be empty', 400);

    const commentId = uuidv4();
    await query(
      `INSERT INTO task_comments (id, task_id, user_id, comment, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [commentId, id, req.user!.id, comment.trim()]
    );

    res.status(201).json({ success: true, message: 'Comment added successfully', data: { id: commentId } });
  } catch (error) {
    next(error);
  }
}

export async function addTaskAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) throw new AppError('File upload required', 400);

    const attachId = uuidv4();
    const fileUrl = `/uploads/${file.filename}`;

    await query(
      `INSERT INTO task_attachments (id, task_id, file_name, file_url, file_size, mime_type, uploaded_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [attachId, id, file.originalname, fileUrl, file.size, file.mimetype, req.user!.id]
    );

    res.status(201).json({ success: true, message: 'Attachment uploaded successfully', data: { id: attachId, fileUrl } });
  } catch (error) {
    next(error);
  }
}

export async function toggleChecklistItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { checklistId } = req.params;
    const { isCompleted } = req.body;

    await query('UPDATE task_checklists SET is_completed = ? WHERE id = ?', [isCompleted ? 1 : 0, checklistId]);
    res.json({ success: true, message: 'Checklist updated' });
  } catch (error) {
    next(error);
  }
}

export async function addChecklistItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (!title) throw new AppError('Title is required', 400);

    const checklistId = uuidv4();
    await query(
      `INSERT INTO task_checklists (id, task_id, title, is_completed, created_at)
       VALUES (?, ?, ?, 0, NOW())`,
      [checklistId, id, title.trim()]
    );

    res.status(201).json({ success: true, message: 'Checklist item added', data: { id: checklistId } });
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
}
