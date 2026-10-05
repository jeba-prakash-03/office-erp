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
 * Register First Super Admin
 * Only permissible when 0 users exist in the system.
 */
export async function registerFirstAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password || !firstName || !lastName) {
      throw new AppError('Email, password, first name, and last name are required', 400, 'VALIDATION_ERROR', {
        fields: {
          email: !email ? 'Email is required' : '',
          password: !password ? 'Password is required' : '',
          firstName: !firstName ? 'First name is required' : '',
          lastName: !lastName ? 'Last name is required' : '',
        },
      });
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
    }, 'First admin account registered successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * User Login
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR', {
        fields: {
          email: !email ? 'Email is required' : '',
          password: !password ? 'Password is required' : '',
        },
      });
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

    const users = await query<UserRow[]>(
      `SELECT u.*, r.name as role_name, r.display_name as role_display_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
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

      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
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

    // Retrieve user permissions
    const permissionsRows = await query<{ name: string }[]>(
      `SELECT p.name 
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );
    const permissions = permissionsRows.map((r) => r.name);

    // Linked employee and client records
    const empRows = await query<{ id: string; employee_id: string; department_id: string; designation: string }[]>(
      'SELECT id, employee_id, department_id, designation FROM employees WHERE user_id = ? AND deleted_at IS NULL',
      [user.id]
    );
    const clientRows = await query<{ id: string; client_code: string; company_name: string }[]>(
      'SELECT id, client_code, company_name FROM clients WHERE user_id = ?',
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
        employee: empRows[0] || null,
        client: clientRows[0] || null,
        permissions,
      },
    }, undefined, 200, 'Login successful');
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
    if (!token) {
      throw new AppError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
    }

    interface DecodedToken {
      userId: string;
      email: string;
    }

    let decoded: DecodedToken;
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret) as DecodedToken;
    } catch {
      throw new AppError('Invalid or expired refresh token. Please login again.', 401, 'INVALID_REFRESH_TOKEN');
    }

    interface UserAuthRow {
      id: string;
      email: string;
      status: string;
      role_name: string;
    }

    const users = await query<UserAuthRow[]>(
      `SELECT u.id, u.email, u.status, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? AND u.refresh_token = ?`,
      [decoded.userId, token]
    );

    if (users.length === 0) {
      throw new AppError('Invalid refresh session. Please login again.', 401, 'INVALID_SESSION');
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
 * Get Current User (/api/auth/me)
 */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    interface MeUserRow {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      avatar_url: string | null;
      status: string;
      role_id: string;
      role_name: string;
      role_display_name: string;
      employee_id: string | null;
      employee_code: string | null;
      designation: string | null;
      department_id: string | null;
      department_name: string | null;
      client_id: string | null;
      client_code: string | null;
      client_company_name: string | null;
    }

    const users = await query<MeUserRow[]>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.status, u.role_id,
              r.name as role_name, r.display_name as role_display_name,
              e.id as employee_id, e.employee_id as employee_code, e.designation, e.department_id,
              d.name as department_name,
              c.id as client_id, c.client_code, c.company_name as client_company_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN employees e ON e.user_id = u.id AND e.deleted_at IS NULL
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN clients c ON c.user_id = u.id
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

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
      employee: user.employee_id
        ? {
            id: user.employee_id,
            employeeCode: user.employee_code,
            designation: user.designation,
            departmentId: user.department_id,
            departmentName: user.department_name,
          }
        : null,
      client: user.client_id
        ? {
            id: user.client_id,
            clientCode: user.client_code,
            companyName: user.client_company_name,
          }
        : null,
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
      throw new AppError('Current password and new password are required', 400, 'VALIDATION_ERROR', {
        fields: {
          currentPassword: !currentPassword ? 'Current password is required' : '',
          newPassword: !newPassword ? 'New password is required' : '',
        },
      });
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long', 400, 'VALIDATION_ERROR', {
        fields: { newPassword: 'Password must contain at least 8 characters' },
      });
    }

    const users = await query<{ password_hash: string }[]>('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (users.length === 0) throw new AppError('User not found', 404);

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) {
      throw new AppError('Current password does not match', 400, 'INVALID_PASSWORD', {
        fields: { currentPassword: 'Incorrect current password' },
      });
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

/**
 * List Active Sessions
 */
export async function getSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    interface SessionRow {
      id: string;
      ip_address: string;
      user_agent: string;
      device: string;
      last_active_at: string;
      created_at: string;
    }

    const sessions = await query<SessionRow[]>(
      `SELECT id, ip_address, user_agent, device, last_active_at, created_at
       FROM user_sessions
       WHERE user_id = ? AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId]
    );

    return sendSuccess(res, sessions);
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke Session
 */
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

/**
 * Login History
 */
export async function getLoginHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const offset = (page - 1) * limit;

    interface LoginHistoryRow {
      id: string;
      ip_address: string;
      user_agent: string;
      status: string;
      reason: string | null;
      created_at: string;
    }

    const countRows = await query<[{ total: number }]>(
      'SELECT COUNT(*) as total FROM login_history WHERE user_id = ?',
      [userId]
    );
    const total = countRows[0].total;

    const history = await query<LoginHistoryRow[]>(
      `SELECT id, ip_address, user_agent, status, reason, created_at
       FROM login_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
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
