import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarCheck2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  PieChart
} from 'lucide-react';

export const StudentAttendance = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const res = await api.get('/academic/attendance/student-summary');
        if (res.data.success) {
          setSummary(res.data.summary);
        }
      } catch (err) {
        setError('Failed to fetch your attendance records.');
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          <CalendarCheck2 className="w-6 h-6 text-indigo-400" />
          <span>My Attendance Performance</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Subject-wise lecture attendance, aggregate percentages, and examination eligibility tracking.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Calculating your persistent attendance records...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      ) : summary ? (
        <>
          {/* Low Attendance Alert Banner */}
          {summary.isShortage && (
            <div className="p-5 rounded-3xl bg-rose-950/40 border border-rose-500/40 text-rose-200 flex items-start gap-4 shadow-xl">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">
                  Critical Attendance Shortage Warning ({summary.overallPercentage}%)
                </h3>
                <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                  Your overall campus attendance is below the mandatory <strong>75%</strong> institutional threshold.
                  Immediate remediation is advised to avoid academic debarment from semester final examinations.
                </p>
              </div>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Overall Percentage</div>
              <div className={`text-4xl font-black ${
                summary.overallPercentage >= 75 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {summary.overallPercentage}%
              </div>
              <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                {summary.overallPercentage >= 75 ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Exam Eligible
                  </span>
                ) : (
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Shortage
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Lectures Attended</div>
              <div className="text-4xl font-black text-white">{summary.totalAttended}</div>
              <div className="text-xs text-slate-400 mt-2">Sessions marked present</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Classes Held</div>
              <div className="text-4xl font-black text-white">{summary.totalSessions}</div>
              <div className="text-xs text-slate-400 mt-2">Recorded by faculty</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Required Benchmark</div>
              <div className="text-4xl font-black text-indigo-400">75.0%</div>
              <div className="text-xs text-slate-400 mt-2">UGC & University Policy</div>
            </div>
          </div>

          {/* Subject Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <span className="font-extrabold text-white text-base">Subject-Wise Attendance Breakdown</span>
              <span className="text-xs text-slate-400">All registered course modules</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Subject Code</th>
                    <th className="py-3.5 px-4 font-bold">Course Title</th>
                    <th className="py-3.5 px-4 font-bold text-center">Conducted</th>
                    <th className="py-3.5 px-4 font-bold text-center">Attended</th>
                    <th className="py-3.5 px-4 font-bold text-center">Percentage</th>
                    <th className="py-3.5 px-4 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {summary.subjects.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        No subject attendance recorded yet this semester.
                      </td>
                    </tr>
                  ) : (
                    summary.subjects.map((sub) => {
                      const pct = parseFloat(sub.attendance_percentage || '0');
                      const isSubShort = pct < 75.0;
                      return (
                        <tr key={sub.subject_id} className="hover:bg-slate-800/40 transition">
                          <td className="py-4 px-4 font-mono font-semibold text-indigo-300 text-xs">
                            {sub.subject_code}
                          </td>
                          <td className="py-4 px-4 font-semibold text-white">
                            {sub.subject_name}
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-slate-300">
                            {sub.total_sessions}
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-emerald-400">
                            {sub.present_sessions}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`font-black text-sm ${isSubShort ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {sub.attendance_percentage}%
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5 ${
                                isSubShort
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isSubShort ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                              {isSubShort ? 'Shortage Warning' : 'Satisfactory'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default StudentAttendance;
