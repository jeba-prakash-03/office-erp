import { Router } from 'express';
import { listUsers, getUserById, createUser, updateUser, deleteUser } from './users.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('users.view'), listUsers);
router.get('/:id', requirePermission('users.view'), getUserById);
router.post('/', requirePermission('users.manage'), createUser);
router.put('/:id', requirePermission('users.manage'), updateUser);
router.delete('/:id', requirePermission('users.manage'), deleteUser);

export default router;
