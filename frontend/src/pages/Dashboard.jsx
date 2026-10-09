import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  Shield,
  Users,
  GraduationCap,
  CalendarCheck2,
  Clock,
  QrCode,
  CreditCard,
  MessageSquareWarning,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Database,
  Activity,
  Bell,
  FolderOpen,
  DollarSign,
  TrendingUp,
  FileText
} from 'lucide-react';

export const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [healthInfo, setHealthInfo] = useState(null);
  const [adminMetrics, setAdminMetrics] = useState(null);
  const [studentPortfolio, setStudentPortfolio] = useState(null);
  const [cmoStats, setCmoStats] = useState(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [recentNotices, setRecentNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  if (!user) return null;

  const isSuperAdmin = user.isSuperAdmin;
  const isCMO = user.isCMO;
  const isStudent = user.roles?.includes('student') || user.role === 'student';
  const isGuard = user.roles?.includes('security_guard') || user.role === 'security_guard';
  const isFaculty = user.roles?.includes('faculty') || user.role === 'faculty';
  const isDelegatedAdmin = user.roles?.includes('delegated_admin') || user.role === 'delegated_admin';

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        // 1. Health check
        const healthRes = await api.get('/health');
        if (mounted) setHealthInfo(healthRes.data);

        // 2. Recent Notices
        try {
          const noticesRes = await api.get('/notices', { params: { limit: 3 } });
          if (mounted) setRecentNotices(noticesRes.data.notices || []);
        } catch {}

        // 3. Admin metrics
        if (isSuperAdmin || isDelegatedAdmin) {
          try {
            const metricsRes = await api.get('/admin/metrics');
            if (mounted) setAdminMetrics(metricsRes.data.metrics);
          } catch {}
        }

        // 4. Student portfolio summary
        if (isStudent) {
          try {
            const portRes = await api.get('/portfolio/my');
            if (mounted) setStudentPortfolio(portRes.data);
          } catch {}
        }

        // 5. CMO Stats
        if (isCMO || isSuperAdmin) {
          try {
            const cmoRes = await api.get('/complaints/stats');
            if (mounted) setCmoStats(cmoRes.data.stats);
          } catch {}
        }

        // 6. Security Guard overdue check
        if (isGuard || isSuperAdmin) {
          try {
            const overdueRes = await api.get('/security/overdue-students');
            if (mounted) setOverdueCount((overdueRes.data.students || []).length);
          } catch {}
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [user]);

  const fmtCur = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 font-sans">
      {/* Welcome & Role Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-3">
              <Activity className="w-3.5 h-3.5" />
              <span>{t('dashboard.engineBadge', 'NexCampus Smart Campus Management Engine')}</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {t('dashboard.welcome', { name: user.fullName, defaultValue: `Welcome back, ${user.fullName}` })}
            </h1>
            <p className="text-slate-500 text-sm mt-1 max-w-2xl font-medium">
              {t('dashboard.platformSubtitle', 'Centralized platform for campus administration, academic scheduling, gate security, complaint resolution, and digital fee settlements.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">{t('dashboard.accountRole', 'Account Role')}</span>
              <span className="font-bold text-slate-800 capitalize">{Array.isArray(user.roles) ? user.roles.join(', ').replace(/_/g, ' ') : (user.role || 'Staff')}</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">{t('dashboard.status', 'Status')}</span>
              <span className="font-bold text-emerald-700 capitalize flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                {user.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Persistence Status Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            healthInfo?.database?.status === 'connected' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{t('dashboard.persistenceTitle', 'PostgreSQL Persistence Engine')}</h3>
              {healthInfo?.database?.status === 'connected' ? (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {t('dashboard.persistenceActive', 'Active & Persistent')}
                </span>
              ) : (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  {t('dashboard.persistenceOffline', 'Offline / Awaiting Database')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {healthInfo?.database?.status === 'connected'
                ? t('dashboard.persistenceDescActive', 'All user identities, QR tokens, fee payments, and complaint workflows are guaranteed to persist across restarts.')
                : t('dashboard.persistenceDescOffline', 'Configure DATABASE_URL in backend/.env with your Supabase PostgreSQL credentials.')}
            </p>
          </div>
        </div>
      </div>

      {/* ── ADMIN / DELEGATED ADMIN ANALYTICS ───────────────────── */}
      {(isSuperAdmin || isDelegatedAdmin) && adminMetrics && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span>{t('dashboard.liveTelemetry', 'Campus Live Intelligence & Telemetry')}</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">Live PostgreSQL Metrics</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Enrolled</span>
                <GraduationCap className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{adminMetrics.totalStudents}</div>
              <div className="text-xs text-slate-500 mt-1 font-medium">{adminMetrics.totalFaculty} Faculty · {adminMetrics.totalStaff} Operational Staff</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate Activity Today</span>
                <QrCode className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-700">{adminMetrics.movementsToday}</div>
              <div className="text-xs text-slate-500 mt-1 font-medium">{adminMetrics.gatePasses?.active || 0} currently off-campus</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Open Complaints</span>
                <MessageSquareWarning className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-3xl font-black text-amber-700">{adminMetrics.complaints?.open || 0}</div>
              <div className="text-xs text-slate-500 mt-1 font-medium">{adminMetrics.complaints?.critical || 0} critical priority</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fee Revenue</span>
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{fmtCur(adminMetrics.fees?.collected)}</div>
              <div className="text-xs text-rose-600 mt-1 font-bold">{fmtCur(adminMetrics.fees?.outstanding)} outstanding</div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUPER ADMIN SHORTCUTS ──────────────────────────────── */}
      {isSuperAdmin && (
        <div className="space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <span>Super Administrator Control Center</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/admin/administrators" className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 transition shadow-xs group">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Delegated Admins</span>
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-lg font-bold text-slate-900">Appoint & Manage</div>
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-1 group-hover:text-indigo-600 transition font-medium">
                <span>Configure scoped roles</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            <Link to="/admin/cmo-appointment" className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 transition shadow-xs group">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Complaint Officer</span>
                <MessageSquareWarning className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-lg font-bold text-slate-900">Designate CMO</div>
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-1 group-hover:text-amber-600 transition font-medium">
                <span>Exclusive authority</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            <Link to="/admin/fees" className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 transition shadow-xs group">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fees & Razorpay</span>
                <CreditCard className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-lg font-bold text-slate-900">Structures & Billing</div>
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-1 group-hover:text-indigo-600 transition font-medium">
                <span>Generate invoices & audits</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            <Link to="/admin/audit-logs" className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 transition shadow-xs group">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Audit Trail</span>
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-slate-900">Immutable Logs</div>
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-1 group-hover:text-emerald-600 transition font-medium">
                <span>View forensic records</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ── STUDENT HUB & LIVE METRICS ──────────────────────────── */}
      {isStudent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              <span>{t('dashboard.studentOverview', 'Student Overview & Academic Telemetry')}</span>
            </h2>
            <Link to="/student/portfolio" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold">
              <span>{t('dashboard.viewFullPortfolio', 'View Full Portfolio')}</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('dashboard.attendance', 'Attendance')}</span>
                <CalendarCheck2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className={`text-3xl font-black ${
                studentPortfolio?.attendance?.percentage && parseFloat(studentPortfolio.attendance.percentage) < 75
                  ? 'text-rose-700'
                  : 'text-emerald-700'
              }`}>
                {studentPortfolio?.attendance?.percentage ? `${studentPortfolio.attendance.percentage}%` : 'N/A'}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                {studentPortfolio?.attendance?.percentage && parseFloat(studentPortfolio.attendance.percentage) < 75
                  ? `⚠️ ${t('dashboard.belowThreshold', 'Below 75% threshold')}`
                  : t('dashboard.meetsRequirement', 'Meets minimum requirement')}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('dashboard.outstandingFee', 'Outstanding Fee')}</span>
                <CreditCard className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {studentPortfolio?.fees?.fees_pending ? `${studentPortfolio.fees.fees_pending} ${t('dashboard.due', 'Due')}` : t('dashboard.allPaid', 'All Paid')}
              </div>
              <Link to="/student/fees" className="text-xs text-indigo-600 hover:underline mt-1 block font-bold">
                {t('dashboard.payNowRazorpay', 'Pay with Direct Gateway →')}
              </Link>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('dashboard.gatePasses', 'Gate Passes')}</span>
                <QrCode className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {(studentPortfolio?.gatepasses || []).reduce((acc, r) => acc + Number(r.count), 0)} Total
              </div>
              <Link to="/student/gatepass" className="text-xs text-indigo-600 hover:underline mt-1 block font-bold">
                {t('dashboard.showQrCode', 'Show QR Code →')}
              </Link>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('dashboard.complaints', 'Complaints')}</span>
                <MessageSquareWarning className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {(studentPortfolio?.complaints || []).reduce((acc, r) => acc + Number(r.count), 0)} Logged
              </div>
              <Link to="/student/complaints" className="text-xs text-amber-600 hover:underline mt-1 block font-bold">
                {t('dashboard.trackStatus', 'Track status →')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY GUARD CHECKPOINT ───────────────────────────── */}
      {isGuard && (
        <div className="space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" />
            <span>Gate Security Checkpoint Telemetry</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to="/security/scanner" className="p-6 rounded-2xl bg-white border border-emerald-300 hover:border-emerald-500 transition shadow-xs group">
              <QrCode className="w-8 h-8 text-emerald-600 mb-3" />
              <div className="text-xl font-bold text-slate-900">Launch QR Camera Scanner</div>
              <p className="text-xs text-slate-500 mt-1 font-medium">Scan student passes, verify tokens, log checkouts and checkins</p>
            </Link>
            <Link to="/security/overdue" className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 transition shadow-xs group">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
                {overdueCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                    {overdueCount} Overdue
                  </span>
                )}
              </div>
              <div className="text-xl font-bold text-slate-900">Overdue Return Watchlist</div>
              <p className="text-xs text-slate-500 mt-1 font-medium">Monitor students who have not checked back in within expected hours</p>
            </Link>
          </div>
        </div>
      )}

      {/* ── RECENT CAMPUS NOTICES & BULLETINS ───────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <span>{t('dashboard.recentNotices', 'Campus Notice Board')}</span>
          </h2>
          <Link to="/notices" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold">
            <span>{t('dashboard.viewAllNotices', 'View All Notices')}</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentNotices.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-sm shadow-xs font-medium">
            No active notices currently published. Check back later.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentNotices.map((n) => (
              <div key={n.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-400 transition shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {n.notice_type || 'General'}
                  </span>
                  {n.is_pinned && <span className="text-xs">📌</span>}
                </div>
                <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{n.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{n.content}</p>
                <div className="text-[11px] text-slate-400 mt-3 font-medium">
                  {new Date(n.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
