import { Router } from 'express';
import { listClients, getClientById, createClient, updateClient, deleteClient } from './clients.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listClients);
router.get('/:id', getClientById);
router.post('/', requirePermission('clients.create'), createClient);
router.put('/:id', requirePermission('clients.edit'), updateClient);
router.delete('/:id', requirePermission('clients.delete'), deleteClient);

export default router;
