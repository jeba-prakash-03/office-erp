import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listIncomes(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const category = req.query.category as string || '';
    const clientId = req.query.clientId as string || '';
    const startDate = req.query.startDate as string || '';
    const endDate = req.query.endDate as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (category) {
      whereClause += ' AND inc.category = ?';
      params.push(category);
    }
    if (clientId) {
      whereClause += ' AND inc.client_id = ?';
      params.push(clientId);
    }
    if (startDate && endDate) {
      whereClause += ' AND inc.date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM income inc ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT inc.*, 
             c.company_name as client_name
      FROM income inc
      LEFT JOIN clients c ON inc.client_id = c.id
      ${whereClause}
      ORDER BY inc.date DESC, inc.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const incomes = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: incomes,
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

export async function createIncome(req: Request, res: Response, next: NextFunction) {
  try {
    const { incomeCode, clientId, category, amount, date, paymentMethod, payment_method, reference, referenceNumber, description, notes } = req.body;

    const method = paymentMethod || payment_method || 'bank_transfer';
    if (!amount || !date) {
      throw new AppError('Amount and date are required', 400);
    }

    const code = incomeCode || `INC-${Math.floor(1000 + Math.random() * 9000)}`;
    const incomeId = `inc-${uuidv4()}`;

    await query(
      `INSERT INTO income (
        id, income_code, category, description, client_id,
        amount, payment_method, reference, notes, date, created_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        incomeId, code, category || 'Service Revenue', description || category || 'Income',
        clientId || null, parseFloat(amount), method, reference || referenceNumber || null,
        notes || null, date, req.user?.id || null
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_INCOME',
      module: 'FINANCE',
      recordId: incomeId,
      newValue: { incomeCode: code, amount, date, category },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Income recorded successfully', data: { id: incomeId } });
  } catch (error) {
    next(error);
  }
}

export async function listExpenseCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = [
      { id: 'cat-office', name: 'Office Supplies & Equipment' },
      { id: 'cat-software', name: 'Software & Subscriptions' },
      { id: 'cat-utilities', name: 'Rent & Utilities' },
      { id: 'cat-travel', name: 'Travel & Meals' },
      { id: 'cat-legal', name: 'Legal & Professional Services' },
      { id: 'cat-marketing', name: 'Marketing & Advertising' },
      { id: 'cat-other', name: 'Miscellaneous Expenses' },
    ];
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

export async function createExpenseCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body;
    if (!name) throw new AppError('Category name is required', 400);
    const id = `exp-cat-${uuidv4()}`;
    res.status(201).json({ success: true, message: 'Expense category created', data: { id, name } });
  } catch (error) {
    next(error);
  }
}

export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const category = req.query.category as string || req.query.categoryId as string || '';
    const startDate = req.query.startDate as string || '';
    const endDate = req.query.endDate as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (category) {
      whereClause += ' AND exp.category = ?';
      params.push(category);
    }
    if (startDate && endDate) {
      whereClause += ' AND exp.date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM expenses exp ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT exp.*, 
             exp.category as category_name,
             CONCAT(u.first_name, ' ', u.last_name) as added_by_name
      FROM expenses exp
      LEFT JOIN users u ON exp.created_by_user_id = u.id
      ${whereClause}
      ORDER BY exp.date DESC, exp.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const expenses = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: expenses,
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

export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const { expenseCode, category, categoryId, amount, date, vendor, paymentMethod, payment_method, reference, description, notes } = req.body;
    const file = req.file;

    const method = paymentMethod || payment_method || 'bank_transfer';
    const targetCat = category || categoryId || 'Operational';

    if (!amount || !date) {
      throw new AppError('Amount and date are required', 400);
    }

    const code = expenseCode || `EXP-${Math.floor(1000 + Math.random() * 9000)}`;
    const expenseId = `exp-${uuidv4()}`;
    const receiptUrl = file ? `/uploads/${file.filename}` : null;

    await query(
      `INSERT INTO expenses (
        id, expense_code, category, description, vendor, amount,
        payment_method, reference, attachment_url, notes, date, created_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        expenseId, code, targetCat, description || targetCat || 'Expense',
        vendor || null, parseFloat(amount), method, reference || null,
        receiptUrl, notes || null, date, req.user?.id || null
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_EXPENSE',
      module: 'FINANCE',
      recordId: expenseId,
      newValue: { expenseCode: code, amount, category: targetCat },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Expense recorded successfully', data: { id: expenseId, receiptUrl } });
  } catch (error) {
    next(error);
  }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM expenses WHERE id = ?', [id]);
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getFinancialSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const year = parseInt(req.query.year as string || `${new Date().getFullYear()}`, 10);

    // Total Incomes
    const incomeRows = await query<any[]>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE YEAR(date) = ?',
      [year]
    );
    const totalIncome = parseFloat(incomeRows[0]?.total || '0');

    // Total General Expenses
    const expenseRows = await query<any[]>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE YEAR(date) = ?',
      [year]
    );
    const totalExpenses = parseFloat(expenseRows[0]?.total || '0');

    // Total Payroll
    const payrollRows = await query<any[]>(
      'SELECT COALESCE(SUM(total_net), 0) as total FROM payroll_runs WHERE year = ? AND status = "finalized"',
      [year]
    );
    const payrollExpenses = parseFloat(payrollRows[0]?.total || '0');

    // Outstanding Receivables
    const invRows = await query<any[]>(
      'SELECT COALESCE(SUM(remaining_balance), 0) as total FROM invoices WHERE status IN ("sent", "partially_paid", "overdue")'
    );
    const outstandingReceivables = parseFloat(invRows[0]?.total || '0');

    const netProfit = totalIncome - totalExpenses - payrollExpenses;

    // Monthly Trends for Chart
    const monthlyIncomeRows = await query<any[]>(
      `SELECT MONTH(date) as month, SUM(amount) as income 
       FROM income 
       WHERE YEAR(date) = ? 
       GROUP BY MONTH(date)`,
      [year]
    );

    const monthlyExpenseRows = await query<any[]>(
      `SELECT MONTH(date) as month, SUM(amount) as expense 
       FROM expenses 
       WHERE YEAR(date) = ?
       GROUP BY MONTH(date)`,
      [year]
    );

    const monthlyTrends = [];
    for (let m = 1; m <= 12; m++) {
      const inc = monthlyIncomeRows.find((r) => r.month === m)?.income || 0;
      const exp = monthlyExpenseRows.find((r) => r.month === m)?.expense || 0;
      monthlyTrends.push({
        month: m,
        monthName: new Date(year, m - 1).toLocaleString('default', { month: 'short' }),
        income: parseFloat(inc),
        expense: parseFloat(exp),
        profit: parseFloat(inc) - parseFloat(exp),
      });
    }

    // Expense Categories breakdown
    const categoryBreakdown = await query<any[]>(
      `SELECT category as name, COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE YEAR(date) = ?
       GROUP BY category
       HAVING total > 0
       ORDER BY total DESC`,
      [year]
    );

    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        payrollExpenses,
        outstandingReceivables,
        netProfit,
        monthlyTrends,
        categoryBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
}
