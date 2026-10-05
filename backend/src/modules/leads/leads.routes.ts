import { Router } from 'express';
import { listLeads, createLead, updateLead, convertLeadToClient, deleteLead } from './leads.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listLeads);
router.post('/', requirePermission('leads.manage'), createLead);
router.put('/:id', requirePermission('leads.manage'), updateLead);
router.post('/:id/convert', requirePermission('leads.manage'), convertLeadToClient);
router.delete('/:id', requirePermission('leads.manage'), deleteLead);

export default router;
