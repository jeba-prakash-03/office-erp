import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '25', 10);
    const moduleName = req.query.module as string || '';
    const userId = req.query.userId as string || '';
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

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

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM audit_logs a ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT a.*
      FROM audit_logs a
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const logs = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}
