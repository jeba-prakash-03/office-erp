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

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM incomes inc ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT inc.*, 
             c.company_name as client_name,
             p.name as project_name,
             inv.invoice_number
      FROM incomes inc
      LEFT JOIN clients c ON inc.client_id = c.id
      LEFT JOIN projects p ON inc.project_id = p.id
      LEFT JOIN invoices inv ON inc.invoice_id = inv.id
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
    const { incomeCode, clientId, invoiceId, projectId, category, amount, date, paymentMethod, referenceNumber, description } = req.body;

    if (!amount || !date || !paymentMethod) {
      throw new AppError('Amount, date, and payment method are required', 400);
    }

    const code = incomeCode || `INC-${Math.floor(1000 + Math.random() * 9000)}`;
    const incomeId = `inc-${uuidv4()}`;

    await query(
      `INSERT INTO incomes (
        id, income_code, client_id, invoice_id, project_id, category,
        amount, date, payment_method, reference_number, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        incomeId, code, clientId || null, invoiceId || null, projectId || null,
        category || 'service_revenue', parseFloat(amount), date, paymentMethod,
        referenceNumber || null, description || null
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
    const categories = await query<any[]>('SELECT * FROM expense_categories ORDER BY name ASC');
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

export async function createExpenseCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description } = req.body;
    if (!name) throw new AppError('Category name is required', 400);

    const id = `exp-cat-${uuidv4()}`;
    await query(
      'INSERT INTO expense_categories (id, name, description, created_at) VALUES (?, ?, ?, NOW())',
      [id, name.trim(), description || null]
    );

    res.status(201).json({ success: true, message: 'Expense category created', data: { id } });
  } catch (error) {
    next(error);
  }
}

export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const categoryId = req.query.categoryId as string || '';
    const projectId = req.query.projectId as string || '';
    const status = req.query.status as string || '';
    const startDate = req.query.startDate as string || '';
    const endDate = req.query.endDate as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (categoryId) {
      whereClause += ' AND exp.category_id = ?';
      params.push(categoryId);
    }
    if (projectId) {
      whereClause += ' AND exp.project_id = ?';
      params.push(projectId);
    }
    if (status) {
      whereClause += ' AND exp.status = ?';
      params.push(status);
    }
    if (startDate && endDate) {
      whereClause += ' AND exp.date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM expenses exp ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT exp.*, 
             ec.name as category_name,
             p.name as project_name,
             CONCAT(u.first_name, ' ', u.last_name) as added_by_name,
             CONCAT(au.first_name, ' ', au.last_name) as approved_by_name
      FROM expenses exp
      JOIN expense_categories ec ON exp.category_id = ec.id
      LEFT JOIN projects p ON exp.project_id = p.id
      JOIN users u ON exp.added_by_user_id = u.id
      LEFT JOIN users au ON exp.approved_by_user_id = au.id
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
    const { expenseCode, categoryId, projectId, amount, date, vendor, paymentMethod, description } = req.body;
    const file = req.file;

    if (!categoryId || !amount || !date || !paymentMethod) {
      throw new AppError('Category, amount, date, and payment method are required', 400);
    }

    const code = expenseCode || `EXP-${Math.floor(1000 + Math.random() * 9000)}`;
    const expenseId = `exp-${uuidv4()}`;
    const receiptUrl = file ? `/uploads/${file.filename}` : null;

    await query(
      `INSERT INTO expenses (
        id, expense_code, category_id, project_id, amount, date, vendor,
        payment_method, description, receipt_url, status, added_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())`,
      [
        expenseId, code, categoryId, projectId || null, parseFloat(amount),
        date, vendor || null, paymentMethod, description || null,
        receiptUrl, req.user!.id
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_EXPENSE',
      module: 'FINANCE',
      recordId: expenseId,
      newValue: { expenseCode: code, amount, categoryId },
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
      'SELECT COALESCE(SUM(amount), 0) as total FROM incomes WHERE YEAR(date) = ?',
      [year]
    );
    const totalIncome = parseFloat(incomeRows[0]?.total || '0');

    // Total General Expenses
    const expenseRows = await query<any[]>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE YEAR(date) = ? AND status = "approved"',
      [year]
    );
    const totalExpenses = parseFloat(expenseRows[0]?.total || '0');

    // Total Payroll
    const payrollRows = await query<any[]>(
      'SELECT COALESCE(SUM(total_net), 0) as total FROM payroll WHERE year = ? AND status IN ("approved", "paid", "locked")',
      [year]
    );
    const payrollExpenses = parseFloat(payrollRows[0]?.total || '0');

    // Outstanding Receivables
    const invRows = await query<any[]>(
      'SELECT COALESCE(SUM(remaining_balance), 0) as total FROM invoices WHERE status IN ("sent", "partially_paid", "overdue")'
    );
    const outstandingReceivables = parseFloat(invRows[0]?.total || '0');

    const netProfit = totalIncome - totalExpenses;

    // Monthly Trends for Chart
    const monthlyIncomeRows = await query<any[]>(
      `SELECT MONTH(date) as month, SUM(amount) as income 
       FROM incomes 
       WHERE YEAR(date) = ? 
       GROUP BY MONTH(date)`,
      [year]
    );

    const monthlyExpenseRows = await query<any[]>(
      `SELECT MONTH(date) as month, SUM(amount) as expense 
       FROM expenses 
       WHERE YEAR(date) = ? AND status = 'approved'
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
      `SELECT ec.name, COALESCE(SUM(exp.amount), 0) as total
       FROM expense_categories ec
       LEFT JOIN expenses exp ON exp.category_id = ec.id AND YEAR(exp.date) = ? AND exp.status = 'approved'
       GROUP BY ec.id
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
