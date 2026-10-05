import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listDepartments(req: Request, res: Response, next: NextFunction) {
  try {
    const departments = await query<any[]>(
      `SELECT d.*, 
              COUNT(DISTINCT e.id) as employee_count,
              CONCAT(m.first_name, ' ', m.last_name) as manager_name,
              m.email as manager_email,
              m.profile_photo as manager_photo
       FROM departments d
       LEFT JOIN employees e ON e.department_id = d.id AND e.deleted_at IS NULL
       LEFT JOIN employees m ON d.manager_id = m.id AND m.deleted_at IS NULL
       GROUP BY d.id
       ORDER BY d.name ASC`
    );

    res.json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
}

export async function getDepartmentById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const depts = await query<any[]>(
      `SELECT d.*, 
              CONCAT(m.first_name, ' ', m.last_name) as manager_name,
              m.email as manager_email,
              m.profile_photo as manager_photo
       FROM departments d
       LEFT JOIN employees m ON d.manager_id = m.id AND m.deleted_at IS NULL
       WHERE d.id = ?`,
      [id]
    );

    if (depts.length === 0) throw new AppError('Department not found', 404);

    const employees = await query<any[]>(
      `SELECT id, employee_id, first_name, last_name, email, phone, designation, profile_photo, employment_status, basic_salary
       FROM employees 
       WHERE department_id = ? AND deleted_at IS NULL
       ORDER BY first_name ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...depts[0],
        employees,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, managerId, status } = req.body;
    if (!name) throw new AppError('Department name is required', 400);

    const existing = await query<any[]>('SELECT id FROM departments WHERE name = ?', [name.trim()]);
    if (existing.length > 0) throw new AppError('Department with this name already exists', 409);

    const id = `dept-${uuidv4()}`;
    await query(
      `INSERT INTO departments (id, name, description, manager_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, name.trim(), description || null, managerId || null, status || 'active']
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_DEPARTMENT',
      module: 'DEPARTMENTS',
      recordId: id,
      newValue: { name, description, managerId },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Department created successfully', data: { id } });
  } catch (error) {
    next(error);
  }
}

export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, description, managerId, status } = req.body;

    const existing = await query<any[]>('SELECT * FROM departments WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('Department not found', 404);

    await query(
      `UPDATE departments 
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           manager_id = ?,
           status = COALESCE(?, status)
       WHERE id = ?`,
      [name ? name.trim() : null, description, managerId || null, status, id]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_DEPARTMENT',
      module: 'DEPARTMENTS',
      recordId: id,
      previousValue: existing[0],
      newValue: req.body,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Department updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = await query<any[]>('SELECT * FROM departments WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('Department not found', 404);

    const empCount = await query<any[]>('SELECT COUNT(*) as count FROM employees WHERE department_id = ? AND deleted_at IS NULL', [id]);
    if (empCount[0]?.count > 0) {
      throw new AppError(`Cannot delete department: ${empCount[0].count} active employees are assigned to it. Please reassign them first.`, 400);
    }

    await query('DELETE FROM departments WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'DELETE_DEPARTMENT',
      module: 'DEPARTMENTS',
      recordId: id,
      previousValue: existing[0],
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    next(error);
  }
}
