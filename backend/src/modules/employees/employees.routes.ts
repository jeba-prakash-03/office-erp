import { Router } from 'express';
import {
  listEmployees,
  getEmployeeStats,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  addEmployeeDocument,
  deleteEmployeeDocument,
} from './employees.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { upload } from '../../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/stats/summary', requirePermission('employees.view'), getEmployeeStats);
router.get('/', requirePermission('employees.view'), listEmployees);
router.get('/:id', requirePermission('employees.view'), getEmployeeById);
router.post('/', requirePermission('employees.create'), createEmployee);
router.put('/:id', requirePermission('employees.edit'), updateEmployee);
router.delete('/:id', requirePermission('employees.delete'), deleteEmployee);

router.post('/:id/documents', requirePermission('employees.edit'), upload.single('file'), addEmployeeDocument);
router.delete('/:id/documents/:docId', requirePermission('employees.edit'), deleteEmployeeDocument);

export default router;
