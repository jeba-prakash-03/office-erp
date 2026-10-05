import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listAnnouncements(req: Request, res: Response, next: NextFunction) {
  try {
    const announcements = await query<any[]>(
      `SELECT a.*, 
              CONCAT(u.first_name, ' ', u.last_name) as created_by_name
       FROM announcements a
       JOIN users u ON a.created_by_user_id = u.id
       WHERE (a.expiry_date IS NULL OR a.expiry_date >= CURDATE())
       ORDER BY a.publish_date DESC, a.created_at DESC`
    );

    res.json({ success: true, data: announcements });
  } catch (error) {
    next(error);
  }
}

export async function createAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, content, audience, priority, publishDate, expiryDate } = req.body;

    if (!title || !content || !publishDate) {
      throw new AppError('Title, content, and publish date are required', 400);
    }

    const annId = `ann-${uuidv4()}`;
    await query(
      `INSERT INTO announcements (
        id, title, content, audience, priority, publish_date, expiry_date, created_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        annId, title.trim(), content.trim(), audience || 'all', priority || 'medium',
        publishDate, expiryDate || null, req.user!.id
      ]
    );

    // Notify all active users
    const users = await query<any[]>('SELECT id FROM users WHERE status = "active"');
    for (const u of users) {
      if (u.id !== req.user!.id) {
        await query(
          `INSERT INTO notifications (id, user_id, title, message, type, link, created_at)
           VALUES (?, ?, ?, ?, 'announcement', '/announcements', NOW())`,
          [uuidv4(), u.id, 'New Announcement', title.trim()]
        );
      }
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_ANNOUNCEMENT',
      module: 'ANNOUNCEMENTS',
      recordId: annId,
      newValue: { title, priority, audience },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Announcement published successfully', data: { id: annId } });
  } catch (error) {
    next(error);
  }
}

export async function deleteAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM announcements WHERE id = ?', [id]);
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    next(error);
  }
}
