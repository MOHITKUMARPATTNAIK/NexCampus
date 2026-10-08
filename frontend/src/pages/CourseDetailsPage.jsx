import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  ArrowLeft,
  GraduationCap,
  Clock,
  Users,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Award,
  Layers,
  FileText,
  Printer,
  ShieldCheck,
  X,
  Share2
} from 'lucide-react';

export const CourseDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Curriculum accordion state (open module IDs)
  const [openModules, setOpenModules] = useState({});

  // Direct payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  // Active receipt modal
  const [activeReceipt, setActiveReceipt] = useState(null);

  const fetchCourse = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/courses/${id}`);
      if (res.data.success) {
        setCourse(res.data.course);
        // Default first module open
        if (res.data.course?.modules?.length > 0) {
          setOpenModules({ [res.data.course.modules[0].id]: true });
        }
      }
    } catch (err) {
      console.error('[CourseDetailsPage] Failed to fetch course:', err);
      setError(err.response?.data?.message || 'Course not found or access restricted.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, [id]);

  const toggleModule = (modId) => {
    setOpenModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleOpenPayment = () => {
    if (!user) {
      navigate(`/login?redirect=/courses/${id}`);
      return;
    }
    setShowPaymentModal(true);
    setPaymentResult(null);
    setPaymentError(null);
  };

  const handleExecutePayment = async () => {
    setIsProcessingPayment(true);
    setPaymentError(null);
    try {
      const res = await api.post('/fees/direct-payment/process', {
        item_type: 'course',
        item_id: course.id,
        amount: parseFloat(course.price || 0),
        payment_method: 'dummy_gateway'
      });

      if (res.data.success) {
        setPaymentResult(res.data);
        await fetchCourse();
      } else {
        setPaymentError(res.data.message || 'Payment execution failed');
      }
    } catch (err) {
      console.error('[CourseDetailsPage] Payment failed:', err);
      if (err.response?.status === 409) {
        setPaymentError(err.response?.data?.message || 'You have already paid and enrolled in this course.');
        await fetchCourse();
      } else {
        setPaymentError(err.response?.data?.message || err.message || 'Payment processing failed. Please try again.');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4 max-w-4xl mx-auto">
        <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500">Loading course curriculum & details...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl max-w-2xl mx-auto space-y-4 my-12">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-lg font-bold text-rose-900">Course Unavailable</h3>
        <p className="text-sm text-rose-700">{error || 'This course could not be loaded.'}</p>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Courses</span>
        </button>
      </div>
    );
  }

  const price = parseFloat(course.price || 0);
  const maxSeats = course.max_seats || 120;
  const enrolledCount = parseInt(course.enrolled_count || 0);
  const availableSeats = Math.max(0, maxSeats - enrolledCount);
  const isFull = course.is_full || enrolledCount >= maxSeats;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition p-2 -ml-2 rounded-xl hover:bg-slate-100 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Course Catalog</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HERO BANNER                                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white p-6 sm:p-10 shadow-xl border border-indigo-700/30">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-white/10 text-white font-mono text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                {course.code}
              </span>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-semibold uppercase tracking-wider border border-indigo-400/30">
                {course.course_type || 'Degree Program'}
              </span>
              <span className="text-xs text-indigo-300 font-medium">
                {course.department_name || course.category || 'Academic Faculty'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
              {course.name}
            </h1>

            <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed max-w-2xl">
              {course.short_description || course.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-indigo-200">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>{course.duration || '1 Semester'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>{enrolledCount} Students Enrolled</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-indigo-400" />
                <span>{course.instructor_name || 'Academic Faculty'}</span>
              </span>
            </div>
          </div>

          {/* Quick Enrolled / Status Card on Hero */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/15 text-center space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-200">Official Fee</div>
            <div className="text-3xl font-black text-white">
              {price === 0 ? 'FREE' : `₹${price.toLocaleString('en-IN')}`}
            </div>

            {course.is_enrolled ? (
              <div className="space-y-2">
                <div className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>You are Enrolled</span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => navigate('/student/my-learning')}
                    className="w-full py-3 px-4 rounded-xl text-xs font-black text-indigo-900 bg-white hover:bg-indigo-50 shadow-md transition cursor-pointer"
                  >
                    Go to My Learning
                  </button>
                </div>
              </div>
            ) : isFull ? (
              <button
                type="button"
                disabled
                className="w-full py-3 px-4 rounded-xl text-xs font-bold text-slate-300 bg-white/10 cursor-not-allowed"
              >
                Enrollment Full
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenPayment}
                className="w-full py-3 px-4 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95 transition cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>PAY NOW & ENROLL</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. MAIN DETAILS & SIDEBAR LAYOUT                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Details & Curriculum */}
        <div className="lg:col-span-2 space-y-8">
          {/* Overview Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span>Course Overview</span>
            </h2>

            <div className="prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed space-y-4">
              <p>{course.description || course.short_description}</p>
            </div>

            {/* Learning Objectives */}
            {course.learning_objectives && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 text-[11px]">
                  <Award className="w-4 h-4 text-indigo-600" />
                  <span>Learning Objectives</span>
                </h3>
                <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80 whitespace-pre-line">
                  {course.learning_objectives}
                </div>
              </div>
            )}

            {/* Eligibility & Prerequisites Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1">
                <span className="font-bold text-indigo-900 uppercase tracking-wider text-[10px] block">Eligibility</span>
                <span className="text-slate-700">{course.eligibility || 'Open to all enrolled students'}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] block">Prerequisites</span>
                <span className="text-slate-700">{course.prerequisites || 'None specified'}</span>
              </div>
            </div>
          </div>

          {/* Curriculum / Modules Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>Curriculum & Syllabus</span>
              </h2>
              <span className="text-xs font-bold text-slate-500">
                {course.modules?.length || 0} Modules
              </span>
            </div>

            {(!course.modules || course.modules.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-500">
                Curriculum syllabus is currently being prepared by the department authority.
              </div>
            ) : (
              <div className="space-y-3">
                {course.modules.map((mod, idx) => {
                  const isOpen = Boolean(openModules[mod.id]);
                  let topicsList = [];
                  if (Array.isArray(mod.topics)) {
                    topicsList = mod.topics;
                  } else if (typeof mod.topics === 'string') {
                    try { topicsList = JSON.parse(mod.topics); } catch (_) { topicsList = [mod.topics]; }
                  }

                  return (
                    <div
                      key={mod.id}
                      className="border border-slate-200/90 rounded-2xl overflow-hidden transition"
                    >
                      <button
                        type="button"
                        onClick={() => toggleModule(mod.id)}
                        className="w-full p-4.5 bg-slate-50/70 hover:bg-slate-100/80 flex items-center justify-between text-left transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{mod.title}</h4>
                            <span className="text-[11px] text-slate-500 font-medium">Duration: {mod.duration || '2 Weeks'}</span>
                          </div>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </button>

                      {isOpen && (
                        <div className="p-5 bg-white border-t border-slate-100 space-y-3 text-xs">
                          {mod.description && (
                            <p className="text-slate-600 leading-relaxed">{mod.description}</p>
                          )}

                          {topicsList.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                                Topics Covered:
                              </span>
                              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {topicsList.map((t, tIdx) => (
                                  <li key={tIdx} className="flex items-center gap-2 text-slate-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                    <span>{typeof t === 'string' ? t : JSON.stringify(t)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Enrollment & Financial Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-md space-y-6 sticky top-6">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Program Fee</span>
              <div className="text-3xl font-black text-slate-900">
                {price === 0 ? (
                  <span className="text-emerald-600">FREE</span>
                ) : (
                  `₹${price.toLocaleString('en-IN')}`
                )}
              </div>
              <span className="text-xs text-slate-500 block">All academic materials and certificate included</span>
            </div>

            {/* Program Specs */}
            <div className="space-y-3 text-xs border-t border-b border-slate-100 py-4">
              <div className="flex justify-between text-slate-600">
                <span>Duration:</span>
                <strong className="text-slate-900">{course.duration || '1 Semester'}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Faculty Instructor:</span>
                <strong className="text-slate-900">{course.instructor_name || 'Assigned Faculty'}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Department:</span>
                <strong className="text-slate-900">{course.department_name || course.category}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Available Seats:</span>
                <strong className={availableSeats <= 10 ? 'text-amber-600' : 'text-slate-900'}>
                  {availableSeats} / {maxSeats}
                </strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Payment Mode:</span>
                <strong className="text-indigo-600 font-semibold">Direct Student Payment</strong>
              </div>
            </div>

            {/* Action CTA */}
            {course.is_enrolled ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                  <div className="text-xs font-bold text-emerald-900">Enrolled Student</div>
                  {course.receipt_number && (
                    <div className="text-[11px] text-emerald-700 font-mono">Receipt: {course.receipt_number}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/student/my-learning')}
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition cursor-pointer"
                >
                  Go to My Learning
                </button>
              </div>
            ) : isFull ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-1">
                <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                <div className="text-xs font-bold text-amber-900">Enrollment Full</div>
                <div className="text-[11px] text-amber-700">All available seats for this course are currently filled.</div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOpenPayment}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/25 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>PAY NOW (₹{price.toLocaleString('en-IN')})</span>
              </button>
            )}

            <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Direct secure payment with automated receipt</span>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. DIRECT PAYMENT MODAL                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirm Direct Enrollment</h3>
                  <p className="text-xs text-indigo-200 font-mono">{course.code}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowPaymentModal(false); setPaymentResult(null); setPaymentError(null); }}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {paymentResult ? (
                <div className="text-center space-y-4 py-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-slate-900">Enrollment Confirmed!</h4>
                    <p className="text-sm text-slate-600">
                      Payment of ₹{parseFloat(course.price || 0).toLocaleString('en-IN')} confirmed for <strong className="text-slate-900">{course.name}</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Transaction ID:</span>
                      <span className="font-mono font-bold text-indigo-700">{paymentResult.payment?.transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Receipt Number:</span>
                      <span className="font-mono font-bold text-slate-900">{paymentResult.receipt?.receipt_number}</span>
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
                        setShowPaymentModal(false);
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
                <div className="space-y-4">
                  {paymentError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div><strong>Error:</strong> {paymentError}</div>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1">
                    <div className="text-xs font-bold text-slate-900">{course.name}</div>
                    <div className="text-xs text-slate-500">Duration: {course.duration || '1 Semester'}</div>
                  </div>

                  <div className="space-y-2 text-xs border-t border-b border-slate-100 py-3">
                    <div className="flex justify-between text-slate-600">
                      <span>Course Fee:</span>
                      <span className="font-medium">₹{price.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Tax / GST:</span>
                      <span className="font-medium text-emerald-600">₹0.00</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
                      <span>Total Payable:</span>
                      <span className="text-indigo-600 text-base">₹{price.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(false)}
                      disabled={isProcessingPayment}
                      className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecutePayment}
                      disabled={isProcessingPayment}
                      className="flex-2 py-3 px-4 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isProcessingPayment ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>Confirm Payment (₹{price.toLocaleString('en-IN')})</span>
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
      {/* 4. RECEIPT MODAL                                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setActiveReceipt(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <GraduationCap className="w-8 h-8 text-indigo-600 mx-auto" />
              <h2 className="text-xl font-black text-slate-900">NEXCAMPUS UNIVERSITY</h2>
              <p className="text-xs text-slate-500">Official Course Enrollment Fee Receipt</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
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
                <span className="text-slate-500 block">Amount Paid:</span>
                <strong className="text-indigo-700">₹{parseFloat(activeReceipt.amount || 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition"
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

export default CourseDetailsPage;
