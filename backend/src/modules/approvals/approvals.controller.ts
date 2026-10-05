import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { ApprovalService } from '../../services/approval.service';

export async function getPendingApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const employeeId = user.employeeId;
    const roleName = user.roleName;

    let sql = `
      SELECT ar.*, 
             CONCAT(e.first_name, ' ', e.last_name) as requester_name,
             e.employee_id as requester_employee_code,
             e.designation as requester_designation,
             d.name as department_name
      FROM approval_requests ar
      LEFT JOIN employees e ON ar.requester_id = e.id OR ar.requester_id = e.user_id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE ar.status = 'pending'
    `;
    const params: any[] = [];

    // Filter by role / hierarchy
    if (roleName === 'super_admin' || roleName === 'admin') {
      // Admins see all pending approvals
    } else if (roleName === 'hr_manager') {
      // HR managers see leave, attendance, and all team approvals
      sql += ` AND (ar.entity_type IN ('leave', 'attendance_correction') OR ar.current_approver_id = ? OR e.reporting_manager_id = ?)`;
      params.push(employeeId || user.id, employeeId || '');
    } else if (roleName === 'finance_manager') {
      // Finance managers see expense, loan, and payroll approvals
      sql += ` AND (ar.entity_type IN ('expense', 'loan') OR ar.current_approver_id = ? OR e.reporting_manager_id = ?)`;
      params.push(employeeId || user.id, employeeId || '');
    } else if (roleName === 'project_manager' || roleName === 'team_lead') {
      // Project managers & team leads see approvals for their direct reports or where assigned
      sql += ` AND (ar.current_approver_id = ? OR e.reporting_manager_id = ?)`;
      params.push(employeeId || user.id, employeeId || '');
    } else {
      // Regular employees only see approvals assigned specifically to them
      sql += ` AND ar.current_approver_id = ?`;
      params.push(employeeId || user.id);
    }

    sql += ` ORDER BY ar.submitted_at DESC LIMIT 100`;

    const pending = await query<any[]>(sql, params);

    res.json({
      success: true,
      data: pending,
    });
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
