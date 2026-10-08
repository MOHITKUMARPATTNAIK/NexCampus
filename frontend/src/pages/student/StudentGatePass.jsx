import { useState, useEffect } from 'react';
import { QrCode, Clock, CheckCircle, XCircle, Plus, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',  color: 'yellow', icon: Clock },
  approved:  { label: 'Approved', color: 'blue',   icon: CheckCircle },
  rejected:  { label: 'Rejected', color: 'red',    icon: XCircle },
  active:    { label: 'Active — Out',   color: 'orange', icon: AlertCircle },
  completed: { label: 'Completed',      color: 'green',  icon: CheckCircle },
  cancelled: { label: 'Cancelled',      color: 'gray',   icon: XCircle },
};

export default function StudentGatePass() {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reason: '', departure_time: '', expected_return_time: '', destination: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPass, setSelectedPass] = useState(null);

  useEffect(() => { loadPasses(); }, []);

  const loadPasses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/security/gate-passes/my-passes');
      setPasses(res.data.passes || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load gate passes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/security/gate-passes/request', form);
      setSuccess('Gate pass request submitted successfully!');
      setShowForm(false);
      setForm({ reason: '', departure_time: '', expected_return_time: '', destination: '' });
      loadPasses();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (passId) => {
    if (!confirm('Cancel this gate pass request?')) return;
    try {
      await api.patch(`/security/gate-passes/${passId}/cancel`);
      loadPasses();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';
  const fmtInput = (dt) => dt ? new Date(dt).toISOString().slice(0, 16) : '';

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-${cfg.color}-100 text-${cfg.color}-700`}>
        <Icon className="w-3 h-3" />{cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <QrCode className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">My Gate Passes</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(''); setSuccess(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Request Gate Pass
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

      {/* Request Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Gate Pass Request</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={form.departure_time}
                  min={fmtInput(new Date())}
                  onChange={e => setForm(f => ({ ...f, departure_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Return Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={form.expected_return_time}
                  min={form.departure_time || fmtInput(new Date())}
                  onChange={e => setForm(f => ({ ...f, expected_return_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                required
                value={form.destination}
                onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                placeholder="Where are you going?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <textarea
                required
                rows={3}
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Describe the purpose of this gate pass request..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedPass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Gate Pass QR Code</h2>
            <p className="text-sm text-gray-500 mb-4">Show this to the security guard</p>
            {selectedPass.qr_code_data_url ? (
              <img
                src={selectedPass.qr_code_data_url}
                alt="Gate Pass QR Code"
                className="mx-auto w-48 h-48 border-4 border-blue-600 rounded-xl mb-4"
              />
            ) : (
              <div className="w-48 h-48 mx-auto bg-gray-100 rounded-xl flex items-center justify-center mb-4 border-2 border-dashed border-gray-300">
                <p className="text-gray-400 text-sm text-center px-4">QR Code not available yet</p>
              </div>
            )}
            <div className="text-left space-y-1.5 text-sm bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Pass No.</span><span className="font-mono font-medium">{selectedPass.pass_number}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Departs</span><span>{fmt(selectedPass.departure_time)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Returns by</span><span>{fmt(selectedPass.expected_return_time)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Destination</span><span>{selectedPass.destination || '—'}</span></div>
            </div>
            <button
              onClick={() => setSelectedPass(null)}
              className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pass List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading your gate passes...</div>
        ) : passes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No gate pass requests yet.</p>
          </div>
        ) : (
          passes.map(pass => (
            <div key={pass.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm font-semibold text-gray-600">{pass.pass_number}</span>
                    <StatusBadge status={pass.status} />
                  </div>
                  <div className="text-gray-900 font-medium">{pass.reason}</div>
                  {pass.destination && <div className="text-sm text-gray-500 mt-0.5">📍 {pass.destination}</div>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-2">
                    <span>🕐 Departs: {fmt(pass.departure_time)}</span>
                    <span>🔄 Returns by: {fmt(pass.expected_return_time)}</span>
                  </div>
                  {pass.rejection_reason && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      <strong>Rejection reason:</strong> {pass.rejection_reason}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {pass.status === 'approved' && pass.qr_code_data_url && (
                    <button
                      onClick={() => setSelectedPass(pass)}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      <QrCode className="w-4 h-4" /> Show QR
                    </button>
                  )}
                  {pass.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(pass.id)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
