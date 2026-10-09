import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';

// Admin Module Pages
import DelegatedAdmins from '../pages/admin/DelegatedAdmins';
import CMOAppointment from '../pages/admin/CMOAppointment';
import StaffLifecycle from '../pages/admin/StaffLifecycle';
import StudentDirectory from '../pages/admin/StudentDirectory';
import FacultyDirectory from '../pages/admin/FacultyDirectory';
import AuditLogsView from '../pages/admin/AuditLogsView';

// Academic Module Pages
import MarkAttendance from '../pages/academic/MarkAttendance';
import TimetableScheduler from '../pages/academic/TimetableScheduler';
import LeaveApprovals from '../pages/academic/LeaveApprovals';

// Student Module Pages
import StudentAttendance from '../pages/student/StudentAttendance';
import StudentLeaves from '../pages/student/StudentLeaves';
import StudentGatePass from '../pages/student/StudentGatePass';

// Security Module Pages
import GuardQRScanner from '../pages/security/GuardQRScanner';
import GateMovements from '../pages/security/GateMovements';
import OverdueMonitor from '../pages/security/OverdueMonitor';

// Gate Pass Approvals (Academic/Admin)
import GatePassApprovals from '../pages/academic/GatePassApprovals';

// Fee Module Pages
import StudentFees from '../pages/student/StudentFees';
import FeeManagement from '../pages/admin/FeeManagement';

// Complaint & CMO Pages
import StudentComplaints from '../pages/student/StudentComplaints';
import CMODashboard from '../pages/cmo/CMODashboard';

// Communications, Resources & Student Portfolio
import CampusNotices from '../pages/CampusNotices';
import DocumentsPage from '../pages/DocumentsPage';
import NotificationsPage from '../pages/NotificationsPage';
import StudentPortfolio from '../pages/student/StudentPortfolio';

// Dedicated Course System Pages
import CoursesPage from '../pages/CoursesPage';
import CourseDetailsPage from '../pages/CourseDetailsPage';
import MyLearningPage from '../pages/student/MyLearningPage';
import CourseManagement from '../pages/admin/CourseManagement';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Layout Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CourseDetailsPage />} />

        {/* Administration Routes */}
        <Route
          path="admin/administrators"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin']}>
              <DelegatedAdmins />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/cmo-appointment"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin']}>
              <CMOAppointment />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/staff"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin']}>
              <StaffLifecycle />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/students"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'faculty']}>
              <StudentDirectory />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/faculty"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'faculty']}>
              <FacultyDirectory />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin']}>
              <AuditLogsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/courses"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'course_manager', 'admin']}>
              <CourseManagement />
            </ProtectedRoute>
          }
        />

        {/* Academic Routes */}
        <Route
          path="academic/attendance"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'faculty']}>
              <MarkAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="academic/timetables"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'faculty']}>
              <TimetableScheduler />
            </ProtectedRoute>
          }
        />
        <Route
          path="academic/leaves"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'faculty']}>
              <LeaveApprovals />
            </ProtectedRoute>
          }
        />

        {/* Student Portal Routes */}
        <Route
          path="student/attendance"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/leaves"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentLeaves />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/gatepass"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentGatePass />
            </ProtectedRoute>
          }
        />
        {/* Placeholders for upcoming phases */}
        <Route
          path="student/fees"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentFees />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/complaints"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentComplaints />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/portfolio"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentPortfolio />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/my-learning"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <MyLearningPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Fee Management */}
        <Route
          path="admin/fees"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin']}>
              <FeeManagement />
            </ProtectedRoute>
          }
        />

        {/* CMO Dashboard */}
        <Route
          path="cmo/dashboard"
          element={
            <ProtectedRoute requireCMO>
              <CMODashboard />
            </ProtectedRoute>
          }
        />
        <Route path="cmo/*" element={<CMODashboard />} />

        {/* Gate Pass Approvals (warden / admin / faculty) */}
        <Route
          path="academic/gatepasses"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'faculty', 'staff']}>
              <GatePassApprovals />
            </ProtectedRoute>
          }
        />

        {/* Security Module Routes */}
        <Route
          path="security/scanner"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'security_guard', 'staff']}>
              <GuardQRScanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="security/movements"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'security_guard', 'staff']}>
              <GateMovements />
            </ProtectedRoute>
          }
        />
        <Route
          path="security/overdue"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'delegated_admin', 'security_guard', 'staff', 'hostel_warden']}>
              <OverdueMonitor />
            </ProtectedRoute>
          }
        />

        {/* Communications & Resources — Phase 7 */}
        <Route path="notices" element={<CampusNotices />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
