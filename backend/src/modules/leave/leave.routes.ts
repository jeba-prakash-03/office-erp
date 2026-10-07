import { Router } from 'express';
import {
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  getLeaveBalances,
  applyLeave,
  listLeaveRequests,
  reviewLeaveRequest,
  cancelLeaveRequest,
  listHolidays,
  createHoliday,
  deleteHoliday,
} from './leave.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

// Leave Types (Configurable)
router.get('/types', listLeaveTypes);
router.post('/types', requirePermission('leave.manage'), createLeaveType);
router.put('/types/:id', requirePermission('leave.manage'), updateLeaveType);
router.delete('/types/:id', requirePermission('leave.manage'), deleteLeaveType);

// Balances
router.get('/balances', getLeaveBalances);

// Applications / Requests
router.get('/requests', listLeaveRequests);
router.get('/applications', listLeaveRequests);
router.post('/apply', requirePermission('leave.apply'), applyLeave);
router.post('/applications', requirePermission('leave.apply'), applyLeave);

// Approval / Rejection
router.put('/requests/:id/review', requirePermission('leave.approve'), reviewLeaveRequest);
router.put('/requests/:id/approve', requirePermission('leave.approve'), (req, res, next) => {
  req.body.status = 'approved';
  return reviewLeaveRequest(req, res, next);
});
router.put('/requests/:id/reject', requirePermission('leave.approve'), (req, res, next) => {
  req.body.status = 'rejected';
  return reviewLeaveRequest(req, res, next);
});

// Cancel
router.post('/requests/:id/cancel', cancelLeaveRequest);
router.put('/requests/:id/cancel', cancelLeaveRequest);

// Holidays
router.get('/holidays', listHolidays);
router.post('/holidays', requireRole(['super_admin', 'admin']), createHoliday);
router.delete('/holidays/:id', requireRole(['super_admin', 'admin']), deleteHoliday);

export default router;
