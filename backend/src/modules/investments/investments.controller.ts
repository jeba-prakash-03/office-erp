import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';
import { sendSuccess, sendCreated } from '../../utils/response';

/**
 * SUPER ADMIN ONLY - Investments Controller
 */

export async function listInvestments(req: Request, res: Response, next: NextFunction) {
  try {
    const investments = await query<any[]>(
      `SELECT i.*, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
       FROM investments i
       LEFT JOIN users u ON i.created_by_user_id = u.id
       ORDER BY i.date DESC`
    );

    // Calculate totals
    let totalInvested = 0;
    let totalCurrentValue = 0;

    for (const inv of investments) {
      totalInvested += Number(inv.amount) || 0;
      totalCurrentValue += Number(inv.current_value) || 0;
    }

    const netGain = totalCurrentValue - totalInvested;
    const overallReturnPct = totalInvested > 0 ? (netGain / totalInvested) * 100 : 0;

    return sendSuccess(res, {
      investments,
      summary: {
        totalInvested,
        totalCurrentValue,
        netGain,
        overallReturnPct: Number(overallReturnPct.toFixed(2)),
        activeCount: investments.filter(i => i.status === 'active').length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getInvestmentById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const rows = await query<any[]>('SELECT * FROM investments WHERE id = ?', [id]);
    if (rows.length === 0) throw new AppError('Investment not found', 404);
    return sendSuccess(res, rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function createInvestment(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, type, amount, date, source, currentValue, returnRate, status, notes, documentUrl } = req.body;

    if (!name || !amount || !date) {
      throw new AppError('Investment name, amount, and date are required', 400);
    }

    const id = `invst-${uuidv4().slice(0, 8)}`;
    const curVal = currentValue !== undefined ? currentValue : amount;
    const retRate = returnRate !== undefined ? returnRate : 0;

    await query(
      `INSERT INTO investments (id, name, type, amount, date, source, current_value, return_rate, status, notes, document_url, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        name.trim(),
        type || 'Other',
        amount,
        date,
        source || null,
        curVal,
        retRate,
        status || 'active',
        notes || null,
        documentUrl || null,
        req.user!.id,
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_INVESTMENT',
      module: 'INVESTMENTS',
      recordId: id,
      newValue: { name, amount, currentValue: curVal, type },
      ipAddress: req.ip,
    });

    return sendCreated(res, { id, name }, 'Investment record created successfully');
  } catch (error) {
    next(error);
  }
}

export async function updateInvestment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, type, amount, date, source, currentValue, returnRate, status, notes, documentUrl } = req.body;

    const oldRows = await query<any[]>('SELECT * FROM investments WHERE id = ?', [id]);
    if (oldRows.length === 0) throw new AppError('Investment not found', 404);
    const oldVal = oldRows[0];

    await query(
      `UPDATE investments
       SET name = COALESCE(?, name),
           type = COALESCE(?, type),
           amount = COALESCE(?, amount),
           date = COALESCE(?, date),
           source = COALESCE(?, source),
           current_value = COALESCE(?, current_value),
           return_rate = COALESCE(?, return_rate),
           status = COALESCE(?, status),
           notes = COALESCE(?, notes),
           document_url = COALESCE(?, document_url),
           updated_at = NOW()
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        type || null,
        amount !== undefined ? amount : null,
        date || null,
        source !== undefined ? source : null,
        currentValue !== undefined ? currentValue : null,
        returnRate !== undefined ? returnRate : null,
        status || null,
        notes !== undefined ? notes : null,
        documentUrl !== undefined ? documentUrl : null,
        id,
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_INVESTMENT',
      module: 'INVESTMENTS',
      recordId: id,
      previousValue: oldVal,
      newValue: { name, amount, currentValue, status },
      ipAddress: req.ip,
    });

    return sendSuccess(res, { id, updated: true }, undefined, 200, 'Investment record updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function deleteInvestment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const oldRows = await query<any[]>('SELECT * FROM investments WHERE id = ?', [id]);
    if (oldRows.length === 0) throw new AppError('Investment not found', 404);

    await query('DELETE FROM investments WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'DELETE_INVESTMENT',
      module: 'INVESTMENTS',
      recordId: id,
      previousValue: oldRows[0],
      ipAddress: req.ip,
    });

    return sendSuccess(res, { id, deleted: true }, undefined, 200, 'Investment record deleted successfully');
  } catch (error) {
    next(error);
  }
}
