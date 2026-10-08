import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Lock, ShieldAlert } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles = [], requiredPermission = null, requireCMO: needsCMO = false }) => {
  const { user, token, loading, hasRole, hasPermission, isCMO } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold tracking-wide">Connecting to NexCampus...</p>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Account status check
  if (user.status === 'suspended' || user.status === 'deactivated') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Account Restricted</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Your account status is currently <span className="font-bold text-rose-600 uppercase">{user.status}</span>. Access to NexCampus modules has been temporarily revoked by the Super Administrator.
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Super Admin bypasses role checks
  if (user.isSuperAdmin) {
    return children;
  }

  // CMO-only routes
  if (needsCMO && !isCMO && !user.isSuperAdmin && !hasRole('delegated_admin')) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">CMO Authority Required</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            This operational module is restricted to designated Complaint Management Officers appointed by the Super Administrator.
          </p>
          <a
            href="/dashboard"
            className="inline-block py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
          >
            Back to My Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Check required roles
  if (allowedRoles.length > 0) {
    const isAuthorized = allowedRoles.some((role) => hasRole(role));
    if (!isAuthorized) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-amber-200 rounded-2xl p-8 text-center shadow-xl">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Unauthorized Access</h2>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Your account does not possess the delegated role authority required to view this operational section.
            </p>
            <a
              href="/dashboard"
              className="inline-block py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
            >
              Back to My Dashboard
            </a>
          </div>
        </div>
      );
    }
  }

  // Check required permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Permission Denied</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Missing required permission: <code className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono font-bold">{requiredPermission}</code>
          </p>
          <a
            href="/dashboard"
            className="inline-block py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
          >
            Back to My Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
