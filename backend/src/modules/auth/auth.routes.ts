import { Router } from 'express';
import {
  login,
  googleLogin,
  registerFirstAdmin,
  refreshToken,
  logout,
  getMe,
  changePassword,
  getSessions,
  revokeSession,
  getLoginHistory,
} from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Public auth endpoints
router.post('/register-first-admin', registerFirstAdmin);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/google-login', googleLogin);
router.post('/refresh', refreshToken);

// Authenticated auth endpoints
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:id', authenticate, revokeSession);
router.get('/login-history', authenticate, getLoginHistory);

export default router;
