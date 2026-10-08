import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Layers,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  Archive,
  ArrowUpRight,
  BookOpen,
  DollarSign,
  Users,
  Clock,
  X,
  RefreshCw,
  Sliders,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';

export const CourseManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Courses data
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Curriculum modules modal
  const [moduleModalCourse, setModuleModalCourse] = useState(null);
  const [modulesList, setModulesList] = useState([]);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDuration, setNewModuleDuration] = useState('2 Weeks');
  const [newModuleDesc, setNewModuleDesc] = useState('');
  const [isSavingModule, setIsSavingModule] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    short_description: '',
    description: '',
    category: 'Engineering',
    course_type: 'Degree',
    duration: '1 Semester',
    eligibility: 'All Enrolled Students',
    prerequisites: '',
    learning_objectives: '',
    instructor_name: 'Academic Faculty',
    price: 2999,
    currency: 'INR',
    is_payable: true,
    max_seats: 120,
    status: 'PUBLISHED'
  });

  const fetchCoursesAndStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [coursesRes, statsRes] = await Promise.all([
        api.get('/courses'),
        api.get('/courses/stats')
      ]);

      if (coursesRes.data.success) {
        setCourses(coursesRes.data.courses || []);
      }
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
    } catch (err) {
      console.error('[CourseManagement] Error loading data:', err);
      setError(err.response?.data?.message || 'Failed to load course management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoursesAndStats();
  }, []);

  // Filtered courses
  const filteredCourses = courses.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.instructor_name && c.instructor_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingCourse(null);
    setFormError(null);
    setFormData({
      name: '',
      code: '',
      short_description: '',
      description: '',
      category: 'Engineering',
      course_type: 'Degree',
      duration: '1 Semester (6 Months)',
      eligibility: 'Undergraduate & Postgraduate Students',
      prerequisites: 'High School Mathematics / Computing Basics',
      learning_objectives: 'Comprehensive mastery of core principles and practical lab implementations.',
      instructor_name: 'Faculty of Engineering',
      price: 2999,
      currency: 'INR',
      is_payable: true,
      max_seats: 120,
      status: 'PUBLISHED'
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (course) => {
    setEditingCourse(course);
    setFormError(null);
    setFormData({
      name: course.name || '',
      code: course.code || '',
      short_description: course.short_description || '',
      description: course.description || '',
      category: course.category || 'Engineering',
      course_type: course.course_type || 'Degree',
      duration: course.duration || '1 Semester',
      eligibility: course.eligibility || 'All Enrolled Students',
      prerequisites: course.prerequisites || '',
      learning_objectives: course.learning_objectives || '',
      instructor_name: course.instructor_name || 'Academic Faculty',
      price: course.price !== undefined ? parseFloat(course.price) : 2999,
      currency: course.currency || 'INR',
      is_payable: course.is_payable !== undefined ? Boolean(course.is_payable) : true,
      max_seats: course.max_seats || 120,
      status: course.status || 'PUBLISHED'
    });
    setIsFormModalOpen(true);
  };

  // Handle Form Submit
  const handleFormSubmit = async (saveStatus) => {
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Course Name and Course Code are required fields.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      ...formData,
      status: saveStatus || formData.status,
      price: parseFloat(formData.price || 0)
    };

    try {
      if (editingCourse) {
        await api.put(`/courses/${editingCourse.id}`, payload);
      } else {
        await api.post('/courses', payload);
      }
      setIsFormModalOpen(false);
      await fetchCoursesAndStats();
    } catch (err) {
      console.error('[CourseManagement] Submit failed:', err);
      setFormError(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Action Handler: Publish / Unpublish / Archive
  const handleStatusChange = async (courseId, action) => {
    try {
      await api.patch(`/courses/${courseId}/${action}`);
      await fetchCoursesAndStats();
    } catch (err) {
      alert(`Action '${action}' failed: ` + (err.response?.data?.message || err.message));
    }
  };

  // Safe Delete Handler
  const handleDeleteCourse = async (course) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete course "${course.name}" (${course.code})?`
    );
    if (!confirmDelete) return;

    try {
      const res = await api.delete(`/courses/${course.id}`);
      if (res.data.success) {
        alert(res.data.message);
        await fetchCoursesAndStats();
      }
    } catch (err) {
      if (err.response?.data?.canArchive) {
        const shouldArchive = window.confirm(
          `${err.response.data.message}\n\nWould you like to ARCHIVE this course instead to preserve academic and audit records?`
        );
        if (shouldArchive) {
          handleStatusChange(course.id, 'archive');
        }
      } else {
        alert('Delete failed: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  // Open Modules Manager Modal
  const handleOpenModules = async (course) => {
    setModuleModalCourse(course);
    setNewModuleTitle('');
    setNewModuleDesc('');
    try {
      const res = await api.get(`/courses/${course.id}/modules`);
      if (res.data.success) {
        setModulesList(res.data.modules || []);
      }
    } catch (err) {
      console.error('Error fetching modules:', err);
    }
  };

  // Add Module
  const handleAddModule = async () => {
    if (!newModuleTitle.trim() || !moduleModalCourse) return;
    setIsSavingModule(true);
    try {
      const res = await api.post(`/courses/${moduleModalCourse.id}/modules`, {
        title: newModuleTitle.trim(),
        duration: newModuleDuration,
        description: newModuleDesc.trim()
      });
      if (res.data.success) {
        setNewModuleTitle('');
        setNewModuleDesc('');
        const modRes = await api.get(`/courses/${moduleModalCourse.id}/modules`);
        setModulesList(modRes.data.modules || []);
      }
    } catch (err) {
      alert('Failed to add module: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSavingModule(false);
    }
  };

  // Delete Module
  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Delete this curriculum module?')) return;
    try {
      await api.delete(`/courses/${moduleModalCourse.id}/modules/${moduleId}`);
      setModulesList(prev => prev.filter(m => m.id !== moduleId));
    } catch (err) {
      alert('Failed to delete module: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HEADER                                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Authority Academic Command</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Course Management & Curricula
          </h1>
          <p className="text-xs text-slate-500">
            Create, publish, edit, and archive university academic programs with safe financial preservation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchCoursesAndStats}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Course</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. STATS OVERVIEW CARDS                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Courses</span>
            <span className="text-xl font-black text-slate-900">{stats.total_courses}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Published</span>
            <span className="text-xl font-black text-emerald-700">{stats.published_courses}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Draft</span>
            <span className="text-xl font-black text-amber-600">{stats.draft_courses}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Archived</span>
            <span className="text-xl font-black text-slate-600">{stats.archived_courses}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Enrollments</span>
            <span className="text-xl font-black text-indigo-700">{stats.total_enrollments}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Direct Revenue</span>
            <span className="text-xl font-black text-purple-700">₹{stats.total_course_revenue.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. TOOLBAR                                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'PUBLISHED', 'DRAFT', 'UNPUBLISHED', 'ARCHIVED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Statuses' : st}
            </button>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. COURSES TABLE                                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading courses...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No courses found matching filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code / Course</th>
                  <th className="py-3 px-3">Type & Discipline</th>
                  <th className="py-3 px-3">Fee (INR)</th>
                  <th className="py-3 px-3">Seats</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredCourses.map((c) => {
                  const statusColors = {
                    PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
                    UNPUBLISHED: 'bg-slate-100 text-slate-600 border-slate-200',
                    ARCHIVED: 'bg-rose-50 text-rose-700 border-rose-200'
                  };

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      {/* Code / Name */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-indigo-700 font-bold text-[11px]">{c.code}</div>
                        <div className="font-bold text-slate-900 line-clamp-1">{c.name}</div>
                      </td>

                      {/* Discipline */}
                      <td className="py-3 px-3">
                        <div>{c.course_type || 'Degree'}</div>
                        <div className="text-[11px] text-slate-400">{c.department_name || c.category}</div>
                      </td>

                      {/* Fee */}
                      <td className="py-3 px-3 font-bold text-slate-900">
                        ₹{parseFloat(c.price || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Seats */}
                      <td className="py-3 px-3 text-slate-600">
                        <span className="font-bold text-slate-900">{c.enrolled_count || 0}</span> / {c.max_seats || 120}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusColors[c.status] || 'bg-slate-100 text-slate-600'}`}>
                          {c.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* View details in catalog */}
                          <button
                            type="button"
                            onClick={() => navigate(`/courses/${c.id}`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                            title="View Course Page"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Curriculum modules */}
                          <button
                            type="button"
                            onClick={() => handleOpenModules(c)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Manage Modules"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Edit Course"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Publish / Unpublish Toggle */}
                          {c.status === 'PUBLISHED' ? (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(c.id, 'unpublish')}
                              className="px-2 py-1 rounded-md text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition cursor-pointer"
                              title="Unpublish (Hide from new students)"
                            >
                              Unpublish
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(c.id, 'publish')}
                              className="px-2 py-1 rounded-md text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer"
                              title="Publish (Make visible to students)"
                            >
                              Publish
                            </button>
                          )}

                          {/* Archive */}
                          {c.status !== 'ARCHIVED' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(c.id, 'archive')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                              title="Archive Course"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCourse(c)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. ADD / EDIT COURSE MODAL                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingCourse ? 'Edit Academic Course' : 'Create New Academic Course'}
                </h3>
                <p className="text-xs text-slate-500">Configure curriculum details, academic duration, and direct fees</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Financial integrity reminder */}
            {editingCourse && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Financial Safety Guarantee: Updating the course fee will only apply to future enrollments. Existing student payment and receipt records remain immutable.</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Row 1: Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">Course Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Advanced Artificial Intelligence & Robotics"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Course Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. AI-ROBOT-2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs uppercase outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 2: Short Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Short Summary</label>
                <input
                  type="text"
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  placeholder="One sentence description for catalog cards"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Row 3: Full Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Full Description & Syllabus</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed course scope, methodologies, lab work..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Row 4: Discipline, Type, Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Category / Discipline</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Management">Management</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Sciences">Sciences</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Course Type</label>
                  <select
                    value={formData.course_type}
                    onChange={(e) => setFormData({ ...formData, course_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                  >
                    <option value="Degree">Degree</option>
                    <option value="Specialization">Specialization</option>
                    <option value="Certificate">Certificate</option>
                    <option value="Diploma">Diploma</option>
                    <option value="Elective">Elective</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Duration</label>
                  <input
                    type="text"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="e.g. 6 Months / 1 Semester"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                  />
                </div>
              </div>

              {/* Row 5: Financials & Seats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Course Fee (₹ INR) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-xs outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Max Seat Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_seats}
                    onChange={(e) => setFormData({ ...formData, max_seats: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Instructor / Faculty</label>
                  <input
                    type="text"
                    value={formData.instructor_name}
                    onChange={(e) => setFormData({ ...formData, instructor_name: e.target.value })}
                    placeholder="e.g. Prof. R. Sharma"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                  />
                </div>
              </div>

              {/* Row 6: Prerequisites & Learning Objectives */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Prerequisites</label>
                  <input
                    type="text"
                    value={formData.prerequisites}
                    onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
                    placeholder="e.g. Basic Python / Data Structures"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Eligibility</label>
                  <input
                    type="text"
                    value={formData.eligibility}
                    onChange={(e) => setFormData({ ...formData, eligibility: e.target.value })}
                    placeholder="e.g. Undergraduate & Postgraduate"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleFormSubmit('DRAFT')}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleFormSubmit('PUBLISHED')}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : (editingCourse ? 'Save & Update' : 'Publish Course')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. CURRICULUM MODULES MODAL                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {moduleModalCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Curriculum Modules</h3>
                <p className="text-xs text-slate-500">{moduleModalCourse.name} ({moduleModalCourse.code})</p>
              </div>
              <button
                type="button"
                onClick={() => setModuleModalCourse(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Modules List */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
                Configured Modules ({modulesList.length})
              </span>

              {modulesList.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                  No modules defined yet. Add the first module below.
                </div>
              ) : (
                modulesList.map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {idx + 1}. {m.title}
                      </div>
                      <div className="text-[11px] text-slate-500">Duration: {m.duration}</div>
                      {m.description && <div className="text-[11px] text-slate-600 mt-1">{m.description}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteModule(m.id)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition"
                      title="Delete module"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add New Module Form */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3 text-xs">
              <span className="font-bold text-indigo-950 block text-[11px] uppercase tracking-wider">
                + Add New Curriculum Module
              </span>

              <input
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Module Title (e.g. Module 4: Cloud Infrastructure & CI/CD)"
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs outline-hidden"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newModuleDuration}
                  onChange={(e) => setNewModuleDuration(e.target.value)}
                  placeholder="Duration (e.g. 2 Weeks)"
                  className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddModule}
                  disabled={isSavingModule || !newModuleTitle.trim()}
                  className="py-2 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {isSavingModule ? 'Adding...' : 'Add Module'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModuleModalCourse(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseManagement;
