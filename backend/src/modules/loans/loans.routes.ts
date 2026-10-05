import { Router } from 'express';
import { listLoans, createLoan, reviewLoan } from './loans.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listLoans);
router.post('/', createLoan);
router.put('/:id/review', requirePermission('payroll.manage'), reviewLoan);

export default router;
