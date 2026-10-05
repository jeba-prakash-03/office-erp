import { Router } from 'express';
import { listReviews, createReview } from './performance.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listReviews);
router.post('/', requirePermission('performance.manage'), createReview);

export default router;
