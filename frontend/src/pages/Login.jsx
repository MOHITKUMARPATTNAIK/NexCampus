import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, ArrowRight, AlertCircle, Eye, EyeOff, Building2 } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';

export const Login = () => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStaffMode, setIsStaffMode] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(identifier, password);
      if (res.success) {
        navigate('/dashboard');
      } else {
        setError(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error. Please ensure the campus server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffQuickFill = (staffEmail, staffPass) => {
    setIdentifier(staffEmail);
    setPassword(staffPass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative font-sans">
      {/* Global Language Selector */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector />
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/60 via-slate-50 to-slate-100 pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-10 shadow-xl shadow-slate-200/60 relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/25">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('brand.name')}</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            {t('brand.tagline')}
          </p>
          {isStaffMode && (
            <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 text-white">
              Institutional Administration Portal
            </span>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {isStaffMode ? 'Staff Email' : t('auth.institutionalEmail')}
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isStaffMode ? 'staff@nexcampus.edu' : 'e.g. STU2026001 or student@nexcampus.edu'}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-11 pr-11 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 group disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{t('auth.signIn')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setForgotModal(true)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
        </form>

        {/* Staff Administration Access Toggle */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center">
          <button
            type="button"
            onClick={() => {
              setIsStaffMode(!isStaffMode);
              setError('');
            }}
            className="text-xs text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1.5 transition"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{isStaffMode ? '← Back to Student Sign In' : 'Institutional Staff & Administration Access'}</span>
          </button>

          {isStaffMode && (
            <div className="mt-4 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                Quick Staff Credentials:
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleStaffQuickFill('superadmin@nexcampus.edu', 'Admin@NexCampus2026!')}
                  className="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-slate-800 text-left transition font-medium"
                >
                  👑 Super Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleStaffQuickFill('cmo@nexcampus.edu', 'Cmo@NexCampus2026!')}
                  className="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-slate-800 text-left transition font-medium"
                >
                  🛡️ CMO Officer
                </button>
                <button
                  type="button"
                  onClick={() => handleStaffQuickFill('faculty@nexcampus.edu', 'Faculty@NexCampus2026!')}
                  className="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-slate-800 text-left transition font-medium"
                >
                  👨‍🏫 Faculty
                </button>
                <button
                  type="button"
                  onClick={() => handleStaffQuickFill('security@nexcampus.edu', 'Security@NexCampus2026!')}
                  className="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-slate-800 text-left transition font-medium"
                >
                  👮 Security Guard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Reset Password</h3>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Student and staff credentials are institutional accounts managed by the Administration.
              Please reach out to Student Affairs or the IT Helpdesk:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1 mb-6">
              <div><strong>Email:</strong> admin@nexcampus.edu</div>
              <div><strong>Office:</strong> Academic Block A, Room 102</div>
              <div><strong>Hours:</strong> Mon – Fri, 9:00 AM – 5:00 PM</div>
            </div>
            <button
              onClick={() => setForgotModal(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
