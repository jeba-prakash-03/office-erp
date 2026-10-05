import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';
import { logger } from '../utils/logger';
import { sendNotification } from '../utils/notificationUtils';
import { logAudit } from '../utils/auditLogger';

export type ApprovalEntityType = 'leave' | 'attendance_correction' | 'timesheet' | 'expense' | 'loan';
export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'returned';
export type ApprovalAction = 'submit' | 'approve' | 'reject' | 'cancel' | 'return' | 'reassign';

export interface SubmitApprovalParams {
  entityType: ApprovalEntityType;
  entityId: string;
  requesterId: string; // employee_id or user_id
  currentApproverId?: string | null; // employee_id or user_id
  status?: ApprovalStatus;
  comments?: string;
  actorUserId: string;
  actorRole?: string;
}

export interface ProcessApprovalParams {
  requestId?: string;
  entityType?: ApprovalEntityType;
  entityId?: string;
  action: ApprovalAction;
  actorUserId: string;
  actorEmployeeId?: string | null;
  actorRole?: string;
  actorPermissions?: string[];
  remarks?: string;
}

export class ApprovalService {
  /**
   * Submit a new entity for approval or register an approval request
   */
  static async submitRequest(params: SubmitApprovalParams): Promise<string> {
    const id = uuidv4();
    const initialStatus: ApprovalStatus = params.status || 'pending';

    // Check if an existing approval request already exists for this entity
    const existing = await query<any[]>(
      'SELECT id FROM approval_requests WHERE entity_type = ? AND entity_id = ?',
      [params.entityType, params.entityId]
    );

    let requestId = id;
    if (existing.length > 0) {
      requestId = existing[0].id;
      await query(
        `UPDATE approval_requests 
         SET status = ?, current_approver_id = ?, submitted_at = NOW(), decided_at = NULL, decided_by_user_id = NULL, comments = ?, updated_at = NOW()
         WHERE id = ?`,
        [initialStatus, params.currentApproverId || null, params.comments || null, requestId]
      );
    } else {
      await query(
        `INSERT INTO approval_requests 
         (id, entity_type, entity_id, requester_id, current_approver_id, status, submitted_at, comments, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())`,
        [
          requestId,
          params.entityType,
          params.entityId,
          params.requesterId,
          params.currentApproverId || null,
          initialStatus,
          params.comments || null,
        ]
      );
    }

    // Record history
    const historyId = uuidv4();
    await query(
      `INSERT INTO approval_history 
       (id, request_id, action, actor_user_id, actor_role, previous_status, new_status, remarks, created_at)
       VALUES (?, ?, 'submit', ?, ?, 'draft', ?, ?, NOW())`,
      [
        historyId,
        requestId,
        params.actorUserId,
        params.actorRole || 'employee',
        initialStatus,
        params.comments || 'Submitted for approval',
      ]
    );

    // Notify approver if specified
    if (params.currentApproverId) {
      await sendNotification({
        employeeId: params.currentApproverId,
        title: `New ${params.entityType.replace('_', ' ').toUpperCase()} Approval Request`,
        message: `A new ${params.entityType.replace('_', ' ')} request requires your review.`,
        type: params.entityType,
        link: `/${params.entityType}s`,
      });
    }

    return requestId;
  }

  /**
   * Process an approval action (approve, reject, return, cancel)
   */
  static async processDecision(params: ProcessApprovalParams): Promise<{ success: boolean; newStatus: ApprovalStatus }> {
    let request: any;

    if (params.requestId) {
      const rows = await query<any[]>('SELECT * FROM approval_requests WHERE id = ?', [params.requestId]);
      request = rows[0];
    } else if (params.entityType && params.entityId) {
      const rows = await query<any[]>(
        'SELECT * FROM approval_requests WHERE entity_type = ? AND entity_id = ?',
        [params.entityType, params.entityId]
      );
      request = rows[0];
    }

    if (!request) {
      const error: any = new Error('Approval request not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Action-based state resolution
    let newStatus: ApprovalStatus;
    switch (params.action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      case 'return':
        newStatus = 'returned';
        break;
      case 'cancel':
        newStatus = 'cancelled';
        break;
      default:
        const err: any = new Error(`Invalid approval action: ${params.action}`);
        err.statusCode = 400;
        err.code = 'INVALID_ACTION';
        throw err;
    }

    // Cancellation rule: only the requester or admin can cancel
    if (params.action === 'cancel') {
      const isRequester =
        request.requester_id === params.actorEmployeeId ||
        request.requester_id === params.actorUserId;
      const isAdmin = params.actorRole === 'super_admin' || params.actorRole === 'admin';

      if (!isRequester && !isAdmin) {
        const error: any = new Error('Only the requester or an administrator can cancel this request');
        error.statusCode = 403;
        error.code = 'FORBIDDEN';
        throw error;
      }
    } else {
      // Self-approval guard: Requester CANNOT approve their own request
      const isSelf =
        request.requester_id === params.actorEmployeeId ||
        request.requester_id === params.actorUserId;

      if (isSelf && params.actorRole !== 'super_admin') {
        const error: any = new Error('Self-approval violation: You cannot approve or reject your own request');
        error.statusCode = 403;
        error.code = 'SELF_APPROVAL_PROHIBITED';
        throw error;
      }

      // Check if current status allows decision
      if (request.status !== 'pending' && request.status !== 'returned') {
        const error: any = new Error(`Cannot perform ${params.action} on a request with status ${request.status}`);
        error.statusCode = 400;
        error.code = 'INVALID_STATE';
        throw error;
      }
    }

    // Update approval_requests table
    await query(
      `UPDATE approval_requests 
       SET status = ?, decided_at = NOW(), decided_by_user_id = ?, comments = ?, updated_at = NOW()
       WHERE id = ?`,
      [newStatus, params.actorUserId, params.remarks || null, request.id]
    );

    // Record approval history
    const historyId = uuidv4();
    await query(
      `INSERT INTO approval_history 
       (id, request_id, action, actor_user_id, actor_role, previous_status, new_status, remarks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        historyId,
        request.id,
        params.action,
        params.actorUserId,
        params.actorRole || 'approver',
        request.status,
        newStatus,
        params.remarks || null,
      ]
    );

    // Sync status back to target entity table
    await this.syncEntityStatus(request.entity_type, request.entity_id, newStatus, params.actorUserId, params.remarks);

    // Audit log
    await logAudit({
      userId: params.actorUserId,
      action: `APPROVAL_${params.action.toUpperCase()}`,
      module: request.entity_type,
      recordId: request.entity_id,
      previousValue: { status: request.status },
      newValue: { status: newStatus, remarks: params.remarks },
    });

    // Notify requester
    await sendNotification({
      employeeId: request.requester_id,
      userId: request.requester_id,
      title: `${request.entity_type.replace('_', ' ').toUpperCase()} Request ${newStatus.toUpperCase()}`,
      message: `Your ${request.entity_type.replace('_', ' ')} request was ${newStatus}.${
        params.remarks ? ` Remarks: "${params.remarks}"` : ''
      }`,
      type: request.entity_type,
    });

    return { success: true, newStatus };
  }

  /**
   * Sync approval decision to the specific entity table in MySQL
   */
  private static async syncEntityStatus(
    entityType: ApprovalEntityType,
    entityId: string,
    status: ApprovalStatus,
    decidedByUserId: string,
    remarks?: string
  ): Promise<void> {
    try {
      switch (entityType) {
        case 'leave':
          await query(
            `UPDATE leave_requests 
             SET status = ?, approved_by_user_id = ?, reviewer_remarks = ?, updated_at = NOW() 
             WHERE id = ?`,
            [status === 'returned' ? 'pending' : status, decidedByUserId, remarks || null, entityId]
          );
          break;

        case 'attendance_correction':
          await query(
            `UPDATE attendance_corrections 
             SET status = ?, approved_by_user_id = ?, reviewer_remarks = ?, updated_at = NOW() 
             WHERE id = ?`,
            [status === 'returned' ? 'pending' : status, decidedByUserId, remarks || null, entityId]
          );
          break;

        case 'timesheet':
          const timesheetStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'submitted';
          await query(
            `UPDATE timesheets 
             SET status = ?, approved_by_user_id = ?, updated_at = NOW() 
             WHERE id = ?`,
            [timesheetStatus, decidedByUserId, entityId]
          );
          break;

        case 'expense':
          const expenseStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
          await query(
            `UPDATE expenses 
             SET status = ?, approved_by_user_id = ?, updated_at = NOW() 
             WHERE id = ?`,
            [expenseStatus, decidedByUserId, entityId]
          );
          break;

        case 'loan':
          const loanStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
          await query(
            `UPDATE employee_loans 
             SET status = ?, updated_at = NOW() 
             WHERE id = ?`,
            [loanStatus, entityId]
          );
          break;
      }
    } catch (error) {
      logger.error(`Error syncing entity status for ${entityType} ${entityId}:`, error);
    }
  }

  /**
   * Get approval history trail
   */
  static async getHistory(requestId: string): Promise<any[]> {
    return query<any[]>(
      `SELECT h.*, u.first_name as actor_first_name, u.last_name as actor_last_name, u.email as actor_email
       FROM approval_history h
       LEFT JOIN users u ON h.actor_user_id = u.id
       WHERE h.request_id = ?
       ORDER BY h.created_at ASC`,
      [requestId]
    );
  }
}
