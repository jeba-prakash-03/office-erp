import { Router } from 'express';
import { listMeetings, createMeeting, deleteMeeting } from './meetings.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listMeetings);
router.post('/', requirePermission('meetings.manage'), createMeeting);
router.delete('/:id', requirePermission('meetings.manage'), deleteMeeting);

export default router;
