import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Shield, Bell, LogOut, Database, CheckCircle2, AlertTriangle, Menu, PanelLeftClose, PanelLeft } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import { useSidebar } from '../context/SidebarContext';
import api from '../services/api';

export const Navbar = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { isCollapsed, isMobileOpen, isMobile, toggleSidebar } = useSidebar();
  const [dbStatus, setDbStatus] = useState({ connected: false, loading: true });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const checkDb = async () => {
      try {
        const res = await api.get('/health');
        if (mounted) {
          setDbStatus({
            connected: res.data.database?.status === 'connected',
            database: res.data.database?.details?.database || 'PostgreSQL',
            loading: false
          });
        }
      } catch (err) {
        if (mounted) {
          setDbStatus({ connected: false, loading: false });
        }
      }
    };

    const fetchNotifications = async () => {
      if (!user) return;
      try {
        const res = await api.get('/notifications/my');
        if (mounted) {
          setUnreadCount(res.data.unread_count || 0);
        }
      } catch (err) {
        // quiet error
      }
    };

    checkDb();
    fetchNotifications();
    const interval = setInterval(() => {
      checkDb();
      fetchNotifications();
    }, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user]);

  const getPrimaryRoleBadge = () => {
    if (!user || !user.roles) return null;
    if (user.isSuperAdmin) {
      return <span className="hidden sm:inline-block bg-rose-100 text-rose-800 border border-rose-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">{t('roles.superAdmin', 'Super Admin')}</span>;
    }
    if (user.isCMO) {
      return <span className="hidden sm:inline-block bg-amber-100 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">{t('roles.cmo', 'Complaint Officer')}</span>;
    }
    if (user.roles.includes('security_guard')) {
      return <span className="hidden sm:inline-block bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">{t('roles.securityGuard', 'Security Guard')}</span>;
    }
    if (user.roles.includes('faculty')) {
      return <span className="hidden sm:inline-block bg-blue-100 text-blue-800 border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">{t('roles.faculty', 'Faculty')}</span>;
    }
    if (user.roles.includes('student')) {
      return <span className="hidden sm:inline-block bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">{t('roles.student', 'Student')}</span>;
    }
    if (user.roles.includes('delegated_admin')) {
      return <span className="hidden sm:inline-block bg-purple-100 text-purple-800 border border-purple-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">{t('roles.delegatedAdmin', 'Delegated Admin')}</span>;
    }
    return <span className="hidden sm:inline-block bg-slate-100 text-slate-800 border border-slate-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">{user.roles[0]}</span>;
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Brand & Sidebar Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Responsive Sidebar Toggle Button */}
        {user && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isMobile ? (isMobileOpen ? 'Close navigation drawer' : 'Open navigation drawer') : (isCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
            aria-expanded={isMobile ? isMobileOpen : !isCollapsed}
            aria-controls="app-sidebar"
            title={isMobile ? 'Navigation Menu' : isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition flex items-center justify-center cursor-pointer shrink-0"
          >
            {isMobile ? (
              <Menu className="w-5 h-5" />
            ) : isCollapsed ? (
              <PanelLeft className="w-5 h-5 text-indigo-600" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        )}

        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-black text-lg tracking-tight text-slate-900">
            NexCampus
          </span>
          <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            2026
          </span>
        </div>
      </div>

      {/* Right Tools & User Info */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Global Language Selector */}
        <LanguageSelector />

        {/* Persistence Status Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <Database className="w-3.5 h-3.5 text-indigo-600" />
          <span>{t('nav.storage', 'Storage')}:</span>
          {dbStatus.loading ? (
            <span className="text-slate-400 text-[11px]">{t('common.loading', 'checking...')}</span>
          ) : dbStatus.connected ? (
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('nav.persistentPg', 'Persistent PG')}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 font-semibold" title="Connecting...">
              <AlertTriangle className="w-3.5 h-3.5" /> {t('common.offline', 'Offline')}
            </span>
          )}
        </div>

        {/* Notifications Icon Button */}
        {user && (
          <Link
            to="/notifications"
            title={t('nav.notifications', 'Notifications')}
            className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        )}

        {/* User Badges */}
        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-slate-900 leading-tight">{user.fullName}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            {getPrimaryRoleBadge()}
            <button
              onClick={logout}
              title={t('nav.signOut', 'Sign Out')}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
