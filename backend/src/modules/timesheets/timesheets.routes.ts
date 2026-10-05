import { Router } from 'express';
import {
  listTimesheets,
  logTimesheet,
  reviewTimesheet,
  deleteTimesheet,
} from './timesheets.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listTimesheets);
router.post('/', requirePermission('timesheets.log'), logTimesheet);
router.put('/:id/review', requirePermission('timesheets.approve'), reviewTimesheet);
router.delete('/:id', deleteTimesheet);

export default router;
