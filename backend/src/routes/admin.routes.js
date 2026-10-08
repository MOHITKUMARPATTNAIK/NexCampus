import { Router } from 'express';
import {
  createDelegatedAdmin,
  listDelegatedAdmins,
  updateAccountStatus,
  appointCMO,
  listCMOs,
  createStaff,
  listStaff,
  listStudents,
  createStudent,
  updateStudent,
  resetStudentPassword,
  getStudentFullDetails,
  createFaculty,
  listFaculty,
  getAuditLogs,
  getSystemReferenceData,
  getDashboardMetrics
} from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Protect all admin endpoints with authentication
router.use(authenticate);

// Reference data & Analytics Metrics
router.get('/reference-data', getSystemReferenceData);
router.get('/metrics', getDashboardMetrics);

// Delegated Administrators
router.post('/delegated-admins', requireRole(['super_admin']), createDelegatedAdmin);
router.get('/delegated-admins', requireRole(['super_admin', 'delegated_admin']), listDelegatedAdmins);
router.patch('/users/:userId/status', requireRole(['super_admin', 'delegated_admin']), updateAccountStatus);

// Super Admin Appointment of Complaint Management Officer (Strictly Super Admin)
router.post('/cmo-appointment', requireRole(['super_admin']), appointCMO);
router.get('/cmo-list', requireRole(['super_admin', 'delegated_admin']), listCMOs);

// Operational Staff Lifecycle
router.post('/staff', requireRole(['super_admin', 'delegated_admin']), createStaff);
router.get('/staff', requireRole(['super_admin', 'delegated_admin']), listStaff);

// Student Management (Admin / Student Affairs)
router.get('/students', requireRole(['super_admin', 'delegated_admin', 'faculty']), listStudents);
router.post('/students', requireRole(['super_admin', 'delegated_admin']), createStudent);
router.get('/students/:id/full-details', requireRole(['super_admin', 'delegated_admin']), getStudentFullDetails);
router.patch('/students/:id', requireRole(['super_admin', 'delegated_admin']), updateStudent);
router.post('/students/:id/reset-password', requireRole(['super_admin', 'delegated_admin']), resetStudentPassword);

// Faculty Directory
router.post('/faculty', requireRole(['super_admin', 'delegated_admin']), createFaculty);
router.get('/faculty', requireRole(['super_admin', 'delegated_admin', 'faculty']), listFaculty);

// Audit Logs
router.get('/audit-logs', requireRole(['super_admin', 'delegated_admin']), getAuditLogs);

export default router;
