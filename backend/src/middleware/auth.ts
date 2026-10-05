import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../config/db';
import { AppError } from './errorHandler';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  employeeId?: string | null;
  clientId?: string | null;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please provide a valid token.', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;

    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Token has expired. Please refresh your session.', 401);
      }
      throw new AppError('Invalid authentication token.', 401);
    }

    // Retrieve user and their active status
    const users = await query<any[]>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.status, u.locked_until,
              r.name as role_name,
              e.id as employee_record_id,
              c.id as client_record_id
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN employees e ON e.user_id = u.id AND e.deleted_at IS NULL
       LEFT JOIN clients c ON c.user_id = u.id
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (users.length === 0) {
      throw new AppError('User account not found.', 401);
    }

    const user = users[0];

    if (user.status !== 'active') {
      throw new AppError(`User account is ${user.status}. Please contact administrator.`, 403);
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account is temporarily locked due to multiple failed login attempts.', 403);
    }

    // Retrieve user permissions
    const permissionsRows = await query<any[]>(
      `SELECT p.name 
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );

    const permissions = permissionsRows.map((row) => row.name);

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roleId: user.role_id,
      roleName: user.role_name,
      employeeId: user.employee_record_id || null,
      clientId: user.client_record_id || null,
      permissions,
    };

    next();
  } catch (error) {
    next(error);
  }
}
