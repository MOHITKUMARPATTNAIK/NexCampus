import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Search,
  Filter,
  GraduationCap,
  Clock,
  Users,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Printer,
  ChevronRight,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export const CoursesPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isStudent = user?.roles?.includes('student');
  const isAuthority = user && (
    user.isSuperAdmin ||
    user.roles?.includes('super_admin') ||
    user.roles?.includes('delegated_admin') ||
    user.roles?.includes('course_manager') ||
    user.roles?.includes('admin')
  );

  // Data state
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedAvailability, setSelectedAvailability] = useState('ALL'); // ALL, available, enrolled, full
  const [priceSort, setPriceSort] = useState('DEFAULT'); // DEFAULT, LOW_HIGH, HIGH_LOW

  // Payment checkout modal state
  const [checkoutCourse, setCheckoutCourse] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  // Receipt modal state
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Load courses
  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/courses');
      if (res.data.success) {
        setCourses(res.data.courses || []);
      }
    } catch (err) {
      console.error('[CoursesPage] Failed to fetch courses:', err);
      setError(err.response?.data?.message || 'Failed to load courses. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Compute unique filter options
  const departments = useMemo(() => {
    const deps = new Set();
    courses.forEach(c => {
      if (c.department_name) deps.add(c.department_name);
      else if (c.category) deps.add(c.category);
    });
    return Array.from(deps);
  }, [courses]);

  const courseTypes = useMemo(() => {
    const types = new Set();
    courses.forEach(c => {
      if (c.course_type) types.add(c.course_type);
    });
    return Array.from(types);
  }, [courses]);

  // Filter & sort logic
  const filteredCourses = useMemo(() => {
    let result = [...courses];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.short_description && c.short_description.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.department_name && c.department_name.toLowerCase().includes(q)) ||
        (c.instructor_name && c.instructor_name.toLowerCase().includes(q))
      );
    }

    // Department filter
    if (selectedDepartment !== 'ALL') {
      result = result.filter(c =>
        c.department_name === selectedDepartment || c.category === selectedDepartment
      );
    }

    // Course type filter
    if (selectedType !== 'ALL') {
      result = result.filter(c => c.course_type === selectedType);
    }

    // Availability filter
    if (selectedAvailability === 'available') {
      result = result.filter(c => !c.is_enrolled && !c.is_full);
    } else if (selectedAvailability === 'enrolled') {
      result = result.filter(c => c.is_enrolled);
    } else if (selectedAvailability === 'full') {
      result = result.filter(c => c.is_full);
    }

    // Price sort
    if (priceSort === 'LOW_HIGH') {
      result.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
    } else if (priceSort === 'HIGH_LOW') {
      result.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
    }

    return result;
  }, [courses, searchQuery, selectedDepartment, selectedType, selectedAvailability, priceSort]);

  const hasActiveFilters = searchQuery !== '' || selectedDepartment !== 'ALL' || selectedType !== 'ALL' || selectedAvailability !== 'ALL' || priceSort !== 'DEFAULT';

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('ALL');
    setSelectedType('ALL');
    setSelectedAvailability('ALL');
    setPriceSort('DEFAULT');
  };

  // Open Direct Payment Modal
  const handleOpenPayment = (course) => {
    if (!user) {
      navigate('/login?redirect=/courses');
      return;
    }
    setCheckoutCourse(course);
    setPaymentResult(null);
    setPaymentError(null);
  };

  // Execute Direct Payment
  const handleExecutePayment = async () => {
    if (!checkoutCourse) return;
    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const res = await api.post('/fees/direct-payment/process', {
        item_type: 'course',
        item_id: checkoutCourse.id,
        amount: parseFloat(checkoutCourse.price || 0),
        payment_method: 'dummy_gateway'
      });

      if (res.data.success) {
        setPaymentResult(res.data);
        await fetchCourses(); // Refresh courses status
      } else {
        setPaymentError(res.data.message || 'Payment execution failed');
      }
    } catch (err) {
      console.error('[CoursesPage] Payment error:', err);
      if (err.response?.status === 409) {
        setPaymentError(err.response?.data?.message || 'You have already paid and enrolled in this course.');
        await fetchCourses();
      } else {
        setPaymentError(err.response?.data?.message || err.message || 'Payment processing failed. Please try again.');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HERO HEADER                                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-indigo-700/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-60 h-60 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{t('courses.catalogBadge', 'University Course Catalog 2026')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              {t('courses.title', 'Academic Courses & Programs')}
            </h1>
            <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed">
              {t('courses.subtitle', 'Explore university degree curricula, technical specializations, and professional electives. Direct student enrollment with instant fee settlement and receipt issuance.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isStudent && (
              <button
                type="button"
                onClick={() => navigate('/student/my-learning')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-900 font-bold text-sm shadow-md hover:bg-indigo-50 transition active:scale-95 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>{t('nav.myLearning', 'My Learning')}</span>
              </button>
            )}
            {isAuthority && (
              <button
                type="button"
                onClick={() => navigate('/admin/courses')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-sm border border-indigo-400/40 shadow-md transition active:scale-95 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>{t('nav.courseManagement', 'Course Management')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SEARCH & FILTER TOOLBAR                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('courses.searchPlaceholder', 'Search by course title, code (e.g. BTECH-CSE), department, instructor, or topic...')}
            className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
              title={t('common.clear', 'Clear')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          {/* Department Filter */}
          <div className="flex-1 min-w-[160px] sm:min-w-[190px]">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {t('courses.departmentFilter', 'Department / Discipline')}
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition outline-hidden cursor-pointer"
            >
              <option value="ALL">{t('courses.allDepartments', 'All Departments')} ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Course Type Filter */}
          <div className="flex-1 min-w-[140px] sm:min-w-[170px]">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {t('courses.typeFilter', 'Course Type')}
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition outline-hidden cursor-pointer"
            >
              <option value="ALL">{t('courses.allTypes', 'All Types')}</option>
              {courseTypes.map((tKey) => (
                <option key={tKey} value={tKey}>{tKey}</option>
              ))}
            </select>
          </div>

          {/* Availability Filter */}
          <div className="flex-1 min-w-[140px] sm:min-w-[170px]">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {t('courses.availabilityFilter', 'Enrollment Status')}
            </label>
            <select
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition outline-hidden cursor-pointer"
            >
              <option value="ALL">{t('courses.allStatuses', 'All Courses')}</option>
              <option value="available">{t('courses.availableOnly', 'Available to Enroll')}</option>
              {isStudent && <option value="enrolled">{t('courses.myEnrolledOnly', 'My Enrolled Courses')}</option>}
              <option value="full">{t('courses.fullOnly', 'Seats Full')}</option>
            </select>
          </div>

          {/* Price Sorting */}
          <div className="flex-1 min-w-[130px] sm:min-w-[150px]">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {t('courses.priceSort', 'Fee Sorting')}
            </label>
            <select
              value={priceSort}
              onChange={(e) => setPriceSort(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition outline-hidden cursor-pointer"
            >
              <option value="DEFAULT">{t('courses.sortDefault', 'Recommended')}</option>
              <option value="LOW_HIGH">{t('courses.sortLowHigh', 'Fee: Low to High')}</option>
              <option value="HIGH_LOW">{t('courses.sortHighLow', 'Fee: High to Low')}</option>
            </select>
          </div>

          {/* Clear Filters Action */}
          {hasActiveFilters && (
            <div className="self-end pb-0.5">
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('courses.resetFilters', 'Reset')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Stats Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-800">{filteredCourses.length}</strong> of{' '}
            <strong className="text-slate-800">{courses.length}</strong> published courses
          </span>
          <button
            type="button"
            onClick={fetchCourses}
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. COURSE CARDS GRID                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Loading university course catalog...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h3 className="text-base font-bold text-rose-900">Failed to load courses</h3>
          <p className="text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={fetchCourses}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
          >
            Try Again
          </button>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-4 shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No matching courses found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            No courses match your current search query or filter selection. Try adjusting or resetting your filters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCourses.map((course) => {
            const price = parseFloat(course.price || 0);
            const isFree = price === 0;
            const maxSeats = course.max_seats || 120;
            const enrolled = parseInt(course.enrolled_count || 0);
            const isFull = course.is_full || enrolled >= maxSeats;

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col group"
              >
                {/* Course Banner */}
                <div className="relative h-44 bg-gradient-to-br from-indigo-800 via-indigo-900 to-slate-900 overflow-hidden shrink-0">
                  {course.image_url ? (
                    <img
                      src={course.image_url}
                      alt={course.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col justify-between p-4 relative">
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/80 via-indigo-900/40 to-transparent" />
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-md">
                          {course.code}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white backdrop-blur-md">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="relative z-10">
                        <span className="text-xs font-semibold text-indigo-200 line-clamp-1">
                          {course.department_name || course.category || 'Academic Department'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-900/85 text-white backdrop-blur-md shadow-xs">
                      {course.course_type || 'Degree'}
                    </span>

                    {course.is_enrolled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-white shadow-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Enrolled</span>
                      </span>
                    ) : isFull ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white shadow-xs">
                        <AlertCircle className="w-3 h-3" />
                        <span>Full</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Course Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span className="text-indigo-600 font-mono tracking-tight">{course.code}</span>
                      <span>{course.duration || '1 Semester'}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 line-clamp-2 group-hover:text-indigo-600 transition">
                      {course.name}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {course.short_description || course.description || 'Comprehensive curriculum designed for higher academic excellence.'}
                    </p>
                  </div>

                  {/* Meta Pills */}
                  <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{course.duration || '6 Months'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{t('courses.seatsRemaining', 'Seats')}: {enrolled} / {maxSeats}</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate" title={course.eligibility}>
                      🎓 {course.eligibility || 'All Students Eligible'}
                    </div>
                  </div>

                  {/* Price & Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t('payments.basePrice', 'Course Fee')}</div>
                      <div className="text-lg font-black text-slate-900">
                        {isFree ? (
                          <span className="text-emerald-600">{t('courses.freeCourse', 'FREE')}</span>
                        ) : (
                          `₹${price.toLocaleString('en-IN')}`
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/courses/${course.id}`)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                        title={t('courses.viewDetails', 'Course Syllabus')}
                      >
                        {t('courses.viewDetails', 'Details')}
                      </button>

                      {course.is_enrolled ? (
                        <button
                          type="button"
                          onClick={() => navigate('/student/my-learning')}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('nav.myLearning', 'Learning')}</span>
                        </button>
                      ) : isFull ? (
                        <button
                          type="button"
                          disabled
                          className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 bg-slate-100 cursor-not-allowed"
                        >
                          {t('courses.seatsFull', 'Full')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenPayment(course)}
                          className="px-3.5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 active:scale-95 transition cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{t('payments.payNow', 'PAY NOW')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. DIRECT PAYMENT CHECKOUT MODAL                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {checkoutCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Direct Course Payment</h3>
                  <p className="text-xs text-indigo-200 font-mono">{checkoutCourse.code}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setCheckoutCourse(null); setPaymentResult(null); setPaymentError(null); }}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {paymentResult ? (
                // SUCCESS STATE
                <div className="text-center space-y-4 py-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-slate-900">Payment Confirmed!</h4>
                    <p className="text-sm text-slate-600">
                      You are now officially enrolled in <strong className="text-slate-900">{checkoutCourse.name}</strong>.
                    </p>
                  </div>

                  {/* Transaction Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Transaction ID:</span>
                      <span className="font-mono font-bold text-indigo-700">{paymentResult.payment?.transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Receipt Number:</span>
                      <span className="font-mono font-bold text-slate-900">{paymentResult.receipt?.receipt_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount Paid:</span>
                      <span className="font-black text-slate-900">₹{parseFloat(paymentResult.payment?.amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Status:</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold uppercase text-[10px]">
                        SUCCESS
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const rec = paymentResult.receipt;
                        setActiveReceipt({
                          ...rec,
                          amount: paymentResult.payment?.amount,
                          payment_date: paymentResult.payment?.paidAt,
                          transaction_reference: paymentResult.payment?.transactionId
                        });
                        setCheckoutCourse(null);
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                    >
                      View Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/student/my-learning')}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition cursor-pointer"
                    >
                      Go to My Learning
                    </button>
                  </div>
                </div>
              ) : (
                // CHECKOUT FORM
                <div className="space-y-4">
                  {paymentError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Payment Failed:</strong> {paymentError}
                      </div>
                    </div>
                  )}

                  {/* Course Summary */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Enrolling Course</div>
                    <div className="text-base font-bold text-slate-900">{checkoutCourse.name}</div>
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>Code: <strong className="font-mono">{checkoutCourse.code}</strong></span>
                      <span>Duration: <strong>{checkoutCourse.duration || '6 Months'}</strong></span>
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  <div className="space-y-2 text-xs border-t border-b border-slate-100 py-3">
                    <div className="flex justify-between text-slate-600">
                      <span>Base Course Fee:</span>
                      <span className="font-medium">₹{parseFloat(checkoutCourse.price || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Applicable University Tax (GST 0%):</span>
                      <span className="font-medium text-emerald-600">₹0.00</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
                      <span>Total Net Payable:</span>
                      <span className="text-indigo-600 text-base">₹{parseFloat(checkoutCourse.price || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Direct payment safety notice */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Direct Payment Gateway Active. No prior admin invoice generation required.</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutCourse(null)}
                      disabled={isProcessingPayment}
                      className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecutePayment}
                      disabled={isProcessingPayment}
                      className="flex-2 py-3 px-4 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isProcessingPayment ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processing Payment...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Confirm Payment (₹{parseFloat(checkoutCourse.price || 0).toLocaleString('en-IN')})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. OFFICIAL PRINTABLE RECEIPT MODAL                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 border border-slate-200 animate-in zoom-in-95 duration-200 relative">
            <button
              type="button"
              onClick={() => setActiveReceipt(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Institutional Receipt Document */}
            <div id="printable-course-receipt" className="space-y-6 border-b border-dashed border-slate-300 pb-6">
              {/* Header */}
              <div className="text-center space-y-1">
                <div className="inline-block p-2 rounded-2xl bg-indigo-50 border border-indigo-100 mb-2">
                  <GraduationCap className="w-8 h-8 text-indigo-600 mx-auto" />
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">NEXCAMPUS UNIVERSITY</h2>
                <p className="text-xs text-slate-500 font-medium">Smart Campus Institute • Office of the Bursar & Academic Accounts</p>
                <div className="inline-block mt-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold tracking-wider uppercase border border-slate-200">
                  Official Course Enrollment Fee Receipt
                </div>
              </div>

              {/* Receipt Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Receipt Number:</span>
                  <strong className="font-mono text-slate-900">{activeReceipt.receipt_number}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Transaction Reference:</span>
                  <strong className="font-mono text-indigo-700">{activeReceipt.transaction_reference}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Student Name:</span>
                  <strong className="text-slate-900">{activeReceipt.student_name || user?.fullName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Date of Payment:</span>
                  <strong className="text-slate-900">{new Date(activeReceipt.payment_date || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                </div>
              </div>

              {/* Course Item Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Description</th>
                      <th className="py-2.5 px-3 text-right">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                    <tr>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{activeReceipt.receipt_title || checkoutCourse?.name}</div>
                        <div className="text-[11px] text-slate-500">Course Enrollment & Tuition Fee</div>
                      </td>
                      <td className="py-3 px-3 text-right font-black">
                        ₹{parseFloat(activeReceipt.amount || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold text-xs text-slate-900 border-t border-slate-200">
                    <tr>
                      <td className="py-2.5 px-3">Total Amount Paid:</td>
                      <td className="py-2.5 px-3 text-right text-indigo-700 font-black">
                        ₹{parseFloat(activeReceipt.amount || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Footer Stamp */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2">
                <div>Status: <span className="font-bold text-emerald-600">SUCCESS / PAID</span></div>
                <div>Digitally Certified by NexCampus Core</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;
