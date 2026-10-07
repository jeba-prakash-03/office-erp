import { Router } from 'express';
import {
  getMonthlyAttendanceSheet,
  saveMonthlyAttendanceSheet,
  finalizeMonthlyAttendance,
  reopenMonthlyAttendance,
  exportAttendanceGrid,
  getMyAttendance,
} from './attendance.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

// Employee Self-Service
router.get('/my', getMyAttendance);
router.get('/me', getMyAttendance);

// Admin / Super Admin Monthly Spreadsheet Grid Operations
router.get('/sheet', requirePermission('attendance.view'), getMonthlyAttendanceSheet);
router.get('/', requirePermission('attendance.view'), getMonthlyAttendanceSheet);
router.post('/sheet', requirePermission('attendance.manage'), saveMonthlyAttendanceSheet);
router.post('/save', requirePermission('attendance.manage'), saveMonthlyAttendanceSheet);

// Lock & Finalize / Reopen Workflows
router.post('/finalize', requirePermission('attendance.lock'), finalizeMonthlyAttendance);
router.post('/reopen', requireRole(['super_admin', 'admin']), reopenMonthlyAttendance);

// Export Grid as CSV/Excel
router.get('/export', requirePermission('attendance.view'), exportAttendanceGrid);

export default router;
