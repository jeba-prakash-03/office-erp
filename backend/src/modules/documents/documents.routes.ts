import { Router } from 'express';
import { listDocuments, uploadDocument, deleteDocument } from './documents.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { upload } from '../../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', listDocuments);
router.post('/', requirePermission('documents.manage'), upload.single('file'), uploadDocument);
router.delete('/:id', requirePermission('documents.manage'), deleteDocument);

export default router;
