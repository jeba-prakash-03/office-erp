import { Router } from 'express';
import { login, register, refreshToken, logout, getMe, changePassword, updateProfile } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);
router.put('/profile', authenticate, updateProfile);

export default router;
