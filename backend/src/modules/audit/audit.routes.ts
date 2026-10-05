import { Router } from 'express';
import { listAuditLogs } from './audit.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('audit_logs.view'), listAuditLogs);

export default router;
