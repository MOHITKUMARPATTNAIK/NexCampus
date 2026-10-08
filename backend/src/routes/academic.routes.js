import { Router } from 'express';
import {
  createSubject,
  listSubjects,
  createClass,
  listClasses,
  enrollStudents,
  getClassStudents,
  createTimetableEntry,
  getTimetable,
  submitAttendance,
  modifyAttendanceRecord,
  getStudentAttendanceSummary,
  applyLeave,
  getMyLeaves,
  cancelLeave,
  listPendingLeaves,
  reviewLeave
} from '../controllers/academic.controller.js';
import { authenticate , requireRole } from '../middleware/auth.js';

const router = Router();

// Protect all academic routes with auth
router.use(authenticate);

// Subjects & Classes
router.post('/subjects', requireRole(['super_admin', 'delegated_admin', 'faculty']), createSubject);
router.get('/subjects', listSubjects);

router.post('/classes', requireRole(['super_admin', 'delegated_admin', 'faculty']), createClass);
router.get('/classes', listClasses);
router.post('/classes/:classId/enroll', requireRole(['super_admin', 'delegated_admin', 'faculty']), enrollStudents);
router.get('/classes/:classId/students', getClassStudents);

// Timetables (With Conflict Detection)
router.post('/timetables', requireRole(['super_admin', 'delegated_admin', 'faculty']), createTimetableEntry);
router.get('/timetables', getTimetable);

// Attendance Management
router.post('/attendance/submit', requireRole(['super_admin', 'faculty', 'delegated_admin']), submitAttendance);
router.patch('/attendance/records/:recordId', requireRole(['super_admin', 'faculty']), modifyAttendanceRecord);
router.get('/attendance/student-summary/:studentId?', getStudentAttendanceSummary);

// Leave Requests
router.post('/leaves/apply', requireRole(['student']), applyLeave);
router.get('/leaves/my-leaves', requireRole(['student']), getMyLeaves);
router.delete('/leaves/:leaveId/cancel', requireRole(['student']), cancelLeave);
router.get('/leaves/pending', requireRole(['super_admin', 'delegated_admin', 'faculty']), listPendingLeaves);
router.patch('/leaves/:leaveId/review', requireRole(['super_admin', 'delegated_admin', 'faculty']), reviewLeave);

export default router;
