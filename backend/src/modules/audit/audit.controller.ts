import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { sendSuccess } from '../../utils/response';

export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '25', 10);
    const moduleName = req.query.module as string || '';
    const userId = req.query.userId as string || '';
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (moduleName) {
      whereClause += ' AND a.module = ?';
      params.push(moduleName);
    }
    if (userId) {
      whereClause += ' AND a.user_id = ?';
      params.push(userId);
    }
    if (search) {
      whereClause += ' AND (a.action LIKE ? OR a.user_email LIKE ? OR a.user_name LIKE ? OR a.record_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const countRows = await query<[{ total: number }]>(`SELECT COUNT(*) as total FROM audit_logs a ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT a.*
      FROM audit_logs a
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    interface AuditRow {
      id: string;
      user_id: string;
      user_email: string;
      user_name: string;
      action: string;
      module: string;
      record_id: string | null;
      previous_value: string | null;
      new_value: string | null;
      ip_address: string | null;
      user_agent: string | null;
      created_at: string;
    }

    const logs = await query<AuditRow[]>(dataSql, [...params, limit, offset]);

    return sendSuccess(res, logs, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}
