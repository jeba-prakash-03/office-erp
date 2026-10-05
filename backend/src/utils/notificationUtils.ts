import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';
import { logger } from './logger';

export interface CreateNotificationParams {
  userId?: string | null;
  employeeId?: string | null;
  title: string;
  message: string;
  type: string;
  link?: string;
}

export async function sendNotification(params: CreateNotificationParams): Promise<void> {
  try {
    let targetUserId: string | null = null;

    if (params.userId) {
      // Check if userId is a valid user in `users`
      const userRows = await query<any[]>('SELECT id FROM users WHERE id = ?', [params.userId]);
      if (userRows.length > 0) {
        targetUserId = userRows[0].id;
      } else {
        // Might be an employeeId passed into userId
        const empRows = await query<any[]>('SELECT user_id FROM employees WHERE id = ?', [params.userId]);
        if (empRows.length > 0 && empRows[0].user_id) {
          targetUserId = empRows[0].user_id;
        }
      }
    }

    if (!targetUserId && params.employeeId) {
      const rows = await query<any[]>('SELECT user_id FROM employees WHERE id = ?', [params.employeeId]);
      if (rows.length > 0 && rows[0].user_id) {
        targetUserId = rows[0].user_id;
      }
    }

    if (!targetUserId) {
      logger.warn(`Could not dispatch notification '${params.title}': No valid user ID found.`);
      return;
    }

    const id = uuidv4();
    await query(
      `INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [id, targetUserId, params.title, params.message, params.type, params.link || null]
    );
  } catch (error) {
    logger.error('Failed to create notification:', error);
  }
}
