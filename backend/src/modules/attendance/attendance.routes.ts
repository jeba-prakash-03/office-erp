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
router.post('/clock-in', checkIn);
router.post('/punch-in', checkIn);

router.post('/check-out', checkOut);
router.post('/clock-out', checkOut);
router.post('/punch-out', checkOut);

router.get('/today', getTodayStatus);
router.get('/status', getTodayStatus);
router.get('/', listAttendance);

router.post('/correction', requestCorrection);
router.post('/corrections', requestCorrection);
router.get('/corrections', listCorrections);
router.put('/corrections/:id/review', requirePermission('attendance.approve'), reviewCorrection);
router.put('/corrections/:id', requirePermission('attendance.approve'), reviewCorrection);

export default router;
