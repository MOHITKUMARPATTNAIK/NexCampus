import { Router } from 'express';
import { login, registerStudent, getMe, changePassword, updateLanguagePreference } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/register-student', registerStudent);

// Protected routes
router.get('/me', authenticate , getMe);
router.post('/change-password', authenticate, changePassword);
router.patch('/language', authenticate, updateLanguagePreference);

export default router;
