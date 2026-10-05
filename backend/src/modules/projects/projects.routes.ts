import { Router } from 'express';
import { listProjects, getProjectById, createProject, updateProject, deleteProject } from './projects.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listProjects);
router.get('/:id', getProjectById);
router.post('/', requirePermission('projects.create'), createProject);
router.put('/:id', requirePermission('projects.edit'), updateProject);
router.delete('/:id', requirePermission('projects.delete'), deleteProject);

export default router;
