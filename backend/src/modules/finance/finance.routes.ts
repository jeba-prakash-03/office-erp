import { Router } from 'express';
import {
  listIncomes,
  createIncome,
  listExpenseCategories,
  createExpenseCategory,
  listExpenses,
  createExpense,
  deleteExpense,
  getFinancialSummary,
} from './finance.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { upload } from '../../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/incomes', requirePermission('finance.view'), listIncomes);
router.post('/incomes', requirePermission('finance.create'), createIncome);

router.get('/expense-categories', listExpenseCategories);
router.post('/expense-categories', requirePermission('finance.create'), createExpenseCategory);

router.get('/expenses', requirePermission('finance.view'), listExpenses);
router.post('/expenses', requirePermission('finance.create'), upload.single('receipt'), createExpense);
router.delete('/expenses/:id', requirePermission('finance.delete'), deleteExpense);

router.get('/summary', requirePermission('finance.view'), getFinancialSummary);

export default router;
