import { Router } from 'express';
import {
  listPayrollRuns,
  getPayrollById,
  processMonthlyPayroll,
  approvePayroll,
  markPayrollPaid,
  getPayslip,
} from './payroll.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('payroll.view'), listPayrollRuns);
router.get('/:id', requirePermission('payroll.view'), getPayrollById);
router.post('/process', requirePermission('payroll.create'), processMonthlyPayroll);
router.put('/:id/approve', requirePermission('payroll.approve'), approvePayroll);
router.put('/:id/pay', requirePermission('payroll.approve'), markPayrollPaid);
router.get('/payslip/:itemId', getPayslip);

export default router;
