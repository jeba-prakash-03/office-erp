import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';
import { logger } from './logger';

export interface AuditLogPayload {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  action: string;
  module: string;
  recordId?: string | null;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAudit(payload: AuditLogPayload): Promise<void> {
  try {
    const id = uuidv4();
    const prevJson = payload.previousValue ? JSON.stringify(payload.previousValue) : null;
    const nextJson = payload.newValue ? JSON.stringify(payload.newValue) : null;

    await query(
      `INSERT INTO audit_logs 
       (id, user_id, user_email, user_name, action, module, record_id, previous_value, new_value, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        payload.userId || null,
        payload.userEmail || null,
        payload.userName || null,
        payload.action,
        payload.module,
        payload.recordId || null,
        prevJson,
        nextJson,
        payload.ipAddress || null,
        payload.userAgent || null,
      ]
    );
  } catch (error) {
    logger.error('Failed to write audit log:', error);
  }
}
