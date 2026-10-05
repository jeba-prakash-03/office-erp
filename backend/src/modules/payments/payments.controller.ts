import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const clientId = req.query.clientId as string || '';
    const invoiceId = req.query.invoiceId as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Client portal isolation
    if (req.user?.roleName === 'client' && req.user?.clientId) {
      whereClause += ' AND pay.client_id = ?';
      params.push(req.user.clientId);
    } else if (clientId) {
      whereClause += ' AND pay.client_id = ?';
      params.push(clientId);
    }

    if (invoiceId) {
      whereClause += ' AND pay.invoice_id = ?';
      params.push(invoiceId);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM payments pay ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT pay.*, 
             c.company_name as client_name, c.client_code,
             inv.invoice_number, inv.grand_total as invoice_total,
             CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name
      FROM payments pay
      JOIN clients c ON pay.client_id = c.id
      JOIN invoices inv ON pay.invoice_id = inv.id
      LEFT JOIN users u ON pay.recorded_by_user_id = u.id
      ${whereClause}
      ORDER BY pay.payment_date DESC, pay.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const payments = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: payments,
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

export async function recordPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { invoiceId, amount, paymentDate, paymentMethod, transactionReference, notes } = req.body;

    if (!invoiceId || !amount || !paymentDate || !paymentMethod) {
      throw new AppError('Invoice, amount, payment date, and payment method are required', 400);
    }

    const parsedAmount = parseFloat(amount);
    if (parsedAmount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    const invRows = await query<any[]>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (invRows.length === 0) throw new AppError('Invoice not found', 404);

    const invoice = invRows[0];
    const currentRemaining = parseFloat(invoice.remaining_balance || '0');

    if (parsedAmount > currentRemaining + 0.01) { // 0.01 tolerance for precision
      throw new AppError(`Payment amount ($${parsedAmount}) exceeds the remaining invoice balance ($${currentRemaining})`, 400);
    }

    const paymentNumber = `PAY-${Math.floor(10000 + Math.random() * 90000)}`;
    const paymentId = `pay-${uuidv4()}`;
    const newPaidAmount = parseFloat(invoice.paid_amount || '0') + parsedAmount;
    const newRemaining = Math.max(0, currentRemaining - parsedAmount);
    const newStatus = newRemaining <= 0.01 ? 'paid' : 'partially_paid';

    await withTransaction(async (conn) => {
      // 1. Insert Payment Record
      await conn.query(
        `INSERT INTO payments (
          id, payment_number, invoice_id, client_id, amount, payment_date,
          payment_method, transaction_reference, notes, recorded_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          paymentId, paymentNumber, invoiceId, invoice.client_id, parsedAmount, paymentDate,
          paymentMethod, transactionReference || null, notes || null, req.user!.id
        ]
      );

      // 2. Update Invoice Balance & Status
      await conn.query(
        `UPDATE invoices 
         SET paid_amount = ?, remaining_balance = ?, status = ?
         WHERE id = ?`,
        [newPaidAmount, newRemaining, newStatus, invoiceId]
      );

      // 3. Automatically mirror to Incomes for accounting balance
      const incCode = `INC-${paymentNumber}`;
      await conn.query(
        `INSERT INTO incomes (
          id, income_code, client_id, invoice_id, project_id, category,
          amount, date, payment_method, reference_number, description, created_at
        ) VALUES (?, ?, ?, ?, ?, 'client_payment', ?, ?, ?, ?, ?, NOW())`,
        [
          uuidv4(), incCode, invoice.client_id, invoiceId, invoice.project_id,
          parsedAmount, paymentDate, paymentMethod, transactionReference || null,
          `Payment received against invoice ${invoice.invoice_number}`
        ]
      );
    });

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'RECORD_PAYMENT',
      module: 'PAYMENTS',
      recordId: paymentId,
      newValue: { paymentNumber, invoiceNumber: invoice.invoice_number, amount: parsedAmount, newStatus },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Payment of $${parsedAmount.toLocaleString()} recorded. Invoice is now ${newStatus}.`,
      data: { id: paymentId, paymentNumber },
    });
  } catch (error) {
    next(error);
  }
}
