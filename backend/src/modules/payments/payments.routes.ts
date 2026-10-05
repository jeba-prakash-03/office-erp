import { Router } from 'express';
import { listPayments, recordPayment } from './payments.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listPayments);
router.post('/', requirePermission('payments.manage'), recordPayment);

export default router;
