import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '12', 10);
    const search = req.query.search as string || '';
    const status = req.query.status as string || '';
    const priority = req.query.priority as string || '';
    const clientId = req.query.clientId as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Client portal isolation
    if (req.user?.roleName === 'client' && req.user?.clientId) {
      whereClause += ' AND p.client_id = ?';
      params.push(req.user.clientId);
    }

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.project_code LIKE ? OR c.company_name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }
    if (priority) {
      whereClause += ' AND p.priority = ?';
      params.push(priority);
    }
    if (clientId) {
      whereClause += ' AND p.client_id = ?';
      params.push(clientId);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM projects p LEFT JOIN clients c ON p.client_id = c.id ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT p.*, 
             c.company_name as client_name,
             c.client_code,
             CONCAT(pm.first_name, ' ', pm.last_name) as project_manager_name,
             pm.profile_photo as project_manager_photo,
             COUNT(DISTINCT t.id) as total_tasks,
             SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
             0 as total_expenses,
             COUNT(DISTINCT pmem.employee_id) as member_count
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN employees pm ON p.project_manager_id = pm.id
      LEFT JOIN tasks t ON t.project_id = p.id
      LEFT JOIN project_members pmem ON pmem.project_id = p.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const projects = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: projects,
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

export async function getProjectById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const projectRows = await query<any[]>(
      `SELECT p.*, 
              c.company_name as client_name, c.client_code,
              CONCAT(pm.first_name, ' ', pm.last_name) as project_manager_name,
              pm.email as project_manager_email,
              pm.profile_photo as project_manager_photo
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       LEFT JOIN employees pm ON p.project_manager_id = pm.id
       WHERE p.id = ?`,
      [id]
    );

    if (projectRows.length === 0) throw new AppError('Project not found', 404);

    const project = projectRows[0];

    // Client isolation check
    if (req.user?.roleName === 'client' && req.user?.clientId !== project.client_id) {
      throw new AppError('Forbidden: Access denied to this project', 403);
    }

    // Team members
    const members = await query<any[]>(
      `SELECT pm.role as project_role, pm.assigned_at,
              e.id as employee_id, e.employee_id as employee_code,
              e.first_name, e.last_name, e.email, e.designation, e.profile_photo
       FROM project_members pm
       JOIN employees e ON pm.employee_id = e.id
       WHERE pm.project_id = ?`,
      [id]
    );

    // Tasks
    const tasks = await query<any[]>(
      `SELECT t.*, 
              CONCAT(e.first_name, ' ', e.last_name) as assigned_employee_name,
              e.profile_photo as assigned_employee_photo
       FROM tasks t
       LEFT JOIN employees e ON t.assigned_employee_id = e.id
       WHERE t.project_id = ?
       ORDER BY t.due_date ASC, t.created_at DESC`,
      [id]
    );

    // Timesheets
    const timesheets = await query<any[]>(
      `SELECT ts.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
       FROM timesheets ts
       JOIN employees e ON ts.employee_id = e.id
       WHERE ts.project_id = ?
       ORDER BY ts.date DESC`,
      [id]
    );

    // Expenses
    const expenses = await query<any[]>(
      `SELECT exp.*, exp.category as category_name, CONCAT(u.first_name, ' ', u.last_name) as added_by_name
       FROM expenses exp
       LEFT JOIN users u ON exp.created_by_user_id = u.id
       ORDER BY exp.date DESC LIMIT 20`
    );

    // Files / Documents
    const files = await query<any[]>(
      "SELECT * FROM documents WHERE entity_type = 'project' AND entity_id = ? ORDER BY created_at DESC",
      [id]
    );

    res.json({
      success: true,
      data: {
        ...project,
        members,
        tasks,
        timesheets,
        expenses,
        files,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const projectCode = req.body.projectCode || req.body.project_code || `PRJ-${Math.floor(1000 + Math.random() * 9000)}`;
    const name = req.body.name || req.body.projectName || req.body.title;
    const clientId = req.body.clientId || req.body.client_id || null;
    const description = req.body.description || null;
    const projectManagerId = req.body.projectManagerId || req.body.project_manager_id || null;
    const startDate = req.body.startDate || req.body.start_date || new Date().toISOString().split('T')[0];
    const endDate = req.body.endDate || req.body.end_date || req.body.deadline || null;
    const budget = req.body.budget || 0.00;
    const status = req.body.status || 'planning';
    const priority = req.body.priority || 'medium';
    const memberIds = req.body.memberIds || req.body.member_ids || [];

    if (!name) {
      throw new AppError('Project Name is required', 400);
    }

    const projectId = `proj-${uuidv4()}`;

    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO projects (
          id, project_code, name, client_id, description, project_manager_id,
          start_date, end_date, budget, status, priority, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          projectId, projectCode.trim(), name.trim(), clientId || null, description || null,
          projectManagerId || null, startDate, endDate || null, budget || 0.00,
          status || 'planning', priority || 'medium'
        ]
      );

      // Add Project Manager as member if assigned
      if (projectManagerId) {
        await conn.query(
          `INSERT IGNORE INTO project_members (project_id, employee_id, role, assigned_at)
           VALUES (?, ?, 'Project Manager', NOW())`,
          [projectId, projectManagerId]
        );
      }

      // Add additional members
      if (Array.isArray(memberIds)) {
        for (const empId of memberIds) {
          if (empId) {
            await conn.query(
              `INSERT IGNORE INTO project_members (project_id, employee_id, role, assigned_at)
               VALUES (?, ?, 'Member', NOW())`,
              [projectId, empId]
            );
          }
        }
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_PROJECT',
      module: 'PROJECTS',
      recordId: projectId,
      newValue: { projectCode, name, clientId, budget },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Project created successfully', data: { id: projectId } });
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const {
      name, clientId, description, projectManagerId,
      startDate, endDate, budget, status, priority
    } = req.body;

    const existing = await query<any[]>('SELECT * FROM projects WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('Project not found', 404);

    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE projects 
         SET name = COALESCE(?, name),
             client_id = ?,
             description = COALESCE(?, description),
             project_manager_id = ?,
             start_date = COALESCE(?, start_date),
             end_date = ?,
             budget = COALESCE(?, budget),
             status = COALESCE(?, status),
             priority = COALESCE(?, priority)
         WHERE id = ?`,
        [
          name, clientId || null, description, projectManagerId || null,
          startDate, endDate || null, budget, status, priority, id
        ]
      );

      if (Array.isArray(memberIds)) {
        await conn.query('DELETE FROM project_members WHERE project_id = ?', [id]);
        if (projectManagerId) {
          await conn.query(
            `INSERT IGNORE INTO project_members (project_id, employee_id, role, assigned_at)
             VALUES (?, ?, 'Project Manager', NOW())`,
            [id, projectManagerId]
          );
        }
        for (const empId of memberIds) {
          if (empId) {
            await conn.query(
              `INSERT IGNORE INTO project_members (project_id, employee_id, role, assigned_at)
               VALUES (?, ?, 'Member', NOW())`,
              [id, empId]
            );
          }
        }
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_PROJECT',
      module: 'PROJECTS',
      recordId: id,
      previousValue: existing[0],
      newValue: req.body,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Project updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = await query<any[]>('SELECT * FROM projects WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('Project not found', 404);

    await query('DELETE FROM projects WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'DELETE_PROJECT',
      module: 'PROJECTS',
      recordId: id,
      previousValue: existing[0],
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
}
