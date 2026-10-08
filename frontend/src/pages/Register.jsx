import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Building, Lock } from 'lucide-react';

export const Register = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-black text-slate-900">Institutional Provisioning Only</h1>
        <p className="text-xs text-slate-500 mt-1 mb-6">NexCampus Smart Campus Management Policy</p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left text-xs text-slate-700 space-y-3 mb-6">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>Public self-registration is disabled to ensure identity verification and data governance.</span>
          </div>
          <div className="flex items-start gap-2">
            <Building className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>Student accounts, roll numbers, and course allocations are provisioned by <strong>Student Affairs & Administration</strong>.</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          If you are an enrolled student or newly admitted scholar, please collect your official Institutional Email and temporary password from the campus registry.
        </p>

        <Link
          to="/login"
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Student Sign In</span>
        </Link>
      </div>
    </div>
  );
};

export default Register;
