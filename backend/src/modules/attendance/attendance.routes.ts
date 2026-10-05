import { Router } from 'express';
import {
  clockIn,
  clockOut,
  getMyTodayStatus,
  getMyAttendanceHistory,
  getAttendanceOverview,
  listAttendance,
  adminManualCorrection,
  requestCorrection,
  listCorrections,
  reviewCorrection,
} from './attendance.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

// Employee Self-Service Endpoints
router.get('/me', getMyTodayStatus);
router.get('/today', getMyTodayStatus);
router.get('/status', getMyTodayStatus);
router.get('/my-history', getMyAttendanceHistory);

router.post('/clock-in', clockIn);
router.post('/check-in', clockIn);
router.post('/punch-in', clockIn);

router.post('/clock-out', clockOut);
router.post('/check-out', clockOut);
router.post('/punch-out', clockOut);

// Admin / HR Management Endpoints
router.get('/overview', getAttendanceOverview);
router.get('/', listAttendance);
router.post('/admin-correction', requirePermission('attendance.manage'), adminManualCorrection);

// Correction Workflow Endpoints
router.post('/correction', requestCorrection);
router.post('/corrections', requestCorrection);
router.get('/corrections', listCorrections);
router.put('/corrections/:id/review', requirePermission('attendance.approve'), reviewCorrection);
router.put('/corrections/:id/approve', requirePermission('attendance.approve'), (req, res, next) => {
  req.body.status = 'approved';
  return reviewCorrection(req, res, next);
});
router.put('/corrections/:id/reject', requirePermission('attendance.approve'), (req, res, next) => {
  req.body.status = 'rejected';
  return reviewCorrection(req, res, next);
});
router.put('/corrections/:id', requirePermission('attendance.approve'), reviewCorrection);

export default router;

