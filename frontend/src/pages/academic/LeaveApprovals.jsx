import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  User,
  Calendar
} from 'lucide-react';

export const LeaveApprovals = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [rejectModalData, setRejectModalData] = useState(null); // { leaveId, studentName }
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/academic/leaves/pending');
      if (res.data.success) {
        setLeaves(res.data.leaves);
      }
    } catch (err) {
      setError('Failed to fetch leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApprove = async (leaveId) => {
    if (!window.confirm('Approve this student leave request?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.patch(`/academic/leaves/${leaveId}/review`, {
        verdict: 'approved',
        remarks: 'Approved by academic faculty authority'
      });
      if (res.data.success) {
        setSuccess('Leave request has been approved and student notified.');
        fetchLeaves();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve leave.');
    }
  };

  const handleRejectConfirm = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      return alert('A rejection reason is mandatory.');
    }
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await api.patch(`/academic/leaves/${rejectModalData.leaveId}/review`, {
        verdict: 'rejected',
        rejectionReason: rejectionReason.trim()
      });
      if (res.data.success) {
        setSuccess('Leave request has been rejected with recorded reason.');
        setRejectModalData(null);
        setRejectionReason('');
        fetchLeaves();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLeaves = leaves.filter((l) => (statusFilter ? l.status === statusFilter : true));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          <FileText className="w-6 h-6 text-blue-400" />
          <span>Student Leave Request Approvals</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Review academic leave requests, medical documents, and authorize campus departures.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {['pending', 'approved', 'rejected', 'cancelled', ''].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
              statusFilter === st
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
            }`}
          >
            {st || 'All Applications'}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Leaves Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-bold">Applicant Student</th>
                <th className="py-3.5 px-4 font-bold">Leave Window</th>
                <th className="py-3.5 px-4 font-bold">Type & Reason</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Submitted At</th>
                <th className="py-3.5 px-4 font-bold text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading student leave requests...</span>
                  </td>
                </tr>
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No leave requests found with status &quot;{statusFilter || 'any'}&quot;.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-white">{l.student_name}</div>
                      <div className="text-xs text-blue-400 font-mono">{l.roll_number}</div>
                      <div className="text-[11px] text-slate-400">{l.department_name} (Sec {l.section})</div>
                    </td>
                    <td className="py-4 px-4 text-xs">
                      <div className="font-semibold text-slate-200">
                        {new Date(l.start_date).toLocaleDateString()} — {new Date(l.end_date).toLocaleDateString()}
                      </div>
                      <div className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Academic Absence</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-semibold uppercase">
                        {l.leave_type}
                      </span>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2">{l.reason}</p>
                      {l.rejection_reason && (
                        <p className="text-[11px] text-rose-400 mt-1">Rejection Note: {l.rejection_reason}</p>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize inline-flex items-center gap-1.5 ${
                          l.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : l.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : l.status === 'cancelled'
                            ? 'bg-slate-700/50 text-slate-400 border border-slate-700'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          l.status === 'approved' ? 'bg-emerald-400' : l.status === 'pending' ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                        {l.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {l.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(l.id)}
                            className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md shadow-emerald-600/30"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModalData({ leaveId: l.id, studentName: l.student_name })}
                            className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-md shadow-rose-600/30"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Decision Recorded</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Rejection Reason Modal */}
      {rejectModalData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              <span>Mandatory Rejection Rationale</span>
            </h2>
            <p className="text-slate-400 text-xs mb-4">
              Enter the reason why {rejectModalData.studentName}&apos;s leave request is being rejected. This explanation will be shared with the student.
            </p>

            <form onSubmit={handleRejectConfirm} className="space-y-4">
              <div>
                <textarea
                  required
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Mandatory laboratory exam scheduled on the requested dates. Please reschedule."
                  className="w-full p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectModalData(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30"
                >
                  {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveApprovals;
