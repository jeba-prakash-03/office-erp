import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const notifications = await query<any[]>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    const unreadCount = await query<any[]>(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: unreadCount[0]?.unread || 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user!.id]);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user!.id]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}
