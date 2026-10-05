import { Router } from 'express';
import { searchGlobal } from './search.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', searchGlobal);

export default router;
