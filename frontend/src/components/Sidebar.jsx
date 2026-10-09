import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  GraduationCap,
  CalendarCheck2,
  Clock,
  QrCode,
  CreditCard,
  MessageSquareWarning,
  Bell,
  FileText,
  Sliders,
  Award,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  X,
  Shield,
  BookOpen,
  Layers
} from 'lucide-react';

const NavItem = ({ to, icon: Icon, label, badge, isCollapsed, onClick }) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={({ isActive }) =>
        `relative group flex items-center transition-all duration-200 ${
          isCollapsed
            ? 'justify-center w-11 h-11 mx-auto rounded-xl'
            : 'gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium w-full'
        } ${
          isActive
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`
      }
    >
      <Icon className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} shrink-0`} />
      {!isCollapsed && <span className="truncate">{label}</span>}
      {!isCollapsed && badge && (
        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
          {badge}
        </span>
      )}

      {/* Floating Tooltip in Collapsed Desktop Mode */}
      {isCollapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition whitespace-nowrap z-50">
          {label}
        </span>
      )}
    </NavLink>
  );
};

const SectionHeader = ({ title, isCollapsed, color = 'text-slate-400' }) => {
  if (isCollapsed) {
    return <div className="my-2.5 mx-2 border-t border-slate-200/80" title={title} />;
  }
  return (
    <div className={`text-[11px] font-bold uppercase tracking-wider ${color} px-3 mb-1.5 flex items-center justify-between`}>
      <span>{title}</span>
    </div>
  );
};

export const Sidebar = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isCollapsed, isMobileOpen, isMobile, closeMobileSidebar, toggleCollapse } = useSidebar();

  if (!user) return null;

  const isSuperAdmin = user.isSuperAdmin;
  const isCMO = user.isCMO;
  const isStudent = user.roles?.includes('student') || user.role === 'student';
  const isFaculty = user.roles?.includes('faculty') || user.role === 'faculty';
  const isGuard = user.roles?.includes('security_guard') || user.role === 'security_guard';
  const isStaff = user.roles?.some((r) => ['hostel_warden', 'mess_staff', 'maintenance_staff'].includes(typeof r === 'string' ? r : r?.name));
  const isDelegatedAdmin = user.roles?.includes('delegated_admin') || user.role === 'delegated_admin';

  const handleLinkClick = () => {
    if (isMobile) {
      closeMobileSidebar();
    }
  };

  const renderNavContent = (collapsed) => (
    <>
      {/* General Section */}
      <div>
        <SectionHeader title={t('sidebar.general', 'General')} isCollapsed={collapsed} />
        <nav className="flex flex-col gap-1">
          <NavItem to="/dashboard" icon={LayoutDashboard} label={t('nav.dashboard', 'Dashboard')} isCollapsed={collapsed} onClick={handleLinkClick} />
          <NavItem to="/courses" icon={GraduationCap} label={t('nav.courses', 'Courses')} isCollapsed={collapsed} onClick={handleLinkClick} />
          <NavItem to="/notices" icon={Bell} label={t('nav.notices', 'Campus Notices')} isCollapsed={collapsed} onClick={handleLinkClick} />
          <NavItem to="/documents" icon={FolderOpen} label={t('nav.documents', 'Documents & Vault')} isCollapsed={collapsed} onClick={handleLinkClick} />
          <NavItem to="/notifications" icon={Bell} label={t('nav.notifications', 'Notifications')} isCollapsed={collapsed} onClick={handleLinkClick} />
        </nav>
      </div>

      {/* Super Admin & Delegation Section */}
      {(isSuperAdmin || isDelegatedAdmin) && (
        <div>
          <SectionHeader title={t('sidebar.administration', 'Administration')} isCollapsed={collapsed} color="text-rose-600" />
          <nav className="flex flex-col gap-1">
            <NavItem to="/admin/administrators" icon={Users} label={t('nav.delegatedAdmins', 'Delegated Admins')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/admin/courses" icon={Layers} label={t('nav.courseManagement', 'Course Management')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/admin/cmo-appointment" icon={ShieldAlert} label={t('nav.cmoAppointment', 'Appoint CMO')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/admin/staff" icon={Users} label={t('nav.staffLifecycle', 'Staff Lifecycle')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/admin/students" icon={GraduationCap} label={t('nav.studentDirectory', 'Student Directory')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/admin/faculty" icon={Users} label={t('nav.facultyDirectory', 'Faculty Directory')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/admin/audit-logs" icon={FileText} label={t('nav.auditLogs', 'Audit Logs')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/admin/fees" icon={CreditCard} label={t('nav.feeManagement', 'Fee Management')} isCollapsed={collapsed} onClick={handleLinkClick} />
          </nav>
        </div>
      )}

      {/* Centralized Complaints & CMO Module */}
      {(isCMO || isSuperAdmin || isStaff) && (
        <div>
          <SectionHeader title={t('sidebar.complaintDesk', 'Complaint Desk (CMO)')} isCollapsed={collapsed} color="text-amber-600" />
          <nav className="flex flex-col gap-1">
            <NavItem to="/cmo/dashboard" icon={MessageSquareWarning} label={t('nav.complaintDeskNav', 'Complaint Desk')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/cmo/triage" icon={Sliders} label={t('nav.triage', 'Triage & Assignment')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/cmo/verification" icon={CalendarCheck2} label={t('nav.verification', 'Resolution Proofs')} isCollapsed={collapsed} onClick={handleLinkClick} />
          </nav>
        </div>
      )}

      {/* Academic & Faculty Section */}
      {(isFaculty || isSuperAdmin || isDelegatedAdmin) && (
        <div>
          <SectionHeader title={t('sidebar.academicOps', 'Academic Operations')} isCollapsed={collapsed} color="text-blue-600" />
          <nav className="flex flex-col gap-1">
            <NavItem to="/academic/attendance" icon={CalendarCheck2} label={t('nav.markAttendance', 'Mark Attendance')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/academic/timetables" icon={Clock} label={t('nav.timetables', 'Timetable Scheduler')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/academic/leaves" icon={FileText} label={t('nav.leaveApprovals', 'Leave Approvals')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/academic/gatepasses" icon={QrCode} label={t('nav.gatepassApprovals', 'Gate Pass Approvals')} isCollapsed={collapsed} onClick={handleLinkClick} />
          </nav>
        </div>
      )}

      {/* Security Guard Section */}
      {(isGuard || isSuperAdmin || isDelegatedAdmin) && (
        <div>
          <SectionHeader title={t('sidebar.physicalSecurity', 'Physical Security')} isCollapsed={collapsed} color="text-emerald-600" />
          <nav className="flex flex-col gap-1">
            <NavItem to="/security/scanner" icon={QrCode} label={t('nav.qrScanner', 'QR Gate Scanner')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/security/movements" icon={Clock} label={t('nav.movements', 'Gate Movement Logs')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/security/overdue" icon={ShieldAlert} label={t('nav.overdue', 'Overdue Exceptions')} isCollapsed={collapsed} onClick={handleLinkClick} />
          </nav>
        </div>
      )}

      {/* Student Portal */}
      {isStudent && (
        <div>
          <SectionHeader title={t('sidebar.studentPortal', 'Student Portal')} isCollapsed={collapsed} color="text-indigo-600" />
          <nav className="flex flex-col gap-1">
            <NavItem to="/student/my-learning" icon={BookOpen} label={t('nav.myLearning', 'My Learning')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/student/gatepass" icon={QrCode} label={t('nav.gatepass', 'Digital Gate-Pass')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/student/fees" icon={CreditCard} label={t('nav.fees', 'Fees & Payments')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/student/complaints" icon={MessageSquareWarning} label={t('nav.complaints', 'Submit Complaint')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/student/attendance" icon={CalendarCheck2} label={t('nav.attendance', 'My Attendance')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/student/leaves" icon={Clock} label={t('nav.leaveApplication', 'Leave Application')} isCollapsed={collapsed} onClick={handleLinkClick} />
            <NavItem to="/student/portfolio" icon={Award} label={t('nav.myPortfolio', 'My Portfolio')} isCollapsed={collapsed} onClick={handleLinkClick} />
          </nav>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. DESKTOP / LAPTOP RESPONSIVE SIDEBAR (>= 1024px)            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <aside
        id="app-sidebar"
        aria-label="Application navigation"
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out shrink-0 select-none ${
          isCollapsed ? 'w-[72px] p-2.5' : 'w-64 p-4'
        }`}
      >
        <div className="flex-1 flex flex-col gap-5">
          {renderNavContent(isCollapsed)}
        </div>

        {/* Desktop Bottom Collapse Toggle Button */}
        <div className="pt-3 border-t border-slate-200/80 mt-auto">
          <button
            type="button"
            onClick={toggleCollapse}
            title={isCollapsed ? t('sidebar.expandTooltip', 'Expand sidebar (Ctrl+B)') : t('sidebar.collapseTooltip', 'Collapse sidebar (Ctrl+B)')}
            aria-label={isCollapsed ? t('sidebar.expandSidebar', 'Expand sidebar') : t('sidebar.collapseSidebar', 'Collapse sidebar')}
            className={`flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition w-full py-2.5 cursor-pointer ${
              isCollapsed ? 'justify-center' : 'px-3 gap-3'
            }`}
          >
            {isCollapsed ? (
              <PanelLeft className="w-4 h-4 text-indigo-600" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>{t('sidebar.collapseSidebar', 'Collapse Sidebar')}</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. TABLET / MOBILE OFF-CANVAS DRAWER (< 1024px)               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Backdrop */}
      {isMobileOpen && (
        <div
          onClick={closeMobileSidebar}
          aria-hidden="true"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300 animate-in fade-in cursor-pointer"
        />
      )}

      {/* Drawer */}
      <aside
        id="app-sidebar-mobile"
        aria-label="Mobile navigation drawer"
        aria-hidden={!isMobileOpen}
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col h-full lg:hidden transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        {/* Drawer Header */}
        <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-600/20">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-black text-slate-900 tracking-tight">NexCampus</span>
              <span className="ml-1.5 text-[9px] uppercase font-bold tracking-widest px-1 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                2026
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={closeMobileSidebar}
            aria-label="Close navigation drawer"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Navigation List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {renderNavContent(false)}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
