import { Router } from 'express';
import { listDepartments, getDepartmentById, createDepartment, updateDepartment, deleteDepartment } from './departments.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listDepartments);
router.get('/:id', getDepartmentById);
router.post('/', requirePermission('departments.manage'), createDepartment);
router.put('/:id', requirePermission('departments.manage'), updateDepartment);
router.delete('/:id', requirePermission('departments.manage'), deleteDepartment);

export default router;
