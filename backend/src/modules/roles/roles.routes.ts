import { Router } from 'express';
import { listRoles, getRolePermissions, listAllPermissions, updateRolePermissions, createRole } from './roles.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('roles.manage'), listRoles);
router.get('/permissions', requirePermission('roles.manage'), listAllPermissions);
router.get('/:id/permissions', requirePermission('roles.manage'), getRolePermissions);
router.put('/:id/permissions', requirePermission('roles.manage'), updateRolePermissions);
router.post('/', requirePermission('roles.manage'), createRole);

export default router;
