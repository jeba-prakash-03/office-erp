import { pool, query } from '../config/db';
import { logger } from '../utils/logger';
import { runMigrations } from './migrate';
import { seedSystem } from './seed';

export async function resetDatabase() {
  logger.info('===================================================================');
  logger.info('STARTING COMPLETE DATABASE CLEANUP & RESET TO CLEAN STATE');
  logger.info('===================================================================');

  // Disable foreign keys to cleanly drop / truncate tables
  await query('SET FOREIGN_KEY_CHECKS = 0;');

  const tables = [
    'audit_logs',
    'notifications',
    'documents',
    'employee_documents',
    'payslips',
    'payroll_records',
    'payroll_runs',
    'employee_salary_structures',
    'salary_components',
    'leave_requests',
    'leave_balances',
    'leave_types',
    'holidays',
    'attendance',
    'attendance_months',
    'timesheets',
    'task_comments',
    'tasks',
    'project_members',
    'projects',
    'leads',
    'payments',
    'invoices',
    'invoice_items',
    'expenses',
    'income',
    'investments',
    'clients',
    'performance_reviews',
    'performance_goals',
    'performance_cycles',
    'employees',
    'departments',
    'role_permissions',
    'permissions',
    'users',
    'roles',
    'company_settings'
  ];

  for (const tbl of tables) {
    try {
      await query(`DROP TABLE IF EXISTS ${tbl}`);
      logger.info(`Dropped table: ${tbl}`);
    } catch (err: any) {
      logger.warn(`Could not drop table ${tbl}: ${err.message}`);
    }
  }

  await query('SET FOREIGN_KEY_CHECKS = 1;');
  logger.info('All tables dropped cleanly.');

  // Run Migrations (Create clean tables)
  await runMigrations();

  // Run System Seed (Roles, Permissions, Company Config, Super Admin)
  await seedSystem();

  logger.info('===================================================================');
  logger.info('DATABASE RESET COMPLETE — 100% CLEAN SYSTEM READY');
  logger.info('===================================================================');
}

if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('Database successfully reset to clean state.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database reset failed:', err);
      process.exit(1);
    });
}
