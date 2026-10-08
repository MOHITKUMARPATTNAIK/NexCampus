import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  GraduationCap,
  Search,
  Plus,
  Edit2,
  Eye,
  KeyRound,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Phone,
  Home,
  Mail,
  User,
  Calendar,
  CreditCard,
  Award,
  Clock,
  Shield,
  X
} from 'lucide-react';

export const StudentDirectory = () => {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Selected student data
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [fullDetails, setFullDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Create Form State
  const initialFormState = {
    studentId: '',
    fullName: '',
    email: '',
    password: 'Student@NexCampus2026!',
    phone: '',
    departmentId: '',
    courseId: '',
    academicYear: 1,
    currentSemester: 1,
    section: 'A',
    hostelName: '',
    roomNumber: '',
    guardianName: '',
    guardianPhone: '',
    address: '',
    bloodGroup: '',
    dateOfBirth: ''
  };
  const [formData, setFormData] = useState(initialFormState);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Reset Password State
  const [newPassword, setNewPassword] = useState('Student@NexCampus2026!');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (departmentId) params.append('departmentId', departmentId);
      if (statusFilter) params.append('status', statusFilter);

      const [stuRes, refRes] = await Promise.all([
        api.get(`/admin/students?${params.toString()}`),
        api.get('/admin/reference-data')
      ]);

      if (stuRes.data.success) setStudents(stuRes.data.students);
      if (refRes.data.success) {
        setDepartments(refRes.data.data.departments || []);
        setCourses(refRes.data.data.courses || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch student directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search, departmentId, statusFilter]);

  const handleStatusChange = async (userId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change student status to ${newStatus}?`)) {
      return;
    }
    try {
      const res = await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      if (res.data.success) {
        setSuccess(res.data.message);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update student status.');
    }
  };

  // View full details
  const handleViewDetails = async (stu) => {
    setSelectedStudent(stu);
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/admin/students/${stu.id}/full-details`);
      if (res.data.success) {
        setFullDetails(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load full student details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Edit
  const handleOpenEdit = (stu) => {
    setSelectedStudent(stu);
    setFormData({
      studentId: stu.student_id || '',
      fullName: stu.full_name || '',
      email: stu.email || '',
      phone: stu.phone || '',
      departmentId: stu.department_id || '',
      courseId: stu.course_id || '',
      academicYear: stu.academic_year || 1,
      currentSemester: stu.current_semester || 1,
      section: stu.section || 'A',
      hostelName: stu.hostel_name || '',
      roomNumber: stu.room_number || '',
      guardianName: stu.guardian_name || '',
      guardianPhone: stu.guardian_phone || '',
      address: stu.address || '',
      bloodGroup: stu.blood_group || '',
      dateOfBirth: stu.date_of_birth ? stu.date_of_birth.substring(0, 10) : ''
    });
    setEditModalOpen(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError('');
    try {
      const res = await api.post('/admin/students', formData);
      if (res.data.success) {
        setSuccess(`Student account created successfully for ${formData.fullName} (${formData.studentId})`);
        setCreateModalOpen(false);
        setFormData(initialFormState);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create student account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError('');
    try {
      const res = await api.patch(`/admin/students/${selectedStudent.id}`, formData);
      if (res.data.success) {
        setSuccess(`Student account updated successfully for ${formData.fullName}`);
        setEditModalOpen(false);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update student account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/admin/students/${selectedStudent.id}/reset-password`, {
        newPassword
      });
      if (res.data.success) {
        setSuccess(`Password for ${selectedStudent.full_name} has been reset successfully.`);
        setResetModalOpen(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const fmtCur = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <GraduationCap className="w-7 h-7 text-indigo-600" />
            <span>Student Management & Directory</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Provision student credentials, assign academic programs, and monitor institutional records.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData(initialFormState);
            setCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-indigo-600/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Student</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, name, email..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-600"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-600"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-900">✕</button>
        </div>
      )}

      {/* Student List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3.5 px-4">Student Profile</th>
                <th className="py-3.5 px-4">Academic Allocation</th>
                <th className="py-3.5 px-4">Class & Section</th>
                <th className="py-3.5 px-4">Residence & Guardian</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading student records...</span>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No student records match the search criteria.
                  </td>
                </tr>
              ) : (
                students.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{stu.full_name}</div>
                      <div className="text-xs text-indigo-600 font-mono font-bold">{stu.student_id}</div>
                      <div className="text-xs text-slate-500">{stu.email}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{stu.department_name || 'CSE Department'}</div>
                      <div className="text-xs text-slate-500">{stu.course_name || 'B.Tech Program'}</div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-700">
                      <div>Year {stu.academic_year || 1} • Semester {stu.current_semester || 1}</div>
                      <div className="text-slate-500 font-medium">Section {stu.section || 'A'}</div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600">
                      {stu.hostel_name ? (
                        <div className="flex items-center gap-1 text-slate-800 font-medium">
                          <Home className="w-3.5 h-3.5 text-slate-400" />
                          <span>{stu.hostel_name} (Rm {stu.room_number || 'N/A'})</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Day Scholar</span>
                      )}
                      {stu.guardian_name && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Guardian: {stu.guardian_name} ({stu.guardian_phone || 'No phone'})
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize inline-flex items-center gap-1.5 ${
                          stu.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : stu.status === 'suspended'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            stu.status === 'active'
                              ? 'bg-emerald-600'
                              : stu.status === 'suspended'
                              ? 'bg-amber-600'
                              : 'bg-rose-600'
                          }`}
                        />
                        {stu.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetails(stu)}
                          title="View Full Profile & Financials"
                          className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(stu)}
                          title="Edit Student Info"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStudent(stu);
                            setResetModalOpen(true);
                          }}
                          title="Reset Password"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        {stu.status === 'active' ? (
                          <button
                            onClick={() => handleStatusChange(stu.id, 'suspended')}
                            title="Suspend Account"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition text-xs font-semibold"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(stu.id, 'active')}
                            title="Activate Account"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition text-xs font-semibold"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STUDENT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">Create Student Account</h3>
                <p className="text-xs text-slate-500 mt-0.5">Provision institutional credentials and academic allocation.</p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Student Roll Number / ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    placeholder="e.g. STU2026045"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Priya Sharma"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Institutional Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="priya.sharma@nexcampus.edu"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Password *</label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Academic Department</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Enrolled Course / Degree</label>
                  <select
                    value={formData.courseId}
                    onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Select Course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Year & Semester</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={formData.academicYear}
                      onChange={(e) => setFormData({ ...formData, academicYear: parseInt(e.target.value) || 1 })}
                      placeholder="Year"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                    />
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={formData.currentSemester}
                      onChange={(e) => setFormData({ ...formData, currentSemester: parseInt(e.target.value) || 1 })}
                      placeholder="Sem"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="e.g. A"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Student Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  >
                    <option value="">Select...</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hostel Residence (or blank for Day Scholar)</label>
                  <input
                    type="text"
                    value={formData.hostelName}
                    onChange={(e) => setFormData({ ...formData, hostelName: e.target.value })}
                    placeholder="e.g. Aryabhatta Boys Hostel"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Room Number</label>
                  <input
                    type="text"
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    placeholder="e.g. B-204"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guardian Name</label>
                  <input
                    type="text"
                    value={formData.guardianName}
                    onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                    placeholder="Parent / Guardian Name"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guardian Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.guardianPhone}
                    onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                    placeholder="+91 9811122334"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Permanent Address</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Permanent residential address"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {formSubmitting ? 'Creating Account...' : 'Create Student Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">Edit Student Record</h3>
                <p className="text-xs text-slate-500 mt-0.5">Modify information for {selectedStudent?.full_name}</p>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Student Roll Number / ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Academic Department</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Academic Year</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.currentSemester}
                    onChange={(e) => setFormData({ ...formData, currentSemester: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hostel Name</label>
                  <input
                    type="text"
                    value={formData.hostelName}
                    onChange={(e) => setFormData({ ...formData, hostelName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Room Number</label>
                  <input
                    type="text"
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm"
                  >
                    <option value="">Select...</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Permanent Address</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter a temporary password for <strong>{selectedStudent?.full_name}</strong>.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Temporary Password</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {resetSubmitting ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL DETAILS MODAL */}
      {detailsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedStudent?.full_name}</h3>
                <div className="text-xs text-indigo-600 font-mono font-bold mt-0.5">
                  Student ID: {selectedStudent?.student_id} • {selectedStudent?.email}
                </div>
              </div>
              <button onClick={() => setDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailsLoading ? (
              <div className="py-16 text-center text-slate-400">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Loading full institutional profile...</span>
              </div>
            ) : fullDetails ? (
              <div className="space-y-6">
                {/* Academic & Personal Overview */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Academic & Personal Profile</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div><span className="text-slate-400">Program:</span> <strong className="text-slate-800">{fullDetails.student?.course_name || 'B.Tech CSE'}</strong></div>
                    <div><span className="text-slate-400">Department:</span> <strong className="text-slate-800">{fullDetails.student?.department_name || 'CSE'}</strong></div>
                    <div><span className="text-slate-400">Year / Sem:</span> <strong className="text-slate-800">Year {fullDetails.student?.academic_year} (Sem {fullDetails.student?.current_semester})</strong></div>
                    <div><span className="text-slate-400">Section:</span> <strong className="text-slate-800">{fullDetails.student?.section || 'A'}</strong></div>
                    <div><span className="text-slate-400">Blood Group:</span> <strong className="text-slate-800">{fullDetails.student?.blood_group || 'O+'}</strong></div>
                    <div><span className="text-slate-400">Hostel:</span> <strong className="text-slate-800">{fullDetails.student?.hostel_name || 'Day Scholar'}</strong></div>
                  </div>
                </div>

                {/* Financial Summary & Invoices */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span>Fee Invoices & Payments</span>
                  </h4>
                  {(!fullDetails.invoices || fullDetails.invoices.length === 0) ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">No fee invoices recorded.</div>
                  ) : (
                    <div className="space-y-2">
                      {fullDetails.invoices.map((inv) => (
                        <div key={inv.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-900">{inv.category_name} ({inv.invoice_number})</div>
                            <div className="text-slate-500">Due: {new Date(inv.due_date).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900">{fmtCur(inv.amount_due || inv.final_amount)}</div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {inv.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Verified Achievements */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>Student Achievements & Certifications</span>
                  </h4>
                  {(!fullDetails.achievements || fullDetails.achievements.length === 0) ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">No achievements uploaded yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {fullDetails.achievements.map((ach) => (
                        <div key={ach.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-start justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-900">{ach.title}</div>
                            <div className="text-slate-500">{ach.issuing_organization} • {ach.achievement_date ? new Date(ach.achievement_date).toLocaleDateString() : ''}</div>
                            {ach.description && <p className="text-slate-600 mt-1">{ach.description}</p>}
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                            {ach.is_verified ? 'Verified' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDirectory;
