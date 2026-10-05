import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const stage = req.query.stage as string || '';
    const priority = req.query.priority as string || '';
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (l.name LIKE ? OR l.company LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (stage) {
      whereClause += ' AND l.stage = ?';
      params.push(stage);
    }
    if (priority) {
      whereClause += ' AND l.priority = ?';
      params.push(priority);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM leads l ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT l.*, 
             CONCAT(e.first_name, ' ', e.last_name) as assigned_employee_name,
             c.company_name as converted_client_name
      FROM leads l
      LEFT JOIN employees e ON l.assigned_employee_id = e.id
      LEFT JOIN clients c ON l.converted_to_client_id = c.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const leads = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: leads,
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

export async function createLead(req: Request, res: Response, next: NextFunction) {
  try {
    const name = req.body.name || req.body.contactPerson || req.body.contact_person || req.body.contact_name;
    const company = req.body.company || req.body.companyName || req.body.company_name;
    const email = req.body.email;
    const phone = req.body.phone;
    const source = req.body.source;
    const assignedEmployeeId = req.body.assignedEmployeeId || req.body.assigned_employee_id || null;
    const stage = req.body.stage || req.body.status || 'new';
    const priority = req.body.priority || 'medium';
    const estimatedValue = req.body.estimatedValue || req.body.estimated_value || req.body.deal_value || 0.00;
    const expectedClosingDate = req.body.expectedClosingDate || req.body.expected_closing_date || null;
    const notes = req.body.notes || null;

    if (!name && !company) {
      throw new AppError('Lead name or company is required', 400);
    }

    const leadId = `lead-${uuidv4()}`;
    const displayName = name || company;

    await query(
      `INSERT INTO leads (
        id, name, company, email, phone, source, assigned_employee_id,
        stage, priority, estimated_value, expected_closing_date, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        leadId, String(displayName).trim(), company || null, email || null, phone || null,
        source || null, assignedEmployeeId, stage, priority,
        estimatedValue, expectedClosingDate, notes
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_LEAD',
      module: 'LEADS',
      recordId: leadId,
      newValue: { name: displayName, company, estimatedValue, stage },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Lead created successfully', data: { id: leadId } });
  } catch (error) {
    next(error);
  }
}

export async function updateLead(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const {
      name, company, email, phone, source, assignedEmployeeId,
      stage, priority, estimatedValue, expectedClosingDate, notes
    } = req.body;

    const existing = await query<any[]>('SELECT * FROM leads WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('Lead not found', 404);

    await query(
      `UPDATE leads 
       SET name = COALESCE(?, name),
           company = COALESCE(?, company),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           source = COALESCE(?, source),
           assigned_employee_id = ?,
           stage = COALESCE(?, stage),
           priority = COALESCE(?, priority),
           estimated_value = COALESCE(?, estimated_value),
           expected_closing_date = ?,
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        name, company, email, phone, source, assignedEmployeeId || null,
        stage, priority, estimatedValue, expectedClosingDate || null, notes, id
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_LEAD',
      module: 'LEADS',
      recordId: id,
      previousValue: existing[0],
      newValue: req.body,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Lead updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function convertLeadToClient(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { clientCode } = req.body;

    const leadRows = await query<any[]>('SELECT * FROM leads WHERE id = ?', [id]);
    if (leadRows.length === 0) throw new AppError('Lead not found', 404);

    const lead = leadRows[0];
    if (lead.converted_to_client_id) {
      throw new AppError('This lead has already been converted to a client', 400);
    }

    const newClientCode = clientCode || `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
    const clientId = `client-${uuidv4()}`;

    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO clients (
          id, client_code, company_name, contact_person, email, phone,
          status, assigned_sales_rep_id, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW())`,
        [
          clientId, newClientCode, lead.company || lead.name, lead.name,
          lead.email || `${newClientCode.toLowerCase()}@client.local`,
          lead.phone || null, lead.assigned_employee_id, lead.notes
        ]
      );

      await conn.query(
        `INSERT INTO client_contacts (id, client_id, name, email, phone, is_primary, created_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [uuidv4(), clientId, lead.name, lead.email || null, lead.phone || null]
      );

      await conn.query(
        'UPDATE leads SET stage = "won", converted_to_client_id = ? WHERE id = ?',
        [clientId, id]
      );
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CONVERT_LEAD_TO_CLIENT',
      module: 'LEADS',
      recordId: id,
      newValue: { clientId, clientCode: newClientCode },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Lead successfully converted to Client', data: { clientId } });
  } catch (error) {
    next(error);
  }
}

export async function deleteLead(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM leads WHERE id = ?', [id]);
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    next(error);
  }
}
