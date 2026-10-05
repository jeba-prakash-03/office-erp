import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listMeetings(req: Request, res: Response, next: NextFunction) {
  try {
    const meetings = await query<any[]>(
      `SELECT m.*, 
              p.name as project_name,
              c.company_name as client_name,
              CONCAT(u.first_name, ' ', u.last_name) as organizer_name
       FROM meetings m
       LEFT JOIN projects p ON m.project_id = p.id
       LEFT JOIN clients c ON m.client_id = c.id
       JOIN users u ON m.created_by_user_id = u.id
       ORDER BY m.meeting_date DESC, m.start_time DESC`
    );

    // Hydrate participants
    for (const m of meetings) {
      const parts = await query<any[]>(
        `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as name, u.email, u.avatar_url
         FROM meeting_participants mp
         JOIN users u ON mp.user_id = u.id
         WHERE mp.meeting_id = ?`,
        [m.id]
      );
      m.participants = parts;
    }

    res.json({ success: true, data: meetings });
  } catch (error) {
    next(error);
  }
}

export async function createMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, projectId, clientId, meetingDate, startTime, endTime, location, meetingLink, notes, actionItems, participantIds } = req.body;

    if (!title || !meetingDate || !startTime || !endTime) {
      throw new AppError('Title, meeting date, start time, and end time are required', 400);
    }

    const meetingId = `meet-${uuidv4()}`;

    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO meetings (
          id, title, project_id, client_id, meeting_date, start_time, end_time,
          location, meeting_link, notes, action_items, created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          meetingId, title.trim(), projectId || null, clientId || null, meetingDate,
          startTime, endTime, location || null, meetingLink || null,
          notes || null, actionItems || null, req.user!.id
        ]
      );

      // Add organizer as participant
      await conn.query('INSERT IGNORE INTO meeting_participants (meeting_id, user_id) VALUES (?, ?)', [meetingId, req.user!.id]);

      // Add other participants
      if (Array.isArray(participantIds)) {
        for (const uid of participantIds) {
          if (uid) {
            await conn.query('INSERT IGNORE INTO meeting_participants (meeting_id, user_id) VALUES (?, ?)', [meetingId, uid]);
            if (uid !== req.user!.id) {
              await conn.query(
                `INSERT INTO notifications (id, user_id, title, message, type, link, created_at)
                 VALUES (?, ?, 'Meeting Invitation', ?, 'meeting', '/meetings', NOW())`,
                [uuidv4(), uid, `You are invited to meeting: "${title}" on ${meetingDate} at ${startTime}`]
              );
            }
          }
        }
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_MEETING',
      module: 'MEETINGS',
      recordId: meetingId,
      newValue: { title, meetingDate, startTime },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Meeting scheduled successfully', data: { id: meetingId } });
  } catch (error) {
    next(error);
  }
}

export async function deleteMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM meetings WHERE id = ?', [id]);
    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error) {
    next(error);
  }
}
