import { Router } from 'express';
import {
  listLeaveTypes,
  createLeaveType,
  getMyLeaveBalances,
  applyLeave,
  listLeaveRequests,
  reviewLeaveRequest,
} from './leave.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/types', listLeaveTypes);
router.post('/types', requirePermission('leave.manage'), createLeaveType);

router.get('/balances', getMyLeaveBalances);
router.post('/apply', requirePermission('leave.apply'), applyLeave);
router.get('/requests', listLeaveRequests);
router.put('/requests/:id/review', requirePermission('leave.approve'), reviewLeaveRequest);

export default router;
