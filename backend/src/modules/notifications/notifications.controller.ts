import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { sendSuccess } from '../../utils/response';

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean | number;
  created_at: string;
}

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const notifications = await query<NotificationRow[]>(
      'SELECT id, user_id, title, message, type, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    const unreadCountRows = await query<[{ unread: number }]>(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    return sendSuccess(res, {
      notifications: notifications.map(n => ({ ...n, is_read: Boolean(n.is_read) })),
      unreadCount: unreadCountRows[0]?.unread || 0,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const unreadCountRows = await query<[{ unread: number }]>(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return sendSuccess(res, { unreadCount: unreadCountRows[0]?.unread || 0 });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user!.id]);
    return sendSuccess(res, { updated: true }, undefined, 200, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user!.id]);
    return sendSuccess(res, { updated: true }, undefined, 200, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
}
