import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

function generateTokens(userId: string, email: string, roleName: string) {
  const accessToken = jwt.sign(
    { userId, email, role: roleName },
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

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const users = await query<any[]>(
      `SELECT u.*, r.name as role_name, r.display_name as role_display_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = users[0];

    // Check if account locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account is temporarily locked due to multiple failed login attempts. Try again later.', 403);
    }

    // Verify status
    if (user.status !== 'active') {
      throw new AppError(`Account is ${user.status}. Please contact administrator.`, 403);
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      // Increment failed attempts
      const failedCount = (user.failed_login_attempts || 0) + 1;
      let lockUntilSql = 'NULL';
      if (failedCount >= 5) {
        // Lock for 15 minutes
        await query(
          'UPDATE users SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
          [failedCount, user.id]
        );
      } else {
        await query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [failedCount, user.id]);
      }

      await query(
        'INSERT INTO login_history (id, user_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [uuidv4(), user.id, ip, userAgent, 'failed']
      );

      throw new AppError('Invalid email or password', 401);
    }

    // Reset failed attempts & generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role_name);

    await query(
      `UPDATE users 
       SET refresh_token = ?, failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = ?
       WHERE id = ?`,
      [refreshToken, ip, user.id]
    );

    await query(
      'INSERT INTO login_history (id, user_id, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [uuidv4(), user.id, ip, userAgent, 'success']
    );

    // Get permissions
    const permissionsRows = await query<any[]>(
      `SELECT p.name 
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );
    const permissions = permissionsRows.map((r) => r.name);

    // Check associated employee or client record
    const empRows = await query<any[]>('SELECT id, employee_id, department_id, designation FROM employees WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    const clientRows = await query<any[]>('SELECT id, client_code, company_name FROM clients WHERE user_id = ?', [user.id]);

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.first_name} ${user.last_name}`,
      action: 'LOGIN',
      module: 'AUTH',
      ipAddress: ip,
      userAgent,
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          roleId: user.role_id,
          roleName: user.role_name,
          roleDisplayName: user.role_display_name,
          avatarUrl: user.avatar_url,
          phone: user.phone,
          employee: empRows[0] || null,
          client: clientRows[0] || null,
          permissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, firstName, lastName, phone, roleId } = req.body;

    if (!email || !password || !firstName || !lastName) {
      throw new AppError('Email, password, first name and last name are required', 400);
    }

    const existing = await query<any[]>('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      throw new AppError('A user with this email already exists', 409);
    }

    // Default role is employee if not specified
    let targetRoleId = roleId;
    if (!targetRoleId) {
      const defaultRole = await query<any[]>('SELECT id FROM roles WHERE name = ?', ['employee']);
      targetRoleId = defaultRole[0]?.id || 'role-employee';
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = uuidv4();

    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, status, phone, email_verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 1, NOW())`,
      [userId, email.toLowerCase().trim(), passwordHash, firstName, lastName, targetRoleId, phone || null]
    );

    const roles = await query<any[]>('SELECT name, display_name FROM roles WHERE id = ?', [targetRoleId]);
    const role = roles[0];

    const { accessToken, refreshToken } = generateTokens(userId, email, role.name);
    await query('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, userId]);

    await logAudit({
      userId,
      userEmail: email,
      userName: `${firstName} ${lastName}`,
      action: 'REGISTER',
      module: 'AUTH',
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: userId,
          email,
          firstName,
          lastName,
          roleId: targetRoleId,
          roleName: role.name,
          roleDisplayName: role.display_name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      throw new AppError('Refresh token is required', 400);
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret);
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const users = await query<any[]>(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? AND u.refresh_token = ?`,
      [decoded.userId, token]
    );

    if (users.length === 0) {
      throw new AppError('Invalid refresh session. Please login again.', 401);
    }

    const user = users[0];
    if (user.status !== 'active') {
      throw new AppError('Account is inactive', 403);
    }

    const tokens = generateTokens(user.id, user.email, user.role_name);
    await query('UPDATE users SET refresh_token = ? WHERE id = ?', [tokens.refreshToken, user.id]);

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user) {
      await query('UPDATE users SET refresh_token = NULL WHERE id = ?', [req.user.id]);
      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        action: 'LOGOUT',
        module: 'AUTH',
        ipAddress: req.ip,
      });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const users = await query<any[]>(
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
      throw new AppError('User not found', 404);
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        status: user.status,
        roleId: user.role_id,
        roleName: user.role_name,
        roleDisplayName: user.role_display_name,
        employee: user.employee_id ? {
          id: user.employee_id,
          employeeCode: user.employee_code,
          designation: user.designation,
          departmentId: user.department_id,
          departmentName: user.department_name,
        } : null,
        client: user.client_id ? {
          id: user.client_id,
          clientCode: user.client_code,
          companyName: user.client_company_name,
        } : null,
        permissions: req.user!.permissions,
      },
    });
  } catch (error) {
    next(error);
  }
}

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
      throw new AppError('Current password does not match', 400);
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

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { firstName, lastName, phone, avatarUrl } = req.body;

    await query(
      `UPDATE users 
       SET first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           phone = COALESCE(?, phone),
           avatar_url = COALESCE(?, avatar_url)
       WHERE id = ?`,
      [firstName, lastName, phone, avatarUrl, userId]
    );

    // If user has an associated employee profile, update there too
    await query(
      `UPDATE employees 
       SET first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           phone = COALESCE(?, phone),
           profile_photo = COALESCE(?, profile_photo)
       WHERE user_id = ?`,
      [firstName, lastName, phone, avatarUrl, userId]
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
}
