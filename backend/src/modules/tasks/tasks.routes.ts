import { Router } from 'express';
import {
  listTasks,
  getKanbanTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  addTaskComment,
  addTaskAttachment,
  toggleChecklistItem,
  addChecklistItem,
} from './tasks.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { upload } from '../../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', listTasks);
router.get('/kanban', getKanbanTasks);
router.get('/:id', getTaskById);
router.post('/', requirePermission('tasks.manage'), createTask);
router.put('/:id', requireAnyPermission('tasks.manage', 'tasks.update_status'), updateTask);
router.delete('/:id', requirePermission('tasks.manage'), deleteTask);

router.post('/:id/comments', addTaskComment);
router.post('/:id/attachments', upload.single('file'), addTaskAttachment);
router.post('/:id/checklists', addChecklistItem);
router.put('/checklists/:checklistId/toggle', toggleChecklistItem);

export default router;
