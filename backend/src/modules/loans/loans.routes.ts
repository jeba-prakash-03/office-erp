import { Router } from 'express';
import { listLoans, createLoan, reviewLoan } from './loans.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listLoans);
router.post('/', createLoan);
router.put('/:id/review', requirePermission('payroll.manage'), reviewLoan);
router.put('/:id/approve', requirePermission('payroll.manage'), (req, res, next) => {
  req.body.status = 'approved';
  return reviewLoan(req, res, next);
});
router.put('/:id/reject', requirePermission('payroll.manage'), (req, res, next) => {
  req.body.status = 'rejected';
  return reviewLoan(req, res, next);
});

export default router;
