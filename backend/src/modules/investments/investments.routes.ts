import { Router } from 'express';
import {
  listInvestments,
  getInvestmentById,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from './investments.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();

// Strictly authenticate & require super_admin role for all endpoints
router.use(authenticate);
router.use(requireRole('super_admin'));

router.get('/', listInvestments);
router.post('/', createInvestment);
router.get('/:id', getInvestmentById);
router.put('/:id', updateInvestment);
router.delete('/:id', deleteInvestment);

export default router;
