import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export async function getCalendarEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const month = parseInt(req.query.month as string || `${new Date().getMonth() + 1}`, 10);
    const year = parseInt(req.query.year as string || `${new Date().getFullYear()}`, 10);

    const events: any[] = [];

    // 1. Holidays
    const holidays = await query<any[]>(
      'SELECT id, name as title, date, description, is_optional FROM holidays WHERE MONTH(date) = ? AND YEAR(date) = ?',
      [month, year]
    );
    for (const h of holidays) {
      events.push({
        id: `hol-${h.id}`,
        title: `Holiday: ${h.title}`,
        start: h.date,
        end: h.date,
        type: 'holiday',
        description: h.description,
        color: '#ef4444', // Red
      });
    }

    // 2. Meetings
    const meetings = await query<any[]>(
      `SELECT m.id, m.title, m.meeting_date, m.start_time, m.end_time, m.location, m.meeting_link
       FROM meetings m
       WHERE MONTH(m.meeting_date) = ? AND YEAR(m.meeting_date) = ?`,
      [month, year]
    );
    for (const m of meetings) {
      events.push({
        id: `meet-${m.id}`,
        title: `Meeting: ${m.title}`,
        start: `${m.meeting_date}T${m.start_time}`,
        end: `${m.meeting_date}T${m.end_time}`,
        type: 'meeting',
        location: m.location,
        link: m.meeting_link,
        color: '#3b82f6', // Blue
      });
    }

    // 3. Approved Leaves
    const leaves = await query<any[]>(
      `SELECT lr.id, lr.start_date, lr.end_date, lt.name as leave_type,
              CONCAT(e.first_name, ' ', e.last_name) as employee_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN employees e ON lr.employee_id = e.id
       WHERE lr.status = 'approved' AND (MONTH(lr.start_date) = ? OR MONTH(lr.end_date) = ?) AND (YEAR(lr.start_date) = ? OR YEAR(lr.end_date) = ?)`,
      [month, month, year, year]
    );
    for (const l of leaves) {
      events.push({
        id: `leave-${l.id}`,
        title: `Leave: ${l.employee_name} (${l.leave_type})`,
        start: l.start_date,
        end: l.end_date,
        type: 'leave',
        color: '#f59e0b', // Amber
      });
    }

    // 4. Project Deadlines
    const projects = await query<any[]>(
      'SELECT id, name, end_date FROM projects WHERE end_date IS NOT NULL AND MONTH(end_date) = ? AND YEAR(end_date) = ?',
      [month, year]
    );
    for (const p of projects) {
      events.push({
        id: `proj-${p.id}`,
        title: `Project Deadline: ${p.name}`,
        start: p.end_date,
        end: p.end_date,
        type: 'project_deadline',
        color: '#8b5cf6', // Purple
      });
    }

    // 5. Task Due Dates
    const tasks = await query<any[]>(
      'SELECT id, title, task_code, due_date FROM tasks WHERE due_date IS NOT NULL AND MONTH(due_date) = ? AND YEAR(due_date) = ? AND status != "completed"',
      [month, year]
    );
    for (const t of tasks) {
      events.push({
        id: `task-${t.id}`,
        title: `Task Due: ${t.task_code} - ${t.title}`,
        start: t.due_date,
        end: t.due_date,
        type: 'task_due',
        color: '#10b981', // Emerald
      });
    }

    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
}
