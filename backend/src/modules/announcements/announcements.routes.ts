import { Router } from 'express';
import { listAnnouncements, createAnnouncement, deleteAnnouncement } from './announcements.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listAnnouncements);
router.post('/', requirePermission('announcements.manage'), createAnnouncement);
router.delete('/:id', requirePermission('announcements.manage'), deleteAnnouncement);

export default router;
