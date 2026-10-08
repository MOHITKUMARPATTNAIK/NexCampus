import { Router } from 'express';
import {
  listCourses,
  getCourseDetails,
  getCourseStats,
  getMyLearning,
  updateLearningProgress,
  createCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
  archiveCourse,
  deleteCourse,
  getCourseModules,
  createCourseModule,
  updateCourseModule,
  deleteCourseModule
} from '../controllers/courses.controller.js';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Authority roles allowed to manage courses
const COURSE_AUTHORITY_ROLES = ['super_admin', 'delegated_admin', 'course_manager', 'admin'];

// ── Course Browsing & Details ──
router.get('/', optionalAuthenticate, listCourses);
router.get('/stats', authenticate, requireRole(COURSE_AUTHORITY_ROLES), getCourseStats);
router.get('/my-learning', authenticate, requireRole(['student']), getMyLearning);
router.patch('/my-learning/:courseId/progress', authenticate, requireRole(['student']), updateLearningProgress);
router.get('/:id', optionalAuthenticate, getCourseDetails);

// ── Authority Management ──
router.post('/', authenticate, requireRole(COURSE_AUTHORITY_ROLES), createCourse);
router.put('/:id', authenticate, requireRole(COURSE_AUTHORITY_ROLES), updateCourse);
router.patch('/:id/publish', authenticate, requireRole(COURSE_AUTHORITY_ROLES), publishCourse);
router.patch('/:id/unpublish', authenticate, requireRole(COURSE_AUTHORITY_ROLES), unpublishCourse);
router.patch('/:id/archive', authenticate, requireRole(COURSE_AUTHORITY_ROLES), archiveCourse);
router.delete('/:id', authenticate, requireRole(COURSE_AUTHORITY_ROLES), deleteCourse);

// ── Curriculum Modules ──
router.get('/:id/modules', optionalAuthenticate, getCourseModules);
router.post('/:id/modules', authenticate, requireRole(COURSE_AUTHORITY_ROLES), createCourseModule);
router.put('/:id/modules/:moduleId', authenticate, requireRole(COURSE_AUTHORITY_ROLES), updateCourseModule);
router.delete('/:id/modules/:moduleId', authenticate, requireRole(COURSE_AUTHORITY_ROLES), deleteCourseModule);

export default router;
