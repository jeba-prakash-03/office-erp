import { Router } from 'express';
import { getReport } from './reports.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/:reportType', requirePermission('reports.view'), getReport);

export default router;
