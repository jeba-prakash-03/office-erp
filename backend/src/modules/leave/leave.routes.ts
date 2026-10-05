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
router.get('/applications', listLeaveRequests);
router.post('/applications', requirePermission('leave.apply'), applyLeave);

router.put('/requests/:id/review', requirePermission('leave.approve'), reviewLeaveRequest);
router.put('/requests/:id/approve', requirePermission('leave.approve'), (req, res, next) => {
  req.body.status = 'approved';
  return reviewLeaveRequest(req, res, next);
});
router.put('/requests/:id/reject', requirePermission('leave.approve'), (req, res, next) => {
  req.body.status = 'rejected';
  req.body.remarks = req.body.remarks || req.body.rejection_reason;
  return reviewLeaveRequest(req, res, next);
});
router.put('/requests/:id/status', requirePermission('leave.approve'), reviewLeaveRequest);
router.put('/requests/:id', requirePermission('leave.approve'), reviewLeaveRequest);
router.put('/applications/:id/status', requirePermission('leave.approve'), reviewLeaveRequest);

export default router;
