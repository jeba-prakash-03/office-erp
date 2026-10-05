import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listClients(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const search = req.query.search as string || '';
    const status = req.query.status as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Client portal isolation: If logged in as client, only see self
    if (req.user?.roleName === 'client' && req.user?.clientId) {
      whereClause += ' AND c.id = ?';
      params.push(req.user.clientId);
    }

    if (search) {
      whereClause += ' AND (c.company_name LIKE ? OR c.contact_person LIKE ? OR c.email LIKE ? OR c.client_code LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM clients c ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT c.*, 
             CONCAT(e.first_name, ' ', e.last_name) as sales_rep_name,
             COUNT(DISTINCT p.id) as project_count,
             COALESCE(SUM(inv.grand_total), 0) as total_invoiced,
             COALESCE(SUM(inv.paid_amount), 0) as total_paid
      FROM clients c
      LEFT JOIN employees e ON c.assigned_sales_rep_id = e.id
      LEFT JOIN projects p ON p.client_id = c.id
      LEFT JOIN invoices inv ON inv.client_id = c.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const clients = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: clients,
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

export async function getClientById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Client security check
    if (req.user?.roleName === 'client' && req.user?.clientId !== id) {
      throw new AppError('Forbidden: You can only view your own company profile', 403);
    }

    const clients = await query<any[]>(
      `SELECT c.*, 
              CONCAT(e.first_name, ' ', e.last_name) as sales_rep_name,
              e.email as sales_rep_email
       FROM clients c
       LEFT JOIN employees e ON c.assigned_sales_rep_id = e.id
       WHERE c.id = ?`,
      [id]
    );

    if (clients.length === 0) throw new AppError('Client not found', 404);

    const client = clients[0];

    // Additional tabs:
    // 1. Contacts
    const contacts = await query<any[]>('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, name ASC', [id]);
    // 2. Projects
    const projects = await query<any[]>('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC', [id]);
    // 3. Invoices
    const invoices = await query<any[]>('SELECT * FROM invoices WHERE client_id = ? ORDER BY invoice_date DESC', [id]);
    // 4. Payments
    const payments = await query<any[]>('SELECT * FROM payments WHERE client_id = ? ORDER BY payment_date DESC', [id]);
    // 5. Documents
    const documents = await query<any[]>("SELECT * FROM documents WHERE entity_type = 'client' AND entity_id = ? ORDER BY created_at DESC", [id]);

    res.json({
      success: true,
      data: {
        ...client,
        contacts,
        projects,
        invoices,
        payments,
        documents,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createClient(req: Request, res: Response, next: NextFunction) {
  try {
    const companyName = req.body.companyName || req.body.company_name;
    const contactPerson = req.body.contactPerson || req.body.contact_person || companyName || 'Primary Contact';
    const email = req.body.email;
    const clientCode = req.body.clientCode || req.body.client_code || `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
    const phone = req.body.phone;
    const website = req.body.website;
    const address = req.body.address;
    const industry = req.body.industry;
    const gstNumber = req.body.gstNumber || req.body.gst_number;
    const taxNumber = req.body.taxNumber || req.body.tax_number;
    const status = req.body.status || 'active';
    const assignedSalesRepId = req.body.assignedSalesRepId || req.body.assigned_sales_rep_id || null;
    const notes = req.body.notes;
    const contacts = req.body.contacts;

    if (!companyName || !email) {
      throw new AppError('Company Name and Email are required', 400);
    }

    const existing = await query<any[]>('SELECT id FROM clients WHERE client_code = ?', [clientCode.trim()]);
    if (existing.length > 0) {
      // If code was auto-generated and collided, generate with uuid suffix
      const altCode = `CLI-${uuidv4().substring(0, 6).toUpperCase()}`;
      req.body.clientCode = altCode;
    }

    const finalClientCode = req.body.clientCode || clientCode;
    const clientId = `client-${uuidv4()}`;

    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO clients (
          id, client_code, company_name, contact_person, email, phone, website,
          address, industry, gst_number, tax_number, status, assigned_sales_rep_id, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          clientId, finalClientCode.trim(), companyName.trim(), contactPerson.trim(), email.trim(),
          phone || null, website || null, address || null, industry || null,
          gstNumber || null, taxNumber || null, status || 'active', assignedSalesRepId || null, notes || null
        ]
      );

      // Primary contact
      await conn.query(
        `INSERT INTO client_contacts (id, client_id, name, email, phone, is_primary, created_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [`cont-${uuidv4()}`, clientId, contactPerson.trim(), email.trim(), phone || null]
      );

      // Additional contacts if any
      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          if (c.name) {
            await conn.query(
              `INSERT INTO client_contacts (id, client_id, name, email, phone, designation, is_primary, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
              [uuidv4(), clientId, c.name, c.email || null, c.phone || null, c.designation || null]
            );
          }
        }
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_CLIENT',
      module: 'CLIENTS',
      recordId: clientId,
      newValue: { clientCode, companyName, contactPerson, email },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Client created successfully', data: { id: clientId } });
  } catch (error) {
    next(error);
  }
}

export async function updateClient(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const {
      companyName, contactPerson, email, phone, website, address,
      industry, gstNumber, taxNumber, status, assignedSalesRepId, notes
    } = req.body;

    const existing = await query<any[]>('SELECT * FROM clients WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('Client not found', 404);

    await query(
      `UPDATE clients 
       SET company_name = COALESCE(?, company_name),
           contact_person = COALESCE(?, contact_person),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           website = COALESCE(?, website),
           address = COALESCE(?, address),
           industry = COALESCE(?, industry),
           gst_number = COALESCE(?, gst_number),
           tax_number = COALESCE(?, tax_number),
           status = COALESCE(?, status),
           assigned_sales_rep_id = ?,
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        companyName, contactPerson, email, phone, website, address,
        industry, gstNumber, taxNumber, status, assignedSalesRepId || null, notes, id
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_CLIENT',
      module: 'CLIENTS',
      recordId: id,
      previousValue: existing[0],
      newValue: req.body,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteClient(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = await query<any[]>('SELECT * FROM clients WHERE id = ?', [id]);
    if (existing.length === 0) throw new AppError('Client not found', 404);

    const projectCount = await query<any[]>('SELECT COUNT(*) as count FROM projects WHERE client_id = ?', [id]);
    if (projectCount[0]?.count > 0) {
      throw new AppError(`Cannot delete client: ${projectCount[0].count} active projects are linked. Deactivate the client instead.`, 400);
    }

    await query('DELETE FROM clients WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'DELETE_CLIENT',
      module: 'CLIENTS',
      recordId: id,
      previousValue: existing[0],
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Client removed successfully' });
  } catch (error) {
    next(error);
  }
}
