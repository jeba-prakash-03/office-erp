import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export async function searchGlobal(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query.q as string || '';
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: { employees: [], clients: [], projects: [], tasks: [], invoices: [], documents: [] } });
    }

    const searchTerm = `%${q.trim()}%`;

    // Employees
    const employees = await query<any[]>(
      `SELECT id, employee_id, CONCAT(first_name, ' ', last_name) as title, designation as subtitle, profile_photo, 'employee' as type
       FROM employees 
       WHERE deleted_at IS NULL AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR employee_id LIKE ? OR designation LIKE ?)
       LIMIT 5`,
      [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
    );

    // Clients
    const clients = await query<any[]>(
      `SELECT id, client_code, company_name as title, contact_person as subtitle, 'client' as type
       FROM clients 
       WHERE company_name LIKE ? OR contact_person LIKE ? OR email LIKE ? OR client_code LIKE ?
       LIMIT 5`,
      [searchTerm, searchTerm, searchTerm, searchTerm]
    );

    // Projects
    const projects = await query<any[]>(
      `SELECT id, project_code, name as title, status as subtitle, 'project' as type
       FROM projects 
       WHERE name LIKE ? OR project_code LIKE ? OR technology LIKE ?
       LIMIT 5`,
      [searchTerm, searchTerm, searchTerm]
    );

    // Tasks
    const tasks = await query<any[]>(
      `SELECT id, task_code, title, status as subtitle, 'task' as type
       FROM tasks 
       WHERE title LIKE ? OR task_code LIKE ? OR description LIKE ?
       LIMIT 5`,
      [searchTerm, searchTerm, searchTerm]
    );

    // Invoices
    const invoices = await query<any[]>(
      `SELECT id, invoice_number as title, grand_total, status as subtitle, 'invoice' as type
       FROM invoices 
       WHERE invoice_number LIKE ?
       LIMIT 5`,
      [searchTerm]
    );

    // Documents
    const documents = await query<any[]>(
      `SELECT id, title, category as subtitle, file_url, 'document' as type
       FROM documents 
       WHERE title LIKE ?
       LIMIT 5`,
      [searchTerm]
    );

    res.json({
      success: true,
      data: {
        employees,
        clients,
        projects,
        tasks,
        invoices,
        documents,
      },
    });
  } catch (error) {
    next(error);
  }
}
