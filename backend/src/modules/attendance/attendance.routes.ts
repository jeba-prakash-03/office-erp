import { Router } from 'express';
import {
  checkIn,
  checkOut,
  getTodayStatus,
  listAttendance,
  requestCorrection,
  listCorrections,
  reviewCorrection,
} from './attendance.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/today', getTodayStatus);
router.get('/', listAttendance);

router.post('/correction', requestCorrection);
router.get('/corrections', listCorrections);
router.put('/corrections/:id/review', requirePermission('attendance.approve'), reviewCorrection);

export default router;
