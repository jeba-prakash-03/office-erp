import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const roleName = req.user!.roleName;
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // 1. If Client Role
    if (roleName === 'client' && req.user?.clientId) {
      const clientId = req.user.clientId;

      const projectRows = await query<any[]>(
        `SELECT COUNT(*) as total_projects,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
         FROM projects WHERE client_id = ?`,
        [clientId]
      );

      const invoiceRows = await query<any[]>(
        `SELECT COUNT(*) as total_invoices,
                COALESCE(SUM(grand_total), 0) as total_amount,
                COALESCE(SUM(paid_amount), 0) as total_paid,
                COALESCE(SUM(remaining_balance), 0) as total_due
         FROM invoices WHERE client_id = ?`,
        [clientId]
      );

      const myProjects = await query<any[]>(
        `SELECT p.*, CONCAT(pm.first_name, ' ', pm.last_name) as manager_name
         FROM projects p
         LEFT JOIN employees pm ON p.project_manager_id = pm.id
         WHERE p.client_id = ?
         ORDER BY p.created_at DESC LIMIT 5`,
        [clientId]
      );

      const myInvoices = await query<any[]>(
        'SELECT * FROM invoices WHERE client_id = ? ORDER BY invoice_date DESC LIMIT 5',
        [clientId]
      );

      return res.json({
        success: true,
        role: 'client',
        stats: {
          projects: projectRows[0] || {},
          invoices: invoiceRows[0] || {},
        },
        recentProjects: myProjects,
        recentInvoices: myInvoices,
      });
    }

    // 2. If Employee Role (Self Service Portal)
    if (roleName === 'employee' && req.user?.employeeId) {
      const employeeId = req.user.employeeId;

      // Today's attendance
      const attRows = await query<any[]>(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employeeId, today]
      );

      // Tasks
      const taskRows = await query<any[]>(
        `SELECT COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
                SUM(CASE WHEN status != 'completed' AND due_date < CURDATE() THEN 1 ELSE 0 END) as overdue_tasks
         FROM tasks WHERE assigned_employee_id = ?`,
        [employeeId]
      );

      // Leave Balances
      const leaveBalances = await query<any[]>(
        `SELECT lb.*, lt.name as leave_type_name
         FROM leave_balances lb
         JOIN leave_types lt ON lb.leave_type_id = lt.id
         WHERE lb.employee_id = ? AND lb.year = ?`,
        [employeeId, currentYear]
      );

      // Recent assigned tasks
      const myTasks = await query<any[]>(
        `SELECT t.*, p.name as project_name
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.assigned_employee_id = ?
         ORDER BY t.due_date ASC, t.created_at DESC
         LIMIT 6`,
        [employeeId]
      );

      // Active Announcements
      const announcements = await query<any[]>(
        'SELECT * FROM announcements WHERE expiry_date IS NULL OR expiry_date >= CURDATE() ORDER BY publish_date DESC LIMIT 5'
      );

      return res.json({
        success: true,
        role: 'employee',
        stats: {
          todayAttendance: attRows[0] || null,
          tasks: taskRows[0] || {},
          leaveBalances,
        },
        myTasks,
        announcements,
      });
    }

    // 3. Admin / HR / Finance / Project Manager Comprehensive Dashboard
    // Employee counts
    const empStats = await query<any[]>(
      `SELECT COUNT(*) as total_employees,
              SUM(CASE WHEN employment_status = 'active' THEN 1 ELSE 0 END) as active_employees,
              SUM(CASE WHEN employment_status = 'probation' THEN 1 ELSE 0 END) as probation_employees
       FROM employees WHERE deleted_at IS NULL`
    );

    // Client & Project counts
    const clientCount = await query<any[]>('SELECT COUNT(*) as total_clients FROM clients WHERE status = "active"');
    const projectStats = await query<any[]>(
      `SELECT COUNT(*) as total_projects,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects,
              SUM(CASE WHEN status = 'planning' THEN 1 ELSE 0 END) as planning_projects
       FROM projects`
    );

    // Task counts
    const taskStats = await query<any[]>(
      `SELECT COUNT(*) as total_tasks,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
              SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as pending_tasks,
              SUM(CASE WHEN status != 'completed' AND due_date < CURDATE() THEN 1 ELSE 0 END) as overdue_tasks
       FROM tasks`
    );

    // Today's attendance summary
    const attendanceStats = await query<any[]>(
      `SELECT COUNT(*) as marked_count,
              SUM(CASE WHEN status IN ('present', 'late', 'half_day') THEN 1 ELSE 0 END) as present_today,
              SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_today,
              SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as on_leave_today
       FROM attendance WHERE date = ?`,
      [today]
    );

    const activeTotal = empStats[0]?.active_employees || 0;
    const presentToday = attendanceStats[0]?.present_today || 0;
    const onLeaveToday = attendanceStats[0]?.on_leave_today || 0;
    const absentToday = Math.max(0, activeTotal - presentToday - onLeaveToday);

    // Financial Monthly Metrics
    const incomeRows = await query<any[]>(
      'SELECT COALESCE(SUM(amount), 0) as monthly_income FROM incomes WHERE MONTH(date) = ? AND YEAR(date) = ?',
      [currentMonth, currentYear]
    );
    const expenseRows = await query<any[]>(
      'SELECT COALESCE(SUM(amount), 0) as monthly_expenses FROM expenses WHERE MONTH(date) = ? AND YEAR(date) = ? AND status = "approved"',
      [currentMonth, currentYear]
    );
    const payrollRows = await query<any[]>(
      'SELECT COALESCE(SUM(total_net), 0) as monthly_payroll FROM payroll WHERE month = ? AND year = ? AND status IN ("approved", "paid", "locked")',
      [currentMonth, currentYear]
    );

    const monthlyIncome = parseFloat(incomeRows[0]?.monthly_income || '0');
    const monthlyExpenses = parseFloat(expenseRows[0]?.monthly_expenses || '0');
    const monthlyPayroll = parseFloat(payrollRows[0]?.monthly_payroll || '0');
    const netProfit = monthlyIncome - (monthlyExpenses + monthlyPayroll);

    // Invoices summary
    const invoiceSummary = await query<any[]>(
      `SELECT COALESCE(SUM(remaining_balance), 0) as outstanding_receivables,
              SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count
       FROM invoices WHERE status IN ('sent', 'partially_paid', 'overdue')`
    );

    // Charts: Project Status breakdown
    const projectStatusChart = await query<any[]>(
      'SELECT status, COUNT(*) as count FROM projects GROUP BY status'
    );

    // Charts: Task Status breakdown
    const taskStatusChart = await query<any[]>(
      'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
    );

    // Charts: Expense Categories
    const expenseCategoryChart = await query<any[]>(
      `SELECT ec.name, COALESCE(SUM(exp.amount), 0) as amount
       FROM expense_categories ec
       LEFT JOIN expenses exp ON exp.category_id = ec.id AND YEAR(exp.date) = ? AND exp.status = 'approved'
       GROUP BY ec.id
       HAVING amount > 0
       ORDER BY amount DESC LIMIT 6`,
      [currentYear]
    );

    // Monthly Income vs Expense Trend (Last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const inc = await query<any[]>(
        'SELECT COALESCE(SUM(amount), 0) as total FROM incomes WHERE MONTH(date) = ? AND YEAR(date) = ?',
        [m, y]
      );
      const exp = await query<any[]>(
        'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE MONTH(date) = ? AND YEAR(date) = ? AND status = "approved"',
        [m, y]
      );

      monthlyTrends.push({
        month: d.toLocaleString('default', { month: 'short' }),
        income: parseFloat(inc[0]?.total || '0'),
        expenses: parseFloat(exp[0]?.total || '0'),
      });
    }

    // Recent activities (from Audit Logs)
    const recentActivities = await query<any[]>(
      `SELECT id, user_name, user_email, action, module, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 8`
    );

    // Upcoming Holidays
    const upcomingHolidays = await query<any[]>(
      'SELECT * FROM holidays WHERE date >= CURDATE() ORDER BY date ASC LIMIT 4'
    );

    res.json({
      success: true,
      role: 'admin',
      stats: {
        employees: {
          total: empStats[0]?.total_employees || 0,
          active: activeTotal,
          probation: empStats[0]?.probation_employees || 0,
        },
        attendance: {
          presentToday,
          absentToday,
          onLeaveToday,
          lateToday: attendanceStats[0]?.late_today || 0,
        },
        clients: {
          total: clientCount[0]?.total_clients || 0,
        },
        projects: {
          total: projectStats[0]?.total_projects || 0,
          active: projectStats[0]?.active_projects || 0,
          completed: projectStats[0]?.completed_projects || 0,
        },
        tasks: {
          total: taskStats[0]?.total_tasks || 0,
          pending: taskStats[0]?.pending_tasks || 0,
          completed: taskStats[0]?.completed_tasks || 0,
          overdue: taskStats[0]?.overdue_tasks || 0,
        },
        financials: {
          monthlyIncome,
          monthlyExpenses,
          monthlyPayroll,
          netProfit,
          outstandingReceivables: parseFloat(invoiceSummary[0]?.outstanding_receivables || '0'),
          overdueInvoices: invoiceSummary[0]?.overdue_count || 0,
        },
      },
      charts: {
        monthlyTrends,
        projectStatus: projectStatusChart,
        taskStatus: taskStatusChart,
        expenseCategories: expenseCategoryChart,
      },
      recentActivities,
      upcomingHolidays,
    });
  } catch (error) {
    next(error);
  }
}
