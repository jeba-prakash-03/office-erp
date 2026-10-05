import { Router } from 'express';
import {
  listAssets,
  createAsset,
  assignAsset,
  returnAsset,
  deleteAsset,
} from './assets.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listAssets);
router.post('/', requirePermission('assets.manage'), createAsset);
router.post('/:id/assign', requirePermission('assets.manage'), assignAsset);
router.post('/:id/return', requirePermission('assets.manage'), returnAsset);
router.delete('/:id', requirePermission('assets.manage'), deleteAsset);

export default router;
