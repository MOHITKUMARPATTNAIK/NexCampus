import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  publishNotice, listNotices, listAllNoticesAdmin, getNotice, updateNotice, archiveNotice,
  getMyNotifications, markNotificationsRead, sendNotification,
  createDocument, listDocuments, deleteDocument,
  getMyPortfolio, updateStudentProfile,
  getMyAchievements, createAchievement, updateAchievement, deleteAchievement,
} from '../controllers/communications.controller.js';

const router = Router();
router.use(authenticate);

// ── Notices ───────────────────────────────────────────────────────────────────
router.get('/notices',               listNotices);                          // All users
router.get('/notices/admin/all',     requireRole(['super_admin','delegated_admin','faculty']), listAllNoticesAdmin);
router.post('/notices',              requireRole(['super_admin','delegated_admin','faculty']), publishNotice);
router.get('/notices/:id',           getNotice);
router.patch('/notices/:id',         requireRole(['super_admin','delegated_admin','faculty']), updateNotice);
router.delete('/notices/:id',        requireRole(['super_admin','delegated_admin']), archiveNotice);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications/my',      getMyNotifications);
router.patch('/notifications/mark-read', markNotificationsRead);
router.post('/notifications/send',   requireRole(['super_admin','delegated_admin']), sendNotification);

// ── Documents ─────────────────────────────────────────────────────────────────
router.get('/documents',             listDocuments);
router.post('/documents',            requireRole(['super_admin','delegated_admin','faculty']), createDocument);
router.delete('/documents/:id',      deleteDocument);

// ── Portfolio & Profile ───────────────────────────────────────────────────────
router.get('/portfolio/my',          requireRole(['student']), getMyPortfolio);
router.patch('/portfolio/profile',   requireRole(['student']), updateStudentProfile);

// ── Achievements & Certificates ───────────────────────────────────────────────
router.get('/portfolio/achievements',        requireRole(['student']), getMyAchievements);
router.post('/portfolio/achievements',       requireRole(['student']), createAchievement);
router.patch('/portfolio/achievements/:id',  requireRole(['student']), updateAchievement);
router.delete('/portfolio/achievements/:id', requireRole(['student']), deleteAchievement);

export default router;
