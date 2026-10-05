import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await query<any[]>(
      `SELECT r.*, COUNT(u.id) as user_count,
              COUNT(DISTINCT rp.permission_id) as permission_count
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       GROUP BY r.id
       ORDER BY r.is_system DESC, r.name ASC`
    );

    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
}

export async function getRolePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const permissions = await query<any[]>(
      `SELECT p.*, (rp.permission_id IS NOT NULL) as is_assigned
       FROM permissions p
       LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = ?
       ORDER BY p.module ASC, p.name ASC`,
      [id]
    );

    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
}

export async function listAllPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const permissions = await query<any[]>('SELECT * FROM permissions ORDER BY module ASC, name ASC');
    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
}

export async function updateRolePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    if (!Array.isArray(permissionIds)) {
      throw new AppError('permissionIds must be an array of permission IDs', 400);
    }

    const role = await query<any[]>('SELECT * FROM roles WHERE id = ?', [id]);
    if (role.length === 0) throw new AppError('Role not found', 404);

    await withTransaction(async (conn) => {
      await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [id]);
      for (const permId of permissionIds) {
        await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [id, permId]);
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_ROLE_PERMISSIONS',
      module: 'ROLES',
      recordId: id,
      newValue: { permissionCount: permissionIds.length },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Role permissions updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, displayName, description, permissionIds } = req.body;
    if (!name || !displayName) throw new AppError('Name and display name are required', 400);

    const formattedName = name.toLowerCase().trim().replace(/\s+/g, '_');
    const existing = await query<any[]>('SELECT id FROM roles WHERE name = ?', [formattedName]);
    if (existing.length > 0) throw new AppError('A role with this name already exists', 409);

    const roleId = `role-${uuidv4()}`;

    await withTransaction(async (conn) => {
      await conn.query(
        'INSERT INTO roles (id, name, display_name, description, is_system, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
        [roleId, formattedName, displayName, description || null]
      );

      if (Array.isArray(permissionIds) && permissionIds.length > 0) {
        for (const permId of permissionIds) {
          await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permId]);
        }
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_ROLE',
      module: 'ROLES',
      recordId: roleId,
      newValue: { name: formattedName, displayName },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Role created successfully', data: { id: roleId } });
  } catch (error) {
    next(error);
  }
}
