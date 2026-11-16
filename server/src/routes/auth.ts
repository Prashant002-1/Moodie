import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { register, login, logout, me, updateProfile, updatePreferences, changePassword, recover, deleteAccount, rateLimitAuth } from '../controllers/authController';

const router = express.Router();
router.post('/register', rateLimitAuth, register);
router.post('/login', rateLimitAuth, login);
router.post('/recover', rateLimitAuth, recover);
router.post('/logout', logout);
router.get('/me', authenticateToken, me);
router.patch('/profile', authenticateToken, updateProfile);
router.patch('/preferences', authenticateToken, updatePreferences);
router.post('/password', authenticateToken, rateLimitAuth, changePassword);
router.delete('/account', authenticateToken, rateLimitAuth, deleteAccount);
export default router;
