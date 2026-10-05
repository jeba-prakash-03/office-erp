import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { ApprovalService } from '../../services/approval.service';

export async function listApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const employeeId = user.employeeId;
    const roleName = user.roleName;
    const status = req.query.status as string;
    const entityType = req.query.entity_type as string;
    const search = req.query.search as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    let baseSql = `
      FROM approval_requests ar
      LEFT JOIN employees e ON ar.requester_id = e.id OR ar.requester_id = e.user_id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users u ON ar.current_approver_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Role-based visibility
    if (roleName === 'super_admin' || roleName === 'admin') {
      // Admins see all
    } else if (roleName === 'hr_manager' || roleName === 'hr') {
      baseSql += ` AND (ar.entity_type IN ('leave', 'attendance_correction') OR ar.current_approver_id = ? OR e.reporting_manager_id = ?)`;
      params.push(employeeId || user.id, employeeId || '');
    } else if (roleName === 'finance_manager') {
      baseSql += ` AND (ar.entity_type IN ('expense', 'loan') OR ar.current_approver_id = ? OR e.reporting_manager_id = ?)`;
      params.push(employeeId || user.id, employeeId || '');
    } else if (roleName === 'project_manager' || roleName === 'team_lead') {
      baseSql += ` AND (ar.current_approver_id = ? OR e.reporting_manager_id = ?)`;
      params.push(employeeId || user.id, employeeId || '');
    } else {
      // Regular employees see items they requested or where they are designated approvers
      baseSql += ` AND (ar.current_approver_id = ? OR ar.requester_id = ?)`;
      params.push(employeeId || user.id, employeeId || user.id);
    }

    if (status && status !== 'all') {
      baseSql += ` AND ar.status = ?`;
      params.push(status);
    }

    if (entityType && entityType !== 'all') {
      baseSql += ` AND ar.entity_type = ?`;
      params.push(entityType);
    }

    if (search && search.trim()) {
      baseSql += ` AND (CONCAT(e.first_name, ' ', e.last_name) LIKE ? OR ar.comments LIKE ? OR e.employee_id LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    // Counts summary
    const countSql = `SELECT COUNT(*) as total ${baseSql}`;
    const countRows = await query<any[]>(countSql, params);
    const total = Number(countRows[0]?.total || 0);

    // Fetch records
    const selectSql = `
      SELECT ar.*, 
             CONCAT(COALESCE(e.first_name, 'Unknown'), ' ', COALESCE(e.last_name, '')) as requester_name,
             e.employee_id as requester_employee_code,
             e.designation as requester_designation,
             d.name as department_name,
             CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as approver_name
      ${baseSql}
      ORDER BY ar.submitted_at DESC
      LIMIT ? OFFSET ?
    `;
    const records = await query<any[]>(selectSql, [...params, limit, offset]);

    // Overview metrics
    const statsRows = await query<any[]>(`
      SELECT 
        SUM(CASE WHEN ar.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN ar.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN ar.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        COUNT(*) as total_count
      FROM approval_requests ar
    `);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
        overview: {
          pendingCount: Number(statsRows[0]?.pending_count || 0),
          approvedCount: Number(statsRows[0]?.approved_count || 0),
          rejectedCount: Number(statsRows[0]?.rejected_count || 0),
          totalCount: Number(statsRows[0]?.total_count || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPendingApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    req.query.status = 'pending';
    return listApprovals(req, res, next);
  } catch (error) {
    next(error);
  }
}

export async function processApprovalDecision(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { action, remarks } = req.body;
    const user = req.user!;

    const result = await ApprovalService.processDecision({
      requestId: id,
      action,
      actorUserId: user.id,
      actorEmployeeId: user.employeeId,
      actorRole: user.roleName,
      actorPermissions: user.permissions,
      remarks,
    });

    res.json({
      success: true,
      message: `Approval request ${action}d successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelApprovalRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const user = req.user!;

    const result = await ApprovalService.processDecision({
      requestId: id,
      action: 'cancel',
      actorUserId: user.id,
      actorEmployeeId: user.employeeId,
      actorRole: user.roleName,
      actorPermissions: user.permissions,
      remarks: remarks || 'Cancelled by requester',
    });

    res.json({
      success: true,
      message: 'Approval request cancelled successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getApprovalHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const history = await ApprovalService.getHistory(id);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}
