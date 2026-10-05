import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  getPendingApprovals,
  processApprovalDecision,
  cancelApprovalRequest,
  getApprovalHistory,
} from './approvals.controller';

const router = Router();

router.use(authenticate);

router.get('/pending', getPendingApprovals);
router.get('/history/:id', getApprovalHistory);
router.post('/:id/decision', processApprovalDecision);
router.post('/:id/cancel', cancelApprovalRequest);

export default router;
