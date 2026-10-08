import { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  BookOpen,
  Receipt,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  TrendingUp,
  Tag
} from 'lucide-react';
import api from '../../services/api';

export default function FeeManagement() {
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'courses' | 'structures' | 'invoices'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [courses, setCourses] = useState([]);
  const [structures, setStructures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Transaction Filters
  const [txSearch, setTxSearch] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [txType, setTxType] = useState('');

  // Course Edit Modal
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({
    price: '',
    duration: '',
    eligibility: '',
    discount_percentage: '',
    tax_percentage: '',
    description: '',
    is_payable: true,
    is_active: true,
  });

  // Structure Create/Edit Modal
  const [showStructModal, setShowStructModal] = useState(false);
  const [editingStruct, setEditingStruct] = useState(null);
  const [structForm, setStructForm] = useState({
    category_id: '',
    name: '',
    academic_year: '2026-2027',
    amount: '',
    due_date: '',
    late_fee: '0',
    tax_percentage: '0',
    discount_percentage: '0',
    is_active: true,
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [txRes, coursesRes, strRes, catRes, invRes] = await Promise.all([
        api.get('/fees/admin/transactions'),
        api.get('/fees/admin/courses'),
        api.get('/fees/structures'),
        api.get('/fees/categories'),
        api.get('/fees/invoices'),
      ]);

      setTransactions(txRes.data.transactions || []);
      setSummary(txRes.data.summary || {});
      setCourses(coursesRes.data.courses || []);
      setStructures(strRes.data.structures || []);
      setCategories(catRes.data.categories || []);
      setInvoices(invRes.data.invoices || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load administration fee data');
    } finally {
      setLoading(false);
    }
  };

  const fmtCur = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  // Filtered transactions
  const filteredTransactions = transactions.filter((t) => {
    const matchSearch =
      !txSearch ||
      t.student_name?.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.student_email?.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.student_roll?.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.transaction_reference?.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.receipt_number?.toLowerCase().includes(txSearch.toLowerCase());

    const matchStatus = !txStatus || (txStatus === 'SUCCESS' ? ['SUCCESS', 'captured', 'paid'].includes(t.status) : t.status === txStatus);
    const matchType = !txType || t.payment_type === txType;
    return matchSearch && matchStatus && matchType;
  });

  // Open Course Edit
  const handleOpenCourseEdit = (course) => {
    setEditingCourse(course);
    setCourseForm({
      price: course.price || 0,
      duration: course.duration || '1 Semester',
      eligibility: course.eligibility || 'All Students',
      discount_percentage: course.discount_percentage || 0,
      tax_percentage: course.tax_percentage || 0,
      description: course.description || '',
      is_payable: course.is_payable ?? true,
      is_active: course.is_active ?? true,
    });
  };

  // Save Course Edit
  const handleSaveCourse = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/fees/admin/courses/${editingCourse.id}`, courseForm);
      setSuccess(`Updated course pricing for ${editingCourse.name}`);
      setEditingCourse(null);
      loadAllData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update course pricing');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Structure Modal (Create or Edit)
  const handleOpenStructModal = (str = null) => {
    if (str) {
      setEditingStruct(str);
      setStructForm({
        category_id: str.category_id || '',
        name: str.name || '',
        academic_year: str.academic_year || '2026-2027',
        amount: str.amount || '',
        due_date: str.due_date ? str.due_date.substring(0, 10) : '',
        late_fee: str.late_fee || 0,
        tax_percentage: str.tax_percentage || 0,
        discount_percentage: str.discount_percentage || 0,
        is_active: str.is_active ?? true,
      });
    } else {
      setEditingStruct(null);
      setStructForm({
        category_id: categories[0]?.id || '',
        name: '',
        academic_year: '2026-2027',
        amount: '',
        due_date: '',
        late_fee: '0',
        tax_percentage: '0',
        discount_percentage: '0',
        is_active: true,
      });
    }
    setShowStructModal(true);
  };

  // Save Structure
  const handleSaveStructure = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingStruct) {
        await api.patch(`/fees/structures/${editingStruct.id}`, structForm);
        setSuccess('Fee structure updated');
      } else {
        await api.post('/fees/structures', structForm);
        setSuccess('New fee structure configured');
      }
      setShowStructModal(false);
      setEditingStruct(null);
      loadAllData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save fee structure');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-slate-500 font-sans">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-sm font-semibold tracking-wide">Loading administration ledger and fee configurations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fee & Revenue Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct student payment ledger, course pricing, and institutional fee configuration.
            </p>
          </div>
        </div>

        <button
          onClick={loadAllData}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh Data</span>
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
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* Top Revenue KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1 flex items-center justify-between">
            <span>Total Revenue</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-slate-900">{fmtCur(summary.total_revenue)}</div>
          <div className="text-xs text-slate-500 mt-1">{summary.captured_count || 0} successful payments</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1 flex items-center justify-between">
            <span>Course Revenue</span>
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-slate-900">{fmtCur(summary.course_revenue)}</div>
          <div className="text-xs text-slate-500 mt-1">Direct student course purchases</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1 flex items-center justify-between">
            <span>Fee Revenue</span>
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-slate-900">{fmtCur(summary.fee_revenue)}</div>
          <div className="text-xs text-slate-500 mt-1">Academic & campus charges</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Configured Programs</span>
            <Tag className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-slate-900">{courses.length}</div>
          <div className="text-xs text-slate-500 mt-1">{structures.length} fee structures active</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-200/60 p-1.5 rounded-2xl w-fit">
        {[
          { key: 'transactions', label: 'Transaction Ledger', icon: Receipt, count: transactions.length },
          { key: 'courses', label: 'Course Pricing & Availability', icon: BookOpen, count: courses.length },
          { key: 'structures', label: 'Fee Structures Config', icon: CreditCard, count: structures.length },
          ...(invoices.length > 0 ? [{ key: 'invoices', label: 'Historical Invoices', icon: Tag, count: invoices.length }] : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
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

      {/* TAB 1: REAL-TIME TRANSACTION LEDGER */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search student, roll, txn, receipt..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-700 bg-white"
              >
                <option value="">All Payment Types</option>
                <option value="course">Course Purchases</option>
                <option value="fee">Campus Fees</option>
                <option value="invoice">Invoices</option>
              </select>

              <select
                value={txStatus}
                onChange={(e) => setTxStatus(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-700 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">Success / Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <div className="font-semibold text-slate-600">No transactions matching your criteria.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="px-4 py-3.5">Student / Roll</th>
                    <th className="px-4 py-3.5">Item / Purpose</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Amount</th>
                    <th className="px-4 py-3.5">Txn Reference</th>
                    <th className="px-4 py-3.5">Receipt No</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => {
                    const isSuccess = ['SUCCESS', 'captured', 'paid'].includes(tx.status);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{tx.student_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{tx.student_roll || tx.student_email}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {tx.item_title}
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {tx.payment_type || 'fee'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-black text-slate-900">
                          {fmtCur(tx.amount)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-600">
                          {tx.transaction_reference}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                          {tx.receipt_number || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {fmtDate(tx.paid_at || tx.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {isSuccess ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <XCircle className="w-2.5 h-2.5" />}
                            {tx.status}
                          </span>
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

      {/* TAB 2: COURSE PRICING & PAYMENT AVAILABILITY */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">University Courses & Skill Certifications</h2>
              <p className="text-xs text-slate-500">
                Configure direct pricing, duration, discounts, and payment availability for each program.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course) => (
              <div key={course.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {course.code || 'COURSE'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      course.is_payable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {course.is_payable ? 'Payable Online' : 'Offline Only'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{course.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {course.description || 'Program curriculum and technical certification.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <span className="font-semibold">{course.duration || '1 Semester'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Discount:</span>
                      <span className="font-semibold text-emerald-700">{course.discount_percentage || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Enrolled Students:</span>
                      <span className="font-bold text-indigo-600">{course.active_students_count || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Price</div>
                    <div className="text-lg font-black text-slate-900">{fmtCur(course.price)}</div>
                  </div>

                  <button
                    onClick={() => handleOpenCourseEdit(course)}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Configure</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FEE STRUCTURES CONFIGURATOR */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Institutional Fee Structures</h2>
              <p className="text-xs text-slate-500">
                Create and manage tuition, lab, examination, and hostel fee amounts and deadlines.
              </p>
            </div>

            <button
              onClick={() => handleOpenStructModal()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Configure Fee</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="px-4 py-3.5">Fee Name / Category</th>
                    <th className="px-4 py-3.5">Amount</th>
                    <th className="px-4 py-3.5">Academic Year</th>
                    <th className="px-4 py-3.5">Due Date</th>
                    <th className="px-4 py-3.5">Late Fee</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {structures.map((str) => (
                    <tr key={str.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{str.name || str.category_name}</div>
                        <div className="text-[11px] text-slate-500">{str.category_name}</div>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">{fmtCur(str.amount)}</td>
                      <td className="px-4 py-3 text-slate-600 font-semibold">{str.academic_year}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(str.due_date)}</td>
                      <td className="px-4 py-3 text-rose-600 font-semibold">{fmtCur(str.late_fee || 0)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          str.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {str.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenStructModal(str)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORICAL INVOICES ARCHIVE */}
      {activeTab === 'invoices' && invoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="text-xs text-slate-500">
            Historical invoice logs preserved for archival accounting compliance.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-bold">
                <tr>
                  <th className="px-4 py-3.5">Invoice No</th>
                  <th className="px-4 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Due Date</th>
                  <th className="px-4 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">{inv.invoice_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{inv.student_name}</div>
                      <div className="text-[11px] text-slate-500">{inv.roll_number}</div>
                    </td>
                    <td className="px-4 py-3">{inv.category_name}</td>
                    <td className="px-4 py-3 font-black text-slate-900">{fmtCur(inv.amount_due)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COURSE CONFIG EDIT MODAL */}
      {editingCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Configure Course Pricing: {editingCourse.name}</h3>
            <p className="text-xs text-slate-500 mb-4">Set direct student payable amounts and parameters.</p>

            <form onSubmit={handleSaveCourse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Direct Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={courseForm.price}
                    onChange={(e) => setCourseForm({ ...courseForm, price: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Duration</label>
                  <input
                    type="text"
                    value={courseForm.duration}
                    onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Discount (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={courseForm.discount_percentage}
                    onChange={(e) => setCourseForm({ ...courseForm, discount_percentage: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tax / GST (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={courseForm.tax_percentage}
                    onChange={(e) => setCourseForm({ ...courseForm, tax_percentage: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Eligibility Criteria</label>
                <input
                  type="text"
                  value={courseForm.eligibility}
                  onChange={(e) => setCourseForm({ ...courseForm, eligibility: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows="2"
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courseForm.is_payable}
                    onChange={(e) => setCourseForm({ ...courseForm, is_payable: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="font-bold text-slate-700">Available for Online Payment</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courseForm.is_active}
                    onChange={(e) => setCourseForm({ ...courseForm, is_active: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="font-bold text-slate-700">Course Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEE STRUCTURE MODAL */}
      {showStructModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingStruct ? 'Edit Fee Structure' : 'Configure New Fee Structure'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">Set payable fee parameters for student accounts.</p>

            <form onSubmit={handleSaveStructure} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Fee Category</label>
                  <select
                    value={structForm.category_id}
                    onChange={(e) => setStructForm({ ...structForm, category_id: e.target.value })}
                    required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Fee Name / Display Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tuition Fee 2026"
                    value={structForm.name}
                    onChange={(e) => setStructForm({ ...structForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={structForm.amount}
                    onChange={(e) => setStructForm({ ...structForm, amount: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={structForm.due_date}
                    onChange={(e) => setStructForm({ ...structForm, due_date: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Late Fine Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={structForm.late_fee}
                    onChange={(e) => setStructForm({ ...structForm, late_fee: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={structForm.academic_year}
                    onChange={(e) => setStructForm({ ...structForm, academic_year: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={structForm.is_active}
                    onChange={(e) => setStructForm({ ...structForm, is_active: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="font-bold text-slate-700">Fee Active & Payable by Students</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStructModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
