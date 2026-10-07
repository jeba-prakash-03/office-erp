import { Router } from 'express';
import {
  listSalaryComponents,
  createSalaryComponent,
  updateSalaryComponent,
  deleteSalaryComponent,
  getEmployeeSalaryStructure,
  updateEmployeeSalaryStructure,
  listPayrollRuns,
  getPayrollById,
  calculateMonthlyPayroll,
  finalizePayroll,
  reopenPayroll,
  getPayslip,
  getMyPayslips,
} from './payroll.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

// Employee Self-Service
router.get('/my-payslips', getMyPayslips);
router.get('/payslips/my', getMyPayslips);

// Salary Components (Configurable)
router.get('/components', requireRole(['super_admin', 'admin']), listSalaryComponents);
router.post('/components', requireRole(['super_admin', 'admin']), createSalaryComponent);
router.put('/components/:id', requireRole(['super_admin', 'admin']), updateSalaryComponent);
router.delete('/components/:id', requireRole(['super_admin', 'admin']), deleteSalaryComponent);

// Employee Salary Structure
router.get('/structures/:employeeId', requireRole(['super_admin', 'admin']), getEmployeeSalaryStructure);
router.put('/structures/:employeeId', requireRole(['super_admin', 'admin']), updateEmployeeSalaryStructure);

// Payroll Runs
router.get('/runs', requirePermission('payroll.view'), listPayrollRuns);
router.get('/', requirePermission('payroll.view'), listPayrollRuns);
router.get('/runs/:id', requirePermission('payroll.view'), getPayrollById);
router.get('/:id', requirePermission('payroll.view'), getPayrollById);

// Processing / Calculation Engine
router.post('/calculate', requirePermission('payroll.manage'), calculateMonthlyPayroll);
router.post('/process', requirePermission('payroll.manage'), calculateMonthlyPayroll);
router.post('/finalize', requirePermission('payroll.finalize'), finalizePayroll);
router.post('/approve', requirePermission('payroll.finalize'), finalizePayroll);
router.post('/reopen', requireRole(['super_admin', 'admin']), reopenPayroll);

// Payslip retrieval (Self-service or Admin)
router.get('/payslips/:id', getPayslip);
router.get('/payslip/:id', getPayslip);
router.get('/items/:id', getPayslip);

export default router;
