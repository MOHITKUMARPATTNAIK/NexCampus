import { Router } from 'express';
import {
  requestGatePass,
  getMyGatePasses,
  listPendingGatePasses,
  reviewGatePass,
  verifyPassToken,
  recordGateMovement,
  getOverdueStudents,
  getRecentMovements
} from '../controllers/security.controller.js';
import { authenticate , requireRole } from '../middleware/auth.js';

const router = Router();

// Protect all security endpoints with authentication
router.use(authenticate);

// Student Gate Pass Requests
router.post('/gate-passes/request', requireRole(['student']), requestGatePass);
router.get('/gate-passes/my-passes', requireRole(['student']), getMyGatePasses);

// Approver Decision Workflow (Warden, Faculty, Admin)
router.get('/gate-passes/pending', requireRole(['super_admin', 'delegated_admin', 'faculty', 'hostel_warden']), listPendingGatePasses);
router.patch('/gate-passes/:passId/review', requireRole(['super_admin', 'delegated_admin', 'faculty', 'hostel_warden']), reviewGatePass);

// Security Guard Checkpoint Operations
router.post('/verification/verify-token', requireRole(['super_admin', 'security_guard', 'delegated_admin']), verifyPassToken);
router.post('/verification/record-movement', requireRole(['super_admin', 'security_guard', 'delegated_admin']), recordGateMovement);

// Overdue & Movements Monitoring
router.get('/overdue-students', requireRole(['super_admin', 'security_guard', 'delegated_admin', 'hostel_warden']), getOverdueStudents);
router.get('/recent-movements', requireRole(['super_admin', 'security_guard', 'delegated_admin']), getRecentMovements);

export default router;
