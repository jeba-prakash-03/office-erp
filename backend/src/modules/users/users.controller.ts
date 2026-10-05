import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const search = req.query.search as string || '';
    const status = req.query.status as string || '';
    const roleId = req.query.roleId as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status) {
      whereClause += ' AND u.status = ?';
      params.push(status);
    }
    if (roleId) {
      whereClause += ' AND u.role_id = ?';
      params.push(roleId);
    }

    const countSql = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const totalRows = await query<any[]>(countSql, params);
    const total = totalRows[0]?.total || 0;

    const dataSql = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.status, u.role_id,
             u.last_login_at, u.created_at,
             r.name as role_name, r.display_name as role_display_name,
             e.id as employee_id, e.employee_id as employee_code
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON e.user_id = u.id AND e.deleted_at IS NULL
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const users = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: users,
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

export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const users = await query<any[]>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.status, u.role_id,
              u.last_login_at, u.created_at,
              r.name as role_name, r.display_name as role_display_name,
              e.id as employee_id, e.employee_id as employee_code, e.designation
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN employees e ON e.user_id = u.id AND e.deleted_at IS NULL
       WHERE u.id = ?`,
      [id]
    );

    if (users.length === 0) {
      throw new AppError('User not found', 404);
    }

    res.json({ success: true, data: users[0] });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, firstName, lastName, roleId, status, phone } = req.body;

    if (!email || !password || !firstName || !lastName || !roleId) {
      throw new AppError('Email, password, first name, last name, and role are required', 400);
    }

    const existing = await query<any[]>('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      throw new AppError('User with this email already exists', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = uuidv4();

    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, phone, email_verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [userId, email.toLowerCase().trim(), passwordHash, firstName, lastName, roleId, status || 'active', phone || null]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_USER',
      module: 'USERS',
      recordId: userId,
      newValue: { email, firstName, lastName, roleId, status },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'User created successfully', data: { id: userId } });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { firstName, lastName, roleId, status, phone, password } = req.body;

    const existing = await query<any[]>('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('User not found', 404);

    let passwordHash = existing[0].password_hash;
    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    await query(
      `UPDATE users 
       SET first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           role_id = COALESCE(?, role_id),
           status = COALESCE(?, status),
           phone = COALESCE(?, phone),
           password_hash = ?
       WHERE id = ?`,
      [firstName, lastName, roleId, status, phone, passwordHash, id]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_USER',
      module: 'USERS',
      recordId: id,
      previousValue: existing[0],
      newValue: { firstName, lastName, roleId, status, phone },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (id === req.user?.id) {
      throw new AppError('You cannot delete your own account', 400);
    }

    const existing = await query<any[]>('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('User not found', 404);

    await query('UPDATE users SET status = "inactive" WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'DEACTIVATE_USER',
      module: 'USERS',
      recordId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    next(error);
  }
}
