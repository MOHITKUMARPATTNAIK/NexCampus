import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  BookOpen,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Printer,
  ChevronRight,
  TrendingUp,
  Award,
  Calendar,
  X,
  CreditCard,
  Sliders,
  Check
} from 'lucide-react';

export const MyLearningPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [learningCourses, setLearningCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Progress update modal state
  const [updatingCourse, setUpdatingCourse] = useState(null);
  const [progressVal, setProgressVal] = useState(0);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // Active receipt modal
  const [activeReceipt, setActiveReceipt] = useState(null);

  const fetchMyLearning = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/courses/my-learning');
      if (res.data.success) {
        setLearningCourses(res.data.learning || []);
      }
    } catch (err) {
      console.error('[MyLearningPage] Error fetching courses:', err);
      setError(err.response?.data?.message || 'Failed to load your enrolled courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLearning();
  }, []);

  const handleOpenProgressModal = (course) => {
    setUpdatingCourse(course);
    setProgressVal(course.progress || 0);
  };

  const handleSaveProgress = async () => {
    if (!updatingCourse) return;
    setIsSavingProgress(true);
    try {
      const res = await api.patch(`/courses/my-learning/${updatingCourse.course_id}/progress`, {
        progress: Number(progressVal)
      });
      if (res.data.success) {
        setUpdatingCourse(null);
        await fetchMyLearning();
      }
    } catch (err) {
      console.error('[MyLearningPage] Failed to update progress:', err);
      alert('Failed to update progress: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSavingProgress(false);
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
            <BookOpen className="w-4 h-4" />
            <span>{t('myLearning.portalBadge', 'Student Academic Portal')}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('myLearning.title', 'My Learning & Enrolled Courses')}
          </h1>
          <p className="text-xs text-slate-500">
            {t('myLearning.subtitle', 'Track active academic courses, syllabus progress, and official payment receipts.')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <GraduationCap className="w-4 h-4" />
          <span>{t('myLearning.browseCatalog', 'Browse More Courses')}</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. STATS BAR                                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">{t('myLearning.enrolledCount', 'Enrolled Courses')}</div>
            <div className="text-2xl font-black text-slate-900">{learningCourses.length}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">{t('status.completed', 'Completed Courses')}</div>
            <div className="text-2xl font-black text-slate-900">
              {learningCourses.filter(c => c.progress === 100 || c.enrollment_status === 'completed').length}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">{t('myLearning.verifiedReceipts', 'Direct Verified Fees')}</div>
            <div className="text-2xl font-black text-slate-900">
              ₹{learningCourses.reduce((sum, c) => sum + parseFloat(c.course_fee_at_enrollment || c.receipt_amount || 0), 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. ENROLLED COURSES LIST                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">{t('common.loading', 'Loading your enrolled courses...')}</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
          {error}
        </div>
      ) : learningCourses.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-4 shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{t('myLearning.noCoursesTitle', 'You are not enrolled in any courses yet')}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('myLearning.noCoursesDesc', 'Browse the university course catalog to enroll in academic degree programs and technical courses.')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
          >
            {t('myLearning.browseCourses', 'Explore Courses')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {learningCourses.map((item) => {
            const isCompleted = item.progress === 100 || item.enrollment_status === 'completed';
            const enrolledDate = item.enrolled_at ? new Date(item.enrolled_at).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric'
            }) : 'Enrolled';

            return (
              <div
                key={item.enrollment_id}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                {/* Card Top */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {item.course_code}
                    </span>

                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('status.paid', 'Paid')}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 line-clamp-2">
                      {item.course_name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {item.department_name || item.category || 'Academic Department'}
                    </p>
                  </div>

                  {/* Enrollment Details */}
                  <div className="p-3 rounded-xl bg-slate-50 space-y-2 text-xs border border-slate-100">
                    <div className="flex justify-between text-slate-600">
                      <span>{t('courses.enrolledOn', 'Enrollment Date')}:</span>
                      <strong className="text-slate-900">{enrolledDate}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{t('payments.amountPaid', 'Tuition Fee Paid')}:</span>
                      <strong className="text-slate-900">
                        ₹{parseFloat(item.course_fee_at_enrollment || item.receipt_amount || 0).toLocaleString('en-IN')}
                      </strong>
                    </div>
                    {item.receipt_number && (
                      <div className="flex justify-between text-slate-600">
                        <span>{t('payments.receiptNumber', 'Receipt')}:</span>
                        <strong className="font-mono text-indigo-600">{item.receipt_number}</strong>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">{t('myLearning.syllabusCoverage', 'Course Progress')}</span>
                      <span className={isCompleted ? 'text-emerald-600 font-bold' : 'text-indigo-600'}>
                        {item.progress || 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${Math.min(100, item.progress || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {item.receipt_number && (
                      <button
                        type="button"
                        onClick={() => setActiveReceipt({
                          receipt_number: item.receipt_number,
                          transaction_reference: item.transaction_reference,
                          student_name: user?.fullName,
                          receipt_title: item.course_name,
                          amount: item.course_fee_at_enrollment || item.receipt_amount,
                          payment_date: item.paid_at || item.enrolled_at
                        })}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-200/70 transition cursor-pointer"
                        title={t('payments.viewReceipt', 'View Receipt')}
                      >
                        {t('myLearning.viewReceipt', 'Receipt')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenProgressModal(item)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition cursor-pointer inline-flex items-center gap-1"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{t('myLearning.updateProgress', 'Progress')}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/courses/${item.course_id}`)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>{isCompleted ? t('common.completed', 'Review') : t('courses.accessCourse', 'Continue')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. UPDATE PROGRESS MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {updatingCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Update Learning Progress</h3>
              <button
                type="button"
                onClick={() => setUpdatingCourse(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-800">{updatingCourse.course_name}</div>
              <div className="text-[11px] text-slate-500 font-mono">{updatingCourse.course_code}</div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">Completion Percentage:</span>
                <span className="text-indigo-600 font-black text-sm">{progressVal}%</span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progressVal}
                onChange={(e) => setProgressVal(e.target.value)}
                className="w-full accent-indigo-600 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0% Not Started</span>
                <span>50% Halfway</span>
                <span>100% Completed</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {[25, 50, 75, 100].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setProgressVal(quick)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 transition"
                >
                  {quick}%
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUpdatingCourse(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProgress}
                disabled={isSavingProgress}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition"
              >
                {isSavingProgress ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. RECEIPT MODAL                                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setActiveReceipt(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <GraduationCap className="w-8 h-8 text-indigo-600 mx-auto" />
              <h2 className="text-lg font-black text-slate-900">NEXCAMPUS UNIVERSITY</h2>
              <p className="text-xs text-slate-500">Official Course Enrollment Receipt</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">Receipt Number:</span>
                <strong className="font-mono">{activeReceipt.receipt_number}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Transaction Reference:</span>
                <strong className="font-mono text-indigo-700">{activeReceipt.transaction_reference}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Student:</span>
                <strong>{activeReceipt.student_name || user?.fullName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Amount:</span>
                <strong className="text-indigo-700">₹{parseFloat(activeReceipt.amount || 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700"
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

export default MyLearningPage;
