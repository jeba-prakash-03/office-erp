import { Router } from 'express';
import { getCalendarEvents } from './calendar.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getCalendarEvents);

export default router;
