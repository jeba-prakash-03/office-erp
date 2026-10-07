import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';
import { sendSuccess, sendCreated } from '../../utils/response';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

function generateTokens(userId: string, email: string, roleName: string) {
  const accessToken = jwt.sign(
    { userId, email, role: roleName } as TokenPayload,
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as any }
  );

  const refreshToken = jwt.sign(
    { userId, email, tokenVersion: uuidv4() },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn as any }
  );

  return { accessToken, refreshToken };
}

/**
 * Register First Super Admin (Initial System Setup only)
 */
export async function registerFirstAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password || !firstName || !lastName) {
      throw new AppError('Email, password, first name, and last name are required', 400);
    }

    const userCountRows = await query<[{ total: number }]>('SELECT COUNT(*) as total FROM users');
    if (userCountRows[0].total > 0) {
      throw new AppError('Initial setup is already complete. Please login or contact the administrator.', 403, 'SETUP_COMPLETED');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = uuidv4();

    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, phone, email_verified, created_at)
       VALUES (?, ?, ?, ?, ?, 'role-super-admin', 'active', ?, 1, NOW())`,
      [userId, email.toLowerCase().trim(), passwordHash, firstName, lastName, phone || null]
    );

    const { accessToken, refreshToken } = generateTokens(userId, email, 'super_admin');
    await query('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, userId]);

    await logAudit({
      userId,
      userEmail: email,
      userName: `${firstName} ${lastName}`,
      action: 'INITIAL_ADMIN_SETUP',
      module: 'AUTH',
      ipAddress: req.ip,
    });

    return sendCreated(res, {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        roleId: 'role-super-admin',
        roleName: 'super_admin',
        roleDisplayName: 'Super Admin',
      },
    }, 'Super Admin account created successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * User Login
 * Supports:
 * 1. Email + password
 * 2. Employee ID + password (e.g. EMP-001)
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const identifier = (req.body.email || req.body.identifier || req.body.employeeId || '').toLowerCase().trim();
    const { password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    if (!identifier || !password) {
      throw new AppError('Email or Employee ID and password are required', 400);
    }

    interface UserRow {
      id: string;
      email: string;
      password_hash: string;
      first_name: string;
      last_name: string;
      role_id: string;
      role_name: string;
      role_display_name: string;
      status: string;
      avatar_url: string | null;
      phone: string | null;
      failed_login_attempts: number;
      locked_until: Date | null;
    }

    // Lookup user by either email OR linked employee_id
    const users = await query<UserRow[]>(
      `SELECT u.*, r.name as role_name, r.display_name as role_display_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN employees e ON e.user_id = u.id AND e.deleted_at IS NULL
       WHERE LOWER(u.email) = ? OR LOWER(e.employee_id) = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    if (users.length === 0) {
      throw new AppError('Invalid credentials. Please check your email/employee ID and password.', 401, 'INVALID_CREDENTIALS');
    }

    const user = users[0];

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account is temporarily locked due to multiple failed login attempts. Please try again later.', 403, 'ACCOUNT_LOCKED');
    }

    // Verify status
    if (user.status !== 'active') {
      throw new AppError(`Account is ${user.status}. Please contact your administrator.`, 403, 'ACCOUNT_INACTIVE');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const failedCount = (user.failed_login_attempts || 0) + 1;
      if (failedCount >= 5) {
        await query(
          'UPDATE users SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
          [failedCount, user.id]
        );
      } else {
        await query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [failedCount, user.id]);
      }

      await query(
        'INSERT INTO login_history (id, user_id, ip_address, user_agent, status, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [uuidv4(), user.id, ip, userAgent, 'failed', 'Invalid password']
      );

      throw new AppError('Invalid credentials. Please check your email/employee ID and password.', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens & track session
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role_name);
    const sessionId = uuidv4();
    const tokenHash = await bcrypt.hash(refreshToken.slice(-10), 6);

    await query(
      `UPDATE users 
       SET refresh_token = ?, failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = ?
       WHERE id = ?`,
      [refreshToken, ip, user.id]
    );

    // Save session
    await query(
      `INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, device, last_active_at, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), NOW())`,
      [sessionId, user.id, tokenHash, ip, userAgent, userAgent.includes('Mobile') ? 'Mobile' : 'Desktop']
    );

    await query(
      'INSERT INTO login_history (id, user_id, ip_address, user_agent, status, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [uuidv4(), user.id, ip, userAgent, 'success', null]
    );

    // Permissions
    const permissionsRows = await query<{ name: string }[]>(
      `SELECT p.name 
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );
    const permissions = permissionsRows.map((r) => r.name);

    // Linked employee details
    const empRows = await query<any[]>(
      `SELECT e.id, e.employee_id, e.first_name, e.last_name, e.designation, e.department_id, d.name as department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.user_id = ? AND e.deleted_at IS NULL`,
      [user.id]
    );

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.first_name} ${user.last_name}`,
      action: 'LOGIN',
      module: 'AUTH',
      ipAddress: ip,
      userAgent,
    });

    return sendSuccess(res, {
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roleId: user.role_id,
        roleName: user.role_name,
        roles: [user.role_name],
        roleDisplayName: user.role_display_name,
        companyId: 'company-default',
        employeeId: empRows[0]?.id || null,
        departmentId: empRows[0]?.department_id || null,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        employee: empRows[0] ? {
          id: empRows[0].id,
          employeeCode: empRows[0].employee_id,
          designation: empRows[0].designation,
          departmentId: empRows[0].department_id,
          departmentName: empRows[0].department_name,
        } : null,
        permissions,
      },
    }, undefined, 200, 'Login successful');
  } catch (error) {
    next(error);
  }
}

/**
 * Google Login Endpoint (/api/auth/google)
 */
export async function googleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, googleId, firstName, lastName, avatarUrl } = req.body;
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';

    if (!email) {
      throw new AppError('Google login requires verified email', 400);
    }

    const cleanEmail = email.toLowerCase().trim();

    const users = await query<any[]>(
      `SELECT u.*, r.name as role_name, r.display_name as role_display_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.email) = ?`,
      [cleanEmail]
    );

    let user: any;

    if (users.length > 0) {
      user = users[0];
      if (user.status !== 'active') {
        throw new AppError(`Account is ${user.status}. Please contact your administrator.`, 403);
      }
      if (googleId && !user.google_id) {
        await query('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?', [googleId, avatarUrl || null, user.id]);
      }
    } else {
      // Auto-register new Google user with employee role
      const newUserId = uuidv4();
      const defaultPass = await bcrypt.hash(uuidv4(), 10);
      await query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, google_id, avatar_url, email_verified)
         VALUES (?, ?, ?, ?, ?, 'role-employee', 'active', ?, ?, 1)`,
        [newUserId, cleanEmail, defaultPass, firstName || 'Google', lastName || 'User', googleId || null, avatarUrl || null]
      );
      const newUsers = await query<any[]>(
        `SELECT u.*, r.name as role_name, r.display_name as role_display_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [newUserId]
      );
      user = newUsers[0];
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role_name);

    await query(
      `UPDATE users SET refresh_token = ?, last_login_at = NOW(), last_login_ip = ? WHERE id = ?`,
      [refreshToken, ip, user.id]
    );

    const permissionsRows = await query<{ name: string }[]>(
      `SELECT p.name FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?`,
      [user.role_id]
    );
    const permissions = permissionsRows.map((r) => r.name);

    const empRows = await query<any[]>(
      `SELECT e.id, e.employee_id, e.first_name, e.last_name, e.designation, e.department_id, d.name as department_name
       FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.user_id = ? AND e.deleted_at IS NULL`,
      [user.id]
    );

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.first_name} ${user.last_name}`,
      action: 'GOOGLE_LOGIN',
      module: 'AUTH',
      ipAddress: ip,
      userAgent,
    });

    return sendSuccess(res, {
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roleId: user.role_id,
        roleName: user.role_name,
        roles: [user.role_name],
        roleDisplayName: user.role_display_name,
        companyId: 'company-default',
        employeeId: empRows[0]?.id || null,
        departmentId: empRows[0]?.department_id || null,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        employee: empRows[0] ? {
          id: empRows[0].id,
          employeeCode: empRows[0].employee_id,
          designation: empRows[0].designation,
          departmentId: empRows[0].department_id,
          departmentName: empRows[0].department_name,
        } : null,
        permissions,
      },
    }, undefined, 200, 'Google Login successful');
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh Token
 */
export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new AppError('Refresh token is required', 400);

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret);
    } catch {
      throw new AppError('Invalid or expired refresh token. Please login again.', 401, 'INVALID_REFRESH_TOKEN');
    }

    const users = await query<any[]>(
      `SELECT u.id, u.email, u.status, r.name as role_name 
       FROM users u JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? AND u.refresh_token = ?`,
      [decoded.userId, token]
    );

    if (users.length === 0) {
      throw new AppError('Invalid session. Please login again.', 401, 'INVALID_SESSION');
    }

    const user = users[0];
    if (user.status !== 'active') {
      throw new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
    }

    const tokens = generateTokens(user.id, user.email, user.role_name);
    await query('UPDATE users SET refresh_token = ? WHERE id = ?', [tokens.refreshToken, user.id]);

    return sendSuccess(res, tokens, undefined, 200, 'Token refreshed successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Logout
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user) {
      await query('UPDATE users SET refresh_token = NULL WHERE id = ?', [req.user.id]);
      await query('DELETE FROM user_sessions WHERE user_id = ?', [req.user.id]);
      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        action: 'LOGOUT',
        module: 'AUTH',
        ipAddress: req.ip,
      });
    }
    return sendSuccess(res, { loggedOut: true }, undefined, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Current Authenticated User (/api/auth/me)
 */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;

    const users = await query<any[]>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.status, u.role_id,
              r.name as role_name, r.display_name as role_display_name,
              e.id as employee_id, e.employee_id as employee_code, e.designation, e.department_id,
              d.name as department_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN employees e ON e.user_id = u.id AND e.deleted_at IS NULL
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) throw new AppError('User not found', 404);
    const user = users[0];

    return sendSuccess(res, {
      id: user.id,
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      status: user.status,
      roleId: user.role_id,
      roleName: user.role_name,
      roles: [user.role_name],
      roleDisplayName: user.role_display_name,
      companyId: 'company-default',
      employeeId: user.employee_id || null,
      departmentId: user.department_id || null,
      employee: user.employee_id ? {
        id: user.employee_id,
        employeeCode: user.employee_code,
        designation: user.designation,
        departmentId: user.department_id,
        departmentName: user.department_name,
      } : null,
      permissions: req.user!.permissions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change Password
 */
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }
    if (newPassword.length < 6) {
      throw new AppError('New password must be at least 6 characters long', 400);
    }

    const users = await query<any[]>('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (users.length === 0) throw new AppError('User not found', 404);

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) {
      throw new AppError('Incorrect current password', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    await logAudit({
      userId,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'PASSWORD_CHANGE',
      module: 'AUTH',
      ipAddress: req.ip,
    });

    return sendSuccess(res, { updated: true }, undefined, 200, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function getSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessions = await query<any[]>(
      'SELECT id, ip_address, user_agent, device, last_active_at, created_at FROM user_sessions WHERE user_id = ? AND expires_at > NOW() ORDER BY last_active_at DESC',
      [userId]
    );
    return sendSuccess(res, sessions);
  } catch (error) {
    next(error);
  }
}

export async function revokeSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id: sessionId } = req.params;
    await query('DELETE FROM user_sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
    return sendSuccess(res, { revoked: true }, undefined, 200, 'Session revoked successfully');
  } catch (error) {
    next(error);
  }
}

export async function getLoginHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const offset = (page - 1) * limit;

    const countRows = await query<[{ total: number }]>('SELECT COUNT(*) as total FROM login_history WHERE user_id = ?', [userId]);
    const total = countRows[0].total;

    const history = await query<any[]>(
      'SELECT id, ip_address, user_agent, status, reason, created_at FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );

    return sendSuccess(res, history, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}
