import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export async function getReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { reportType } = req.params;
    const { startDate, endDate, departmentId, employeeId, clientId, status, year, month } = req.query as Record<string, string>;

    let data: any[] = [];

    switch (reportType) {
      case 'employees': {
        let sql = `
          SELECT e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as full_name, e.email, e.phone,
                 d.name as department, e.designation, e.employment_type, e.employment_status,
                 e.joining_date, e.basic_salary, CONCAT(m.first_name, ' ', m.last_name) as manager
          FROM employees e
          LEFT JOIN departments d ON e.department_id = d.id
          LEFT JOIN employees m ON e.reporting_manager_id = m.id
          WHERE e.deleted_at IS NULL
        `;
        const params: any[] = [];
        if (departmentId) { sql += ' AND e.department_id = ?'; params.push(departmentId); }
        if (status) { sql += ' AND e.employment_status = ?'; params.push(status); }
        sql += ' ORDER BY e.joining_date DESC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'attendance': {
        let sql = `
          SELECT a.date, e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                 d.name as department, a.check_in, a.check_out, a.total_hours, a.overtime_hours, a.status
          FROM attendance a
          JOIN employees e ON a.employee_id = e.id
          LEFT JOIN departments d ON e.department_id = d.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (startDate && endDate) { sql += ' AND a.date BETWEEN ? AND ?'; params.push(startDate, endDate); }
        if (departmentId) { sql += ' AND e.department_id = ?'; params.push(departmentId); }
        if (employeeId) { sql += ' AND a.employee_id = ?'; params.push(employeeId); }
        if (status) { sql += ' AND a.status = ?'; params.push(status); }
        sql += ' ORDER BY a.date DESC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'leave': {
        let sql = `
          SELECT lr.start_date, lr.end_date, lr.total_days, lt.name as leave_type, lr.reason, lr.status,
                 e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as employee_name, d.name as department
          FROM leave_requests lr
          JOIN employees e ON lr.employee_id = e.id
          JOIN leave_types lt ON lr.leave_type_id = lt.id
          LEFT JOIN departments d ON e.department_id = d.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (startDate && endDate) { sql += ' AND lr.start_date >= ? AND lr.end_date <= ?'; params.push(startDate, endDate); }
        if (departmentId) { sql += ' AND e.department_id = ?'; params.push(departmentId); }
        if (employeeId) { sql += ' AND lr.employee_id = ?'; params.push(employeeId); }
        if (status) { sql += ' AND lr.status = ?'; params.push(status); }
        sql += ' ORDER BY lr.start_date DESC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'payroll': {
        let sql = `
          SELECT p.month, p.year, e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                 d.name as department, pi.basic_salary, pi.allowances, pi.bonus, pi.overtime_amount,
                 pi.gross_salary, pi.tax_deductions, pi.pf_deductions, pi.loan_deductions, pi.unpaid_leave_deductions,
                 pi.net_salary, pi.payment_status, p.status as payroll_status
          FROM payroll_items pi
          JOIN payroll p ON pi.payroll_id = p.id
          JOIN employees e ON pi.employee_id = e.id
          LEFT JOIN departments d ON e.department_id = d.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (year) { sql += ' AND p.year = ?'; params.push(parseInt(year, 10)); }
        if (month) { sql += ' AND p.month = ?'; params.push(parseInt(month, 10)); }
        if (departmentId) { sql += ' AND e.department_id = ?'; params.push(departmentId); }
        if (employeeId) { sql += ' AND pi.employee_id = ?'; params.push(employeeId); }
        sql += ' ORDER BY p.year DESC, p.month DESC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'projects': {
        let sql = `
          SELECT p.project_code, p.name as project_name, c.company_name as client,
                 CONCAT(pm.first_name, ' ', pm.last_name) as project_manager,
                 p.start_date, p.end_date, p.budget, p.status, p.priority
          FROM projects p
          LEFT JOIN clients c ON p.client_id = c.id
          LEFT JOIN employees pm ON p.project_manager_id = pm.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (clientId) { sql += ' AND p.client_id = ?'; params.push(clientId); }
        if (status) { sql += ' AND p.status = ?'; params.push(status); }
        sql += ' ORDER BY p.start_date DESC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'tasks': {
        let sql = `
          SELECT t.task_code, t.title as task_title, p.name as project_name,
                 CONCAT(e.first_name, ' ', e.last_name) as assigned_to,
                 t.priority, t.status, t.due_date, t.estimated_hours, t.actual_hours
          FROM tasks t
          JOIN projects p ON t.project_id = p.id
          LEFT JOIN employees e ON t.assigned_employee_id = e.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (departmentId) { sql += ' AND e.department_id = ?'; params.push(departmentId); }
        if (employeeId) { sql += ' AND t.assigned_employee_id = ?'; params.push(employeeId); }
        if (status) { sql += ' AND t.status = ?'; params.push(status); }
        sql += ' ORDER BY t.due_date ASC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'timesheets': {
        let sql = `
          SELECT ts.date, e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                 p.name as project_name, t.title as task_title, ts.hours, ts.is_billable, ts.status, ts.description
          FROM timesheets ts
          JOIN employees e ON ts.employee_id = e.id
          JOIN projects p ON ts.project_id = p.id
          LEFT JOIN tasks t ON ts.task_id = t.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (startDate && endDate) { sql += ' AND ts.date BETWEEN ? AND ?'; params.push(startDate, endDate); }
        if (employeeId) { sql += ' AND ts.employee_id = ?'; params.push(employeeId); }
        sql += ' ORDER BY ts.date DESC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'invoices': {
        let sql = `
          SELECT inv.invoice_number, c.company_name as client, p.name as project,
                 inv.invoice_date, inv.due_date, inv.subtotal, inv.tax_amount,
                 inv.grand_total, inv.paid_amount, inv.remaining_balance, inv.status
          FROM invoices inv
          JOIN clients c ON inv.client_id = c.id
          LEFT JOIN projects p ON inv.project_id = p.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (clientId) { sql += ' AND inv.client_id = ?'; params.push(clientId); }
        if (status) { sql += ' AND inv.status = ?'; params.push(status); }
        sql += ' ORDER BY inv.invoice_date DESC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'income': {
        let sql = `
          SELECT inc.income_code, inc.date, inc.category, inc.amount, inc.payment_method,
                 c.company_name as client, p.name as project, inc.reference_number, inc.description
          FROM incomes inc
          LEFT JOIN clients c ON inc.client_id = c.id
          LEFT JOIN projects p ON inc.project_id = p.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (startDate && endDate) { sql += ' AND inc.date BETWEEN ? AND ?'; params.push(startDate, endDate); }
        sql += ' ORDER BY inc.date DESC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'expenses': {
        let sql = `
          SELECT exp.expense_code, exp.date, ec.name as category, exp.amount, exp.vendor,
                 exp.payment_method, p.name as project, exp.status, exp.description
          FROM expenses exp
          JOIN expense_categories ec ON exp.category_id = ec.id
          LEFT JOIN projects p ON exp.project_id = p.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (startDate && endDate) { sql += ' AND exp.date BETWEEN ? AND ?'; params.push(startDate, endDate); }
        sql += ' ORDER BY exp.date DESC';
        data = await query<any[]>(sql, params);
        break;
      }

      case 'assets': {
        let sql = `
          SELECT a.asset_code, a.name as asset_name, a.category, a.serial_number,
                 a.purchase_date, a.purchase_cost, a.status, a.location,
                 CONCAT(e.first_name, ' ', e.last_name) as assigned_employee
          FROM assets a
          LEFT JOIN employees e ON a.assigned_employee_id = e.id
          ORDER BY a.name ASC
        `;
        data = await query<any[]>(sql);
        break;
      }

      default:
        data = [];
    }

    res.json({
      success: true,
      reportType,
      rowCount: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
}
