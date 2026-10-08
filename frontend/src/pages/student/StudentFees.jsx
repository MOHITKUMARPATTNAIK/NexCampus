import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  BookOpen,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  Printer,
  X,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Calendar,
  Tag
} from 'lucide-react';
import api from '../../services/api';

export default function StudentFees() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'fees' | 'history' | 'invoices'

  // Checkout modal states
  const [selectedPayable, setSelectedPayable] = useState(null); // { item_type, item }
  const [checkoutStep, setCheckoutStep] = useState('confirm'); // 'confirm' | 'processing' | 'success' | 'failure'
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [activeReceipt, setActiveReceipt] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [payablesRes, paymentsRes, receiptsRes] = await Promise.all([
        api.get('/fees/available-payables'),
        api.get('/fees/my-payments'),
        api.get('/fees/my-receipts'),
      ]);

      setCourses(payablesRes.data.courses || []);
      setFeeStructures(payablesRes.data.feeStructures || []);
      setInvoices(payablesRes.data.invoices || []);
      setPayments(paymentsRes.data.payments || []);
      setReceipts(receiptsRes.data.receipts || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load payables and payment records.');
    } finally {
      setLoading(false);
    }
  };

  const fmtCur = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  // Open Checkout Modal
  const handleOpenCheckout = (itemType, item) => {
    setError('');
    let basePrice = 0;
    let discountPct = 0;
    let taxPct = 0;
    let lateFee = 0;
    let title = '';

    if (itemType === 'course') {
      basePrice = parseFloat(item.price || 0);
      discountPct = parseFloat(item.discount_percentage || 0);
      taxPct = parseFloat(item.tax_percentage || 0);
      title = item.name;
    } else if (itemType === 'fee') {
      basePrice = parseFloat(item.amount || 0);
      discountPct = parseFloat(item.discount_percentage || 0);
      taxPct = parseFloat(item.tax_percentage || 0);
      if (item.due_date && new Date(item.due_date) < new Date()) {
        lateFee = parseFloat(item.late_fee || item.late_fine_amount || 0);
      }
      title = item.name || item.category_name;
    } else if (itemType === 'invoice') {
      basePrice = parseFloat(item.amount_due || item.final_amount || 0) - parseFloat(item.amount_paid || 0);
      title = `Invoice ${item.invoice_number} (${item.category_name})`;
    }

    const discountAmount = Math.round(((basePrice * discountPct) / 100) * 100) / 100;
    const subtotal = Math.max(0, basePrice - discountAmount);
    const taxAmount = Math.round(((subtotal * taxPct) / 100) * 100) / 100;
    const netAmount = Math.round((subtotal + taxAmount + lateFee) * 100) / 100;

    setSelectedPayable({ itemType, item, title });
    setPaymentBreakdown({
      basePrice,
      discountPct,
      discountAmount,
      taxPct,
      taxAmount,
      lateFee,
      netAmount,
    });
    setCheckoutStep('confirm');
  };

  // Process Direct Payment
  const handleExecutePayment = async () => {
    if (!selectedPayable) return;
    setCheckoutStep('processing');
    setError('');

    try {
      // Execute direct payment transaction on backend
      const res = await api.post('/fees/direct-payment/process', {
        item_type: selectedPayable.itemType,
        item_id: selectedPayable.item.id,
        amount: paymentBreakdown.netAmount,
        payment_method: 'dummy_gateway',
      });

      if (res.data.success) {
        setPaymentResult(res.data);
        setCheckoutStep('success');
        setSuccess('Payment completed successfully!');
        await loadAllData();
      } else {
        throw new Error(res.data.message || 'Payment execution failed');
      }
    } catch (err) {
      setCheckoutStep('failure');
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.code === 'ERR_NETWORK'
          ? 'Backend server is unreachable. Please verify server status.'
          : 'Payment execution failed. Please try again.');
      setError(errorMsg);

      if (err.response?.data?.alreadyPaid) {
        loadAllData();
      }
    }
  };

  const completeVerification = async (verifyPayload) => {
    try {
      const verifyRes = await api.post('/fees/direct-payment/verify', verifyPayload);
      setPaymentResult(verifyRes.data);
      setCheckoutStep('success');
      await loadAllData();
    } catch (err) {
      setCheckoutStep('failure');
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Payment verification failed on the server.';
      setError(errorMsg);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // Quick summary calculations
  const enrolledCoursesCount = courses.filter(c => c.is_enrolled).length;
  const totalPaidRevenue = payments
    .filter(p => ['SUCCESS', 'captured', 'paid'].includes(p.status))
    .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalDueCount = feeStructures.filter(f => !f.is_paid).length + courses.filter(c => !c.is_enrolled).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-slate-500 font-sans">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-sm font-semibold tracking-wide">Loading payable courses, fees, and receipts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('nav.fees')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('payments.noInvoicesRequired')}</p>
          </div>
        </div>

        <button
          onClick={loadAllData}
          title={t('common.refresh')}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>{t('common.refresh')}</span>
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-900 font-bold">✕</button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
            {t('courses.myCourses')}
          </div>
          <div className="text-3xl font-black text-slate-900">{enrolledCoursesCount}</div>
          <div className="text-xs text-slate-500 mt-1">Active specialized programs</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
            {t('payments.amountPaid')}
          </div>
          <div className="text-3xl font-black text-slate-900">{fmtCur(totalPaidRevenue)}</div>
          <div className="text-xs text-slate-500 mt-1">Confirmed direct payments</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-1">
            Available Payables
          </div>
          <div className="text-3xl font-black text-slate-900">{totalDueCount}</div>
          <div className="text-xs text-slate-500 mt-1">Courses & institutional fees</div>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-200/60 p-1.5 rounded-2xl w-fit">
        {[
          { key: 'courses', label: t('courses.title'), icon: BookOpen, count: courses.length },
          { key: 'fees', label: t('fees.title'), icon: CreditCard, count: feeStructures.length },
          { key: 'history', label: t('receipts.title'), icon: Receipt, count: payments.length },
          ...(invoices.length > 0 ? [{ key: 'invoices', label: 'Legacy Invoices', icon: Tag, count: invoices.length }] : [])
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white shadow-xs text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PAYABLE COURSES & CERTIFICATIONS */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('courses.title')}</h2>
              <p className="text-xs text-slate-500">{t('courses.subtitle')}</p>
            </div>
          </div>

          {courses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <div className="font-semibold text-slate-600">{t('courses.noCourses')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((course) => {
                const isEnrolled = course.is_enrolled;
                const hasDiscount = parseFloat(course.discount_percentage || 0) > 0;

                return (
                  <div
                    key={course.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition hover:shadow-md ${
                      isEnrolled ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {course.code || 'COURSE'}
                        </span>
                        {isEnrolled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3" /> {t('courses.enrolledBadge')}
                          </span>
                        ) : hasDiscount ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Sparkles className="w-3 h-3" /> {course.discount_percentage}% OFF
                          </span>
                        ) : null}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 leading-snug">{course.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                        {course.description || 'Comprehensive university certified course designed for technical excellence.'}
                      </p>

                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{t('courses.duration')}:</span>
                          <span className="font-semibold text-slate-700">{course.duration || '1 Semester'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{t('courses.eligibility')}:</span>
                          <span className="font-medium text-slate-700 truncate max-w-[180px]">{course.eligibility || 'Open to all'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Fee</div>
                        <div className="text-lg font-black text-slate-900">
                          {fmtCur(course.price)}
                        </div>
                      </div>

                      {isEnrolled ? (
                        <button
                          onClick={() => {
                            if (course.receipt_id) {
                              setActiveReceipt({
                                id: course.receipt_id,
                                receipt_number: course.receipt_number,
                                receipt_title: course.name,
                                student_name: 'Enrolled Student',
                                amount: course.price,
                                generated_at: new Date(),
                              });
                            } else {
                              loadAllData();
                            }
                          }}
                          className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-emerald-200"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>{t('payments.viewReceipt')}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenCheckout('course', course)}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm shadow-indigo-600/20"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{t('payments.payNow')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACADEMIC & CAMPUS CHARGES */}
      {activeTab === 'fees' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('fees.title')}</h2>
              <p className="text-xs text-slate-500">{t('fees.subtitle')}</p>
            </div>
          </div>

          {feeStructures.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <div className="font-semibold text-slate-600">{t('fees.noFees')}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {feeStructures.map((fee) => {
                const isPaid = fee.is_paid;
                const isOverdue = !isPaid && fee.due_date && new Date(fee.due_date) < new Date();

                return (
                  <div
                    key={fee.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isPaid
                        ? 'border-slate-200 bg-slate-50/30'
                        : isOverdue
                        ? 'border-rose-200 bg-rose-50/15'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-bold text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                          {fee.category_name || 'Academic Fee'}
                        </span>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3" /> {t('fees.paidBadge')}
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Clock className="w-3 h-3" /> {t('fees.overdueBadge')} (+₹{fee.late_fee || 0} late fine)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> {t('fees.pendingBadge')}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{fee.name || fee.category_name}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                        {fee.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{t('fees.dueDate')}: <strong className="text-slate-700">{fmtDate(fee.due_date)}</strong></span>
                          </span>
                        )}
                        <span>Academic Year: <strong className="text-slate-700">{fee.academic_year || '2026-2027'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Payable</div>
                        <div className="text-lg font-black text-slate-900">{fmtCur(fee.amount)}</div>
                      </div>

                      {isPaid ? (
                        <button
                          onClick={() => {
                            if (fee.receipt_id) {
                              setActiveReceipt({
                                id: fee.receipt_id,
                                receipt_number: fee.receipt_number,
                                receipt_title: fee.name || fee.category_name,
                                student_name: 'Enrolled Student',
                                amount: fee.amount,
                                generated_at: new Date(),
                              });
                            } else {
                              loadAllData();
                            }
                          }}
                          className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-emerald-200"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>{t('payments.viewReceipt')}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenCheckout('fee', fee)}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm shadow-indigo-600/20"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{t('payments.payNow')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENT HISTORY & OFFICIAL RECEIPTS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">{t('receipts.title')}</h2>
            <p className="text-xs text-slate-500">{t('receipts.subtitle')}</p>
          </div>

          {payments.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <div className="font-semibold text-slate-600">{t('receipts.noReceipts')}</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="px-4 py-3.5">Txn Reference</th>
                    <th className="px-4 py-3.5">Purpose / Item</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Amount</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => {
                    const isSuccess = ['SUCCESS', 'captured', 'paid'].includes(p.status);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 font-mono font-bold text-slate-700">
                          {p.transaction_reference}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {p.item_title}
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {p.payment_type || 'fee'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-black text-slate-900">
                          {fmtCur(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {fmtDate(p.paid_at || p.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : p.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {isSuccess ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <XCircle className="w-2.5 h-2.5" />}
                            <span>{p.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.receipt_number ? (
                            <button
                              onClick={() => {
                                setActiveReceipt({
                                  id: p.receipt_id,
                                  receipt_number: p.receipt_number,
                                  receipt_title: p.item_title,
                                  transaction_reference: p.transaction_reference,
                                  student_name: 'Enrolled Student',
                                  amount: p.amount,
                                  generated_at: p.paid_at,
                                  payment_method: p.payment_method,
                                });
                              }}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition inline-flex items-center gap-1"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>{p.receipt_number}</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LEGACY INVOICES (FOR BACKWARD COMPATIBILITY) */}
      {activeTab === 'invoices' && invoices.length > 0 && (
        <div className="space-y-3">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            Historical invoice records generated before modern direct payments migration.
          </div>
          {invoices.map((inv) => {
            const outstanding = parseFloat(inv.amount_due || 0) - parseFloat(inv.amount_paid || 0);
            const isPaid = inv.status === 'paid';
            return (
              <div key={inv.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-500">{inv.invoice_number}</div>
                  <div className="font-bold text-slate-800">{inv.category_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Due: {fmtDate(inv.due_date)}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900">{fmtCur(inv.amount_due)}</div>
                    <div className="text-[11px] text-slate-400">{isPaid ? 'Settled' : `Outstanding: ${fmtCur(outstanding)}`}</div>
                  </div>
                  {!isPaid && (
                    <button
                      onClick={() => handleOpenCheckout('invoice', inv)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      Pay Now
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CHECKOUT MODAL (CONFIRM -> PROCESS -> SUCCESS/FAIL)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedPayable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            {checkoutStep !== 'processing' && (
              <button
                onClick={() => setSelectedPayable(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* STEP 1: CONFIRM BEFORE PAYMENT */}
            {checkoutStep === 'confirm' && paymentBreakdown && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{t('payments.confirmTitle')}</h3>
                    <p className="text-xs text-slate-500">{t('payments.noInvoicesRequired')}</p>
                  </div>
                </div>

                {/* Prompt requirement: Clearly show "You are about to pay ₹XXXX for [Course/Fee Name]." */}
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 font-medium">
                  {t('payments.confirmPrompt', {
                    amount: fmtCur(paymentBreakdown.netAmount),
                    item: selectedPayable.title,
                  })}
                </div>

                {/* Price Breakdown */}
                <div className="space-y-2 text-xs border-y border-slate-100 py-3">
                  <div className="flex justify-between text-slate-600">
                    <span>{t('payments.basePrice')}:</span>
                    <span className="font-semibold text-slate-800">{fmtCur(paymentBreakdown.basePrice)}</span>
                  </div>
                  {paymentBreakdown.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>{t('payments.discount')} ({paymentBreakdown.discountPct}%):</span>
                      <span className="font-semibold">-{fmtCur(paymentBreakdown.discountAmount)}</span>
                    </div>
                  )}
                  {paymentBreakdown.taxAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>{t('payments.taxGst')} ({paymentBreakdown.taxPct}%):</span>
                      <span className="font-semibold text-slate-800">+{fmtCur(paymentBreakdown.taxAmount)}</span>
                    </div>
                  )}
                  {paymentBreakdown.lateFee > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>{t('payments.lateFee')}:</span>
                      <span className="font-semibold">+{fmtCur(paymentBreakdown.lateFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-100 text-sm font-bold">
                    <span className="text-slate-900">{t('payments.totalPayable')}:</span>
                    <span className="text-indigo-600 font-black">{fmtCur(paymentBreakdown.netAmount)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPayable(null)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePayment}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
                  >
                    <span>{t('payments.proceedToPay')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PROCESSING */}
            {checkoutStep === 'processing' && (
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('payments.processing')}</h3>
                  <p className="text-xs text-slate-500 mt-1">Contacting payment gateway & verifying cryptographic token...</p>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS SCREEN */}
            {checkoutStep === 'success' && paymentResult && (
              <div className="space-y-5 text-center py-2">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-emerald-600/10">
                  <Check className="w-7 h-7 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{t('payments.paymentSuccess')}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Your payment was securely verified and recorded.</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl text-left text-xs space-y-2 border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('payments.transactionId')}:</span>
                    <span className="font-mono font-bold text-slate-800">{paymentResult.payment?.transaction_reference || 'TXN-CONFIRMED'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('payments.receiptNumber')}:</span>
                    <span className="font-mono font-bold text-indigo-600">{paymentResult.receipt?.receipt_number || 'RCP-GENERATED'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('payments.amountPaid')}:</span>
                    <span className="font-black text-emerald-700">{fmtCur(paymentResult.receipt?.amount || paymentBreakdown?.netAmount)}</span>
                  </div>
                  {selectedPayable.itemType === 'course' && (
                    <div className="pt-2 border-t border-slate-200 text-emerald-700 font-semibold text-center">
                      ✓ You are now actively enrolled in this course!
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReceipt(paymentResult.receipt);
                      setSelectedPayable(null);
                    }}
                    className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-indigo-200"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>{t('payments.viewReceipt')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPayable(null)}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    {t('payments.close')}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: FAILURE */}
            {checkoutStep === 'failure' && (
              <div className="space-y-4 text-center py-2">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                  <X className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('payments.paymentFailed')}</h3>
                  <p className="text-xs text-rose-600 mt-1">{error || 'An error occurred while verifying transaction.'}</p>
                </div>
                <div className="flex gap-2">
                  {error.toLowerCase().includes('already paid') || error.toLowerCase().includes('already enrolled') ? (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = selectedPayable?.item?.id;
                        setSelectedPayable(null);
                        const found = receipts.find(r => r.course_id === targetId || r.fee_structure_id === targetId);
                        if (found) {
                          setActiveReceipt(found);
                        } else {
                          setActiveTab('history');
                        }
                      }}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>{t('payments.viewReceipt')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('confirm')}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      {t('payments.tryAgain')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPayable(null)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                  >
                    {t('payments.close')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PRINTABLE OFFICIAL RECEIPT MODAL                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative font-sans">
            <button
              onClick={() => setActiveReceipt(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Receipt Canvas */}
            <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 mb-6" id="receipt-printable-area">
              <div className="text-center pb-4 border-b border-slate-200 mb-4">
                <div className="text-xs font-black tracking-widest uppercase text-indigo-600 mb-0.5">NexCampus Smart Campus</div>
                <h3 className="text-lg font-black text-slate-900">{t('receipts.officialReceipt')}</h3>
                <div className="text-xs font-mono text-slate-500 mt-1 font-bold">
                  {activeReceipt.receipt_number}
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t('receipts.studentName')}:</span>
                  <span className="font-bold text-slate-800">{activeReceipt.student_name || 'Enrolled Scholar'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t('receipts.rollNumber')}:</span>
                  <span className="font-bold text-slate-800 font-mono">{activeReceipt.student_roll || 'STU-NC2026'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t('receipts.item')}:</span>
                  <span className="font-bold text-slate-800">{activeReceipt.receipt_title || activeReceipt.title || 'Campus Fee Payment'}</span>
                </div>
                {activeReceipt.transaction_reference && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">{t('payments.transactionId')}:</span>
                    <span className="font-bold text-slate-800 font-mono">{activeReceipt.transaction_reference}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t('receipts.issuedAt')}:</span>
                  <span className="font-bold text-slate-800">{fmtDate(activeReceipt.generated_at || activeReceipt.issued_at || new Date())}</span>
                </div>
                <div className="flex justify-between pt-3 text-sm">
                  <span className="font-bold text-slate-900">{t('payments.totalPayable')}:</span>
                  <span className="font-black text-emerald-700">{fmtCur(activeReceipt.amount)}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-dashed border-slate-200 text-center text-[10px] text-slate-400">
                Official digital authenticated receipt from NexCampus ERP System. Valid for university clearance without physical signature.
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t('payments.downloadReceipt')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                {t('payments.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
