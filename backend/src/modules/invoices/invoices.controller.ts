import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const search = req.query.search as string || '';
    const status = req.query.status as string || '';
    const clientId = req.query.clientId as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Client portal isolation
    if (req.user?.roleName === 'client' && req.user?.clientId) {
      whereClause += ' AND inv.client_id = ?';
      params.push(req.user.clientId);
    } else if (clientId) {
      whereClause += ' AND inv.client_id = ?';
      params.push(clientId);
    }

    if (search) {
      whereClause += ' AND (inv.invoice_number LIKE ? OR c.company_name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s);
    }
    if (status) {
      whereClause += ' AND inv.status = ?';
      params.push(status);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM invoices inv JOIN clients c ON inv.client_id = c.id ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT inv.*, 
             c.company_name as client_name, c.client_code, c.email as client_email,
             p.name as project_name
      FROM invoices inv
      JOIN clients c ON inv.client_id = c.id
      LEFT JOIN projects p ON inv.project_id = p.id
      ${whereClause}
      ORDER BY inv.invoice_date DESC, inv.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const invoices = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: invoices,
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

export async function getInvoiceById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const invRows = await query<any[]>(
      `SELECT inv.*, 
              c.company_name as client_name, c.client_code, c.email as client_email,
              c.phone as client_phone, c.address as client_address, c.gst_number as client_gst,
              p.name as project_name, p.project_code
       FROM invoices inv
       JOIN clients c ON inv.client_id = c.id
       LEFT JOIN projects p ON inv.project_id = p.id
       WHERE inv.id = ?`,
      [id]
    );

    if (invRows.length === 0) throw new AppError('Invoice not found', 404);

    const invoice = invRows[0];

    // Client isolation check
    if (req.user?.roleName === 'client' && req.user?.clientId !== invoice.client_id) {
      throw new AppError('Forbidden: Access denied to this invoice', 403);
    }

    const items = await query<any[]>(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC, id ASC',
      [id]
    );

    const payments = await query<any[]>(
      'SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC',
      [id]
    );

    const companySettings = await query<any[]>('SELECT * FROM company_settings LIMIT 1');

    res.json({
      success: true,
      data: {
        ...invoice,
        items,
        payments,
        company: companySettings[0] || {},
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoiceNumber = req.body.invoiceNumber || req.body.invoice_number;
    const clientId = req.body.clientId || req.body.client_id;
    const projectId = req.body.projectId || req.body.project_id || null;
    const invoiceDate = req.body.invoiceDate || req.body.invoice_date || new Date().toISOString().split('T')[0];
    const dueDate = req.body.dueDate || req.body.due_date;
    const discountType = req.body.discountType || req.body.discount_type || 'percentage';
    const discountValue = req.body.discountValue || req.body.discount_value || 0;
    const taxRate = req.body.taxRate || req.body.tax_rate || 0;
    const notes = req.body.notes || null;
    const terms = req.body.terms || null;
    const items = req.body.items || [];

    if (!clientId || !invoiceDate || !dueDate || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Client, invoice date, due date, and at least one item are required', 400);
    }

    const invNum = invoiceNumber || `INV-${Math.floor(10000 + Math.random() * 90000)}`;

    const existing = await query<any[]>('SELECT id FROM invoices WHERE invoice_number = ?', [invNum]);
    if (existing.length > 0) throw new AppError('Invoice number already exists', 409);

    // Calculate item totals and subtotal
    let subtotal = 0;
    const processedItems: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      const qty = parseFloat(itm.quantity || itm.qty || '1');
      const unit = parseFloat(itm.unitPrice || itm.unit_price || itm.rate || '0');
      const lineTotal = Math.round(qty * unit * 100) / 100;
      subtotal += lineTotal;

      processedItems.push({
        id: `inv-item-${uuidv4()}`,
        description: itm.description || 'Item description',
        quantity: qty,
        unitPrice: unit,
        totalPrice: lineTotal,
        sortOrder: i,
      });
    }

    const discVal = parseFloat(String(discountValue) || '0');
    let discountAmount = 0;
    if (discountType === 'fixed') {
      discountAmount = discVal;
    } else {
      discountAmount = Math.round((subtotal * (discVal / 100)) * 100) / 100;
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxPct = parseFloat(taxRate || '0');
    const taxAmount = Math.round((taxableAmount * (taxPct / 100)) * 100) / 100;
    const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

    const invoiceId = `inv-${uuidv4()}`;

    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO invoices (
          id, invoice_number, client_id, project_id, invoice_date, due_date,
          subtotal, discount_type, discount_value, tax_rate, tax_amount,
          grand_total, paid_amount, remaining_balance, status, notes, terms,
          created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'draft', ?, ?, ?, NOW())`,
        [
          invoiceId, invNum, clientId, projectId || null, invoiceDate, dueDate,
          subtotal, discountType || 'percentage', discVal, taxPct, taxAmount,
          grandTotal, grandTotal, notes || null, terms || null, req.user!.id
        ]
      );

      for (const item of processedItems) {
        await conn.query(
          `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [item.id, invoiceId, item.description, item.quantity, item.unitPrice, item.totalPrice, item.sortOrder]
        );
      }
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_INVOICE',
      module: 'INVOICES',
      recordId: invoiceId,
      newValue: { invoiceNumber: invNum, clientId, grandTotal },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Invoice created successfully', data: { id: invoiceId } });
  } catch (error) {
    next(error);
  }
}

export async function updateInvoiceStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'].includes(status)) {
      throw new AppError('Invalid invoice status', 400);
    }

    await query('UPDATE invoices SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: `Invoice status updated to ${status}` });
  } catch (error) {
    next(error);
  }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM invoices WHERE id = ?', [id]);
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    next(error);
  }
}
