import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { sendSuccess } from '../../utils/response';

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const roleName = req.user!.roleName;
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // -------------------------------------------------------------------------
    // 1. EMPLOYEE DASHBOARD
    // -------------------------------------------------------------------------
    if (roleName === 'employee') {
      let employeeId = req.user?.employeeId;
      if (!employeeId && req.user?.id) {
        const empRows = await query<any[]>('SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', [req.user.id]);
        if (empRows.length > 0) employeeId = empRows[0].id;
      }

      if (!employeeId) {
        return sendSuccess(res, {
          role: 'employee',
          hasProfile: false,
          message: 'No employee profile linked to this account.',
        });
      }

      // My Attendance this month
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

      const attRows = await query<any[]>(
        `SELECT
           SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
           SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
           SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_days,
           SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) as half_days
         FROM attendance
         WHERE employee_id = ? AND date BETWEEN ? AND ?`,
        [employeeId, startOfMonth, endOfMonth]
      );

      // My Leave Balances & Requests
      const leaveBalanceRows = await query<any[]>(
        `SELECT SUM(total_days) as total_allowed, SUM(used_days) as used_days, SUM(remaining_days) as remaining_days, SUM(pending_days) as pending_days
         FROM leave_balances WHERE employee_id = ? AND year = ?`,
        [employeeId, currentYear]
      );

      const pendingLeaveRequests = await query<any[]>(
        `SELECT lr.*, lt.name as leave_type_name
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = ? AND lr.status = 'pending'
         ORDER BY lr.created_at DESC LIMIT 5`,
        [employeeId]
      );

      // My Tasks
      const taskStats = await query<any[]>(
        `SELECT
           COUNT(*) as total_tasks,
           SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_tasks,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
         FROM tasks WHERE assigned_employee_id = ?`,
        [employeeId]
      );

      const recentTasks = await query<any[]>(
        `SELECT t.*, p.name as project_name
         FROM tasks t
         LEFT JOIN projects p ON t.project_id = p.id
         WHERE t.assigned_employee_id = ? AND t.status != 'completed'
         ORDER BY t.priority DESC, t.due_date ASC LIMIT 5`,
        [employeeId]
      );

      // My Assigned Projects
      const myProjects = await query<any[]>(
        `SELECT p.* FROM projects p
         JOIN project_members pm ON p.id = pm.project_id
         WHERE pm.employee_id = ? AND p.status = 'active'
         ORDER BY p.start_date DESC LIMIT 5`,
        [employeeId]
      );

      // My Latest Payslip
      const latestPayslip = await query<any[]>(
        `SELECT ps.*, pr.net_salary, pr.gross_salary, pr.payment_status
         FROM payslips ps
         JOIN payroll_records pr ON ps.payroll_record_id = pr.id
         WHERE ps.employee_id = ?
         ORDER BY ps.year DESC, ps.month DESC LIMIT 1`,
        [employeeId]
      );

      // My Latest Performance Review
      const latestReview = await query<any[]>(
        `SELECT pr.*, pc.title as cycle_title
         FROM performance_reviews pr
         JOIN performance_cycles pc ON pr.cycle_id = pc.id
         WHERE pr.employee_id = ?
         ORDER BY pr.created_at DESC LIMIT 1`,
        [employeeId]
      );

      // My Unread Notifications
      const notifications = await query<any[]>(
        `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 5`,
        [req.user!.id]
      );

      return sendSuccess(res, {
        role: 'employee',
        attendance: attRows[0] || { present_days: 0, absent_days: 0, leave_days: 0, half_days: 0 },
        leave: {
          balances: leaveBalanceRows[0] || { total_allowed: 0, used_days: 0, remaining_days: 0 },
          pendingRequests: pendingLeaveRequests,
        },
        tasks: {
          stats: taskStats[0] || { total_tasks: 0, todo_tasks: 0, in_progress_tasks: 0, completed_tasks: 0 },
          recent: recentTasks,
        },
        projects: myProjects,
        payroll: latestPayslip[0] || null,
        performance: latestReview[0] || null,
        notifications,
      });
    }

    // -------------------------------------------------------------------------
    // 2. ADMIN & SUPER ADMIN DASHBOARD
    // -------------------------------------------------------------------------

    // Employees counts
    const empCountRows = await query<any[]>(
      `SELECT
         COUNT(*) as total_employees,
         SUM(CASE WHEN employment_status = 'active' THEN 1 ELSE 0 END) as active_employees
       FROM employees WHERE deleted_at IS NULL`
    );

    // Attendance Today
    const todayAttRows = await query<any[]>(
      `SELECT
         SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_today,
         SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_today,
         SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_today
       FROM attendance WHERE date = ?`,
      [today]
    );

    // Pending Leaves
    const pendingLeavesCount = await query<any[]>(
      `SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'`
    );

    // Projects & Tasks
    const projectStats = await query<any[]>(
      `SELECT
         COUNT(*) as total_projects,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects
       FROM projects`
    );

    const taskStats = await query<any[]>(
      `SELECT
         COUNT(*) as total_tasks,
         SUM(CASE WHEN status IN ('todo', 'in_progress', 'review') THEN 1 ELSE 0 END) as open_tasks
       FROM tasks`
    );

    // Finance: Monthly Income, Expenses, Outstanding Invoices
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

    const incomeRows = await query<any[]>(
      `SELECT COALESCE(SUM(amount), 0) as monthly_income FROM income WHERE date BETWEEN ? AND ?`,
      [startOfMonth, endOfMonth]
    );

    const expenseRows = await query<any[]>(
      `SELECT COALESCE(SUM(amount), 0) as monthly_expenses FROM expenses WHERE date BETWEEN ? AND ?`,
      [startOfMonth, endOfMonth]
    );

    const invoiceStats = await query<any[]>(
      `SELECT
         COUNT(*) as outstanding_count,
         COALESCE(SUM(remaining_balance), 0) as outstanding_amount
       FROM invoices WHERE status IN ('sent', 'partially_paid', 'overdue')`
    );

    // Monthly Payroll Run Status
    const payrollRun = await query<any[]>(
      `SELECT status, total_net, total_employees FROM payroll_runs WHERE month = ? AND year = ?`,
      [currentMonth, currentYear]
    );

    // Recent Activity / Audit Log
    const recentActivity = await query<any[]>(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 6`
    );

    // Department Breakdown
    const deptBreakdown = await query<any[]>(
      `SELECT d.name, COUNT(e.id) as employee_count
       FROM departments d
       LEFT JOIN employees e ON d.id = e.department_id AND e.deleted_at IS NULL AND e.employment_status = 'active'
       GROUP BY d.id, d.name
       ORDER BY employee_count DESC`
    );

    const baseDashboard = {
      role: roleName,
      metrics: {
        totalEmployees: empCountRows[0]?.total_employees || 0,
        activeEmployees: empCountRows[0]?.active_employees || 0,
        presentToday: todayAttRows[0]?.present_today || 0,
        absentToday: todayAttRows[0]?.absent_today || 0,
        leaveToday: todayAttRows[0]?.leave_today || 0,
        pendingLeaveRequests: pendingLeavesCount[0]?.count || 0,
        totalProjects: projectStats[0]?.total_projects || 0,
        activeProjects: projectStats[0]?.active_projects || 0,
        openTasks: taskStats[0]?.open_tasks || 0,
        monthlyIncome: Number(incomeRows[0]?.monthly_income) || 0,
        monthlyExpenses: Number(expenseRows[0]?.monthly_expenses) || 0,
        outstandingInvoicesCount: invoiceStats[0]?.outstanding_count || 0,
        outstandingInvoicesAmount: Number(invoiceStats[0]?.outstanding_amount) || 0,
        payrollStatus: payrollRun[0]?.status || 'pending',
      },
      recentActivity,
      departmentBreakdown: deptBreakdown,
    };

    // -------------------------------------------------------------------------
    // 3. SUPER ADMIN EXTRA DATA (Investments & System Security Overview)
    // -------------------------------------------------------------------------
    if (roleName === 'super_admin') {
      const userCountRows = await query<any[]>('SELECT COUNT(*) as total_users FROM users');
      const investmentRows = await query<any[]>(
        `SELECT
           COUNT(*) as total_investments,
           COALESCE(SUM(amount), 0) as total_invested,
           COALESCE(SUM(current_value), 0) as total_current_val
         FROM investments`
      );

      const totalInvested = Number(investmentRows[0]?.total_invested) || 0;
      const totalCurrentVal = Number(investmentRows[0]?.total_current_val) || 0;
      const returnPct = totalInvested > 0 ? ((totalCurrentVal - totalInvested) / totalInvested) * 100 : 0;

      return sendSuccess(res, {
        ...baseDashboard,
        superAdminOnly: {
          systemStatus: 'healthy',
          uptimeHours: Math.floor(process.uptime() / 3600),
          totalUsers: userCountRows[0]?.total_users || 0,
          investments: {
            totalInvestments: investmentRows[0]?.total_investments || 0,
            totalInvested,
            totalCurrentValue: totalCurrentVal,
            netGain: totalCurrentVal - totalInvested,
            returnRate: Number(returnPct.toFixed(2)),
          },
        },
      });
    }

    return sendSuccess(res, baseDashboard);
  } catch (error) {
    next(error);
  }
}
