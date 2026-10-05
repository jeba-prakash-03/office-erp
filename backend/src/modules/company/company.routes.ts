import { Router } from 'express';
import { getCompanySettings, updateCompanySettings } from './company.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', getCompanySettings);
router.put('/', requirePermission('settings.manage'), updateCompanySettings);
router.get('/company', getCompanySettings);
router.put('/company', requirePermission('settings.manage'), updateCompanySettings);

export default router;
