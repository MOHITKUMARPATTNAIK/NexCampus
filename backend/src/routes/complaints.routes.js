import { Router } from 'express';
import { authenticate, requireRole, requireCMO } from '../middleware/auth.js';
import {
  submitComplaint,
  getMyComplaints,
  listAllComplaints,
  getComplaintDetail,
  assignComplaint,
  updateComplaintStatus,
  addComplaintUpdate,
  escalateComplaint,
  reopenComplaint,
  listComplaintCategories,
  getComplaintStats,
} from '../controllers/complaints.controller.js';

const router = Router();

router.use(authenticate);

// ── Public (any authenticated user) ─────────────────────────────────────────
router.get('/categories', listComplaintCategories);

// ── Student ──────────────────────────────────────────────────────────────────
router.post('/',                requireRole(['student']), submitComplaint);
router.get('/my-complaints',    requireRole(['student']), getMyComplaints);

// ── CMO / Admin ───────────────────────────────────────────────────────────────
// Note: requireCMO allows super_admin, delegated_admin, AND users with CMO flag
router.get('/stats',            requireCMO,  getComplaintStats);
router.get('/',                 requireCMO,  listAllComplaints);
router.patch('/:id/assign',     requireCMO,  assignComplaint);
router.patch('/:id/status',     requireCMO,  updateComplaintStatus);
router.post('/:id/update',      requireCMO,  addComplaintUpdate);
router.post('/:id/escalate',    requireCMO,  escalateComplaint);
router.post('/:id/reopen',      requireCMO,  reopenComplaint);

// ── Detail (student can see own, CMO can see all — enforced in controller) ───
router.get('/:id',              authenticate, getComplaintDetail);

export default router;
