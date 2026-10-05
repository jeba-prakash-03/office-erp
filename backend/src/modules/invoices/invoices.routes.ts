import { Router } from 'express';
import {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
} from './invoices.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listInvoices);
router.get('/:id', getInvoiceById);
router.post('/', requirePermission('invoices.manage'), createInvoice);
router.put('/:id/status', requirePermission('invoices.manage'), updateInvoiceStatus);
router.delete('/:id', requirePermission('invoices.manage'), deleteInvoice);

export default router;
