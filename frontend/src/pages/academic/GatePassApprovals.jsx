import { useState, useEffect } from 'react';
import { ClipboardCheck, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import api from '../../services/api';

const TABS = [
  { key: 'pending',  label: 'Pending',  color: 'yellow' },
  { key: 'approved', label: 'Approved', color: 'blue'   },
  { key: 'rejected', label: 'Rejected', color: 'red'    },
];

export default function GatePassApprovals() {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectModal, setRejectModal] = useState(null); // { passId, passNumber }
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadPasses(); }, []);

  const loadPasses = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/security/gate-passes/pending', {
        params: { status: 'all' }
      });
      setPasses(res.data.passes || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load gate passes');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (passId, passNumber) => {
    if (!confirm(`Approve gate pass ${passNumber}?`)) return;
    setActionLoading(true);
    setError('');
    try {
      await api.patch(`/security/gate-passes/${passId}/review`, { verdict: 'approved' });
      setSuccess(`Gate pass ${passNumber} approved.`);
      loadPasses();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) { setError('Rejection reason is required.'); return; }
    setActionLoading(true);
    setError('');
    try {
      await api.patch(`/security/gate-passes/${rejectModal.passId}/review`, {
        verdict: 'rejected',
        rejectionReason: rejectReason.trim(),
        rejection_reason: rejectReason.trim()
      });
      setSuccess(`Gate pass ${rejectModal.passNumber} rejected.`);
      setRejectModal(null);
      setRejectReason('');
      loadPasses();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = passes.filter(p => (t.key === 'approved' ? (p.status === 'approved' || p.status === 'active') : p.status === t.key)).length;
    return acc;
  }, {});

  const visible = passes.filter(p => (activeTab === 'approved' ? (p.status === 'approved' || p.status === 'active') : p.status === activeTab));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Gate Pass Approvals</h1>
        </div>
        <button onClick={loadPasses} className="text-sm text-blue-600 hover:underline font-medium">↻ Refresh</button>
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Reject Gate Pass</h2>
            <p className="text-sm text-gray-500 mb-4">Pass: <span className="font-mono font-medium">{rejectModal.passNumber}</span></p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Provide a clear reason for rejection..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={handleRejectSubmit}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); setError(''); }}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${tab.key === 'pending' ? 'bg-yellow-100 text-yellow-700' : tab.key === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pass Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading gate passes...</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
          No {activeTab} gate passes.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(pass => (
            <div key={pass.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm font-semibold text-gray-600">{pass.pass_number}</span>
                    <span className="text-sm font-semibold text-gray-900">{pass.student_name}</span>
                    {pass.roll_number && <span className="text-xs text-gray-400 font-mono">{pass.roll_number}</span>}
                  </div>
                  <div className="text-gray-700">{pass.reason}</div>
                  {pass.destination && <div className="text-sm text-gray-500 mt-0.5">📍 {pass.destination}</div>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-2">
                    <span>🕐 Departs: {fmt(pass.departure_time)}</span>
                    <span>🔄 Returns by: {fmt(pass.expected_return_time)}</span>
                    <span>📅 Submitted: {fmt(pass.created_at)}</span>
                  </div>
                  {pass.rejection_reason && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      <strong>Rejection reason:</strong> {pass.rejection_reason}
                    </div>
                  )}
                  {pass.reviewed_by_name && (
                    <div className="mt-1 text-xs text-gray-400">
                      Reviewed by {pass.reviewed_by_name} at {fmt(pass.reviewed_at)}
                    </div>
                  )}
                </div>
                {activeTab === 'pending' && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(pass.id, pass.pass_number)}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => { setRejectModal({ passId: pass.id, passNumber: pass.pass_number }); setError(''); }}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
