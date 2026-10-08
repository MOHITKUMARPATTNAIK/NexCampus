import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, Users, TrendingUp, XCircle, ChevronDown } from 'lucide-react';
import api from '../../services/api';

const PRIORITY_COLORS = {
  critical: 'border-red-400 bg-red-50',
  high:     'border-orange-400 bg-orange-50',
  medium:   'border-blue-200 bg-white',
  low:      'border-gray-200 bg-white',
};

const STATUS_OPTS = ['open', 'in_progress', 'resolved', 'closed', 'escalated', 'rejected'];
const PRIORITY_OPTS = ['critical', 'high', 'medium', 'low'];

export default function CMODashboard() {
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active complaint management
  const [activeComplaint, setActiveComplaint] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [statusAction, setStatusAction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statRes, catRes] = await Promise.all([
        api.get('/complaints/stats'),
        api.get('/complaints/categories'),
      ]);
      setStats(statRes.data.stats);
      setCategories(catRes.data.categories || []);
      await loadComplaints();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadComplaints = async (overrideFilters) => {
    const f = overrideFilters || filters;
    try {
      const params = {};
      if (f.status)   params.status   = f.status;
      if (f.priority) params.priority = f.priority;
      const res = await api.get('/complaints', { params });
      setComplaints(res.data.complaints || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load complaints');
    }
  };

  const openComplaintDetail = async (complaint) => {
    setDetailLoading(true);
    setActiveComplaint(null);
    setUpdateText('');
    setEscalateReason('');
    setStatusAction('');
    setError('');
    setSuccess('');
    try {
      const res = await api.get(`/complaints/${complaint.id}`);
      setActiveComplaint(res.data);
    } catch (err) {
      setError('Failed to load complaint details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!updateText.trim() || !activeComplaint) return;
    setActionLoading(true); setError('');
    try {
      await api.post(`/complaints/${activeComplaint.complaint.id}/update`, { update_text: updateText });
      setSuccess('Update added');
      setUpdateText('');
      openComplaintDetail(activeComplaint.complaint);
      loadComplaints();
    } catch (err) { setError(err.response?.data?.error || 'Failed'); } finally { setActionLoading(false); }
  };

  const handleStatusChange = async (newStatus) => {
    if (!activeComplaint) return;
    setActionLoading(true); setError('');
    try {
      await api.patch(`/complaints/${activeComplaint.complaint.id}/status`, {
        status: newStatus,
        update_text: updateText || `Status changed to: ${newStatus}`,
        resolution_notes: newStatus === 'resolved' ? updateText : undefined,
      });
      setSuccess(`Status updated to: ${newStatus}`);
      setUpdateText('');
      openComplaintDetail(activeComplaint.complaint);
      loadComplaints();
      loadAll();
    } catch (err) { setError(err.response?.data?.error || 'Failed'); } finally { setActionLoading(false); }
  };

  const handleEscalate = async () => {
    if (!escalateReason.trim() || !activeComplaint) return;
    setActionLoading(true); setError('');
    try {
      await api.post(`/complaints/${activeComplaint.complaint.id}/escalate`, { reason: escalateReason });
      setSuccess('Complaint escalated');
      setEscalateReason('');
      openComplaintDetail(activeComplaint.complaint);
      loadComplaints();
      loadAll();
    } catch (err) { setError(err.response?.data?.error || 'Failed'); } finally { setActionLoading(false); }
  };

  const handleReopen = async () => {
    if (!updateText.trim() || !activeComplaint) return;
    setActionLoading(true); setError('');
    try {
      await api.post(`/complaints/${activeComplaint.complaint.id}/reopen`, { reason: updateText });
      setSuccess('Complaint reopened');
      setUpdateText('');
      openComplaintDetail(activeComplaint.complaint);
      loadComplaints();
      loadAll();
    } catch (err) { setError(err.response?.data?.error || 'Failed'); } finally { setActionLoading(false); }
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

  const PriorityBadge = ({ p }) => {
    const colorMap = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${colorMap[p] || colorMap.medium}`}>{p}</span>;
  };

  const StatusBadge = ({ s }) => {
    const colorMap = { open: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700', resolved: 'bg-green-100 text-green-700', escalated: 'bg-red-100 text-red-700', closed: 'bg-gray-100 text-gray-600', rejected: 'bg-red-100 text-red-700' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${colorMap[s] || colorMap.open}`}>{s?.replace('_', ' ')}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CMO — Complaint Dashboard</h1>
            <p className="text-sm text-gray-500">Complaint Management Officer Control Center</p>
          </div>
        </div>
        <button onClick={loadAll} className="text-sm text-amber-600 hover:underline">↻ Refresh</button>
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Open',        value: stats.open_count,        color: 'yellow', icon: Clock },
            { label: 'In Progress', value: stats.in_progress_count, color: 'blue',   icon: AlertTriangle },
            { label: 'Critical',    value: stats.critical_count,    color: 'red',    icon: XCircle },
            { label: 'Resolved',    value: stats.resolved_count,    color: 'green',  icon: CheckCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 text-${color}-500`} />
                <span className="text-xs font-medium uppercase text-gray-500">{label}</span>
              </div>
              <div className={`text-3xl font-bold text-${color}-600`}>{value || 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-6">
        {/* Left: Complaint List */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <select
              value={filters.status}
              onChange={e => { const f = { ...filters, status: e.target.value }; setFilters(f); loadComplaints(f); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <select
              value={filters.priority}
              onChange={e => { const f = { ...filters, priority: e.target.value }; setFilters(f); loadComplaints(f); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">All Priorities</option>
              {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading complaints...</div>
          ) : complaints.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">No complaints match the selected filters.</div>
          ) : (
            <div className="space-y-2">
              {complaints.map(c => (
                <div
                  key={c.id}
                  onClick={() => openComplaintDetail(c)}
                  className={`rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${PRIORITY_COLORS[c.priority]} ${activeComplaint?.complaint?.id === c.id ? 'ring-2 ring-amber-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-gray-400">{c.complaint_number}</span>
                        <StatusBadge s={c.status} />
                        <PriorityBadge p={c.priority} />
                      </div>
                      <div className="font-medium text-gray-900 truncate">{c.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{c.submitted_by_name} · {fmt(c.created_at)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        {(activeComplaint || detailLoading) && (
          <div className="w-96 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {detailLoading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : activeComplaint && (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs text-gray-400">{activeComplaint.complaint.complaint_number}</div>
                    <h2 className="font-bold text-gray-900 mt-1">{activeComplaint.complaint.title}</h2>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <StatusBadge s={activeComplaint.complaint.status} />
                      <PriorityBadge p={activeComplaint.complaint.priority} />
                    </div>
                  </div>
                  <button onClick={() => setActiveComplaint(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{activeComplaint.complaint.description}</div>

                <div className="text-xs text-gray-500 space-y-1">
                  <div><strong>Submitted by:</strong> {activeComplaint.complaint.submitted_by_name}</div>
                  {activeComplaint.complaint.location && <div><strong>Location:</strong> {activeComplaint.complaint.location}</div>}
                  {activeComplaint.complaint.category_name && <div><strong>Category:</strong> {activeComplaint.complaint.category_name}</div>}
                  <div><strong>Date:</strong> {fmt(activeComplaint.complaint.created_at)}</div>
                  {activeComplaint.complaint.assigned_cmo_name && <div><strong>Assigned CMO:</strong> {activeComplaint.complaint.assigned_cmo_name}</div>}
                </div>

                {/* Timeline */}
                {activeComplaint.updates?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Timeline</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activeComplaint.updates.map(u => (
                        <div key={u.id} className="text-xs bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-700">{u.author_name}</span>
                            <span className="text-gray-400">{new Date(u.created_at).toLocaleString()}</span>
                          </div>
                          <div className="text-gray-600">{u.update_text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Update */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Add Update / Note</h3>
                  <textarea
                    rows={2}
                    value={updateText}
                    onChange={e => setUpdateText(e.target.value)}
                    placeholder="Type update or resolution notes..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button onClick={handleAddUpdate} disabled={actionLoading || !updateText.trim()} className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">Add Note</button>
                    {!['resolved','closed'].includes(activeComplaint.complaint.status) && (
                      <button onClick={() => handleStatusChange('resolved')} disabled={actionLoading} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">✓ Mark Resolved</button>
                    )}
                    {!['closed'].includes(activeComplaint.complaint.status) && (
                      <button onClick={() => handleStatusChange('closed')} disabled={actionLoading} className="px-3 py-1.5 bg-gray-400 text-white rounded-lg text-xs font-medium disabled:opacity-50">Close</button>
                    )}
                    {['resolved','closed'].includes(activeComplaint.complaint.status) && (
                      <button onClick={handleReopen} disabled={actionLoading || !updateText.trim()} className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">↺ Reopen</button>
                    )}
                  </div>
                </div>

                {/* Escalate */}
                {!['escalated','resolved','closed'].includes(activeComplaint.complaint.status) && (
                  <div className="border-t border-gray-100 pt-3">
                    <h3 className="text-xs font-semibold uppercase text-red-500 mb-2">Escalate to Admin</h3>
                    <textarea
                      rows={2}
                      value={escalateReason}
                      onChange={e => setEscalateReason(e.target.value)}
                      placeholder="Reason for escalation..."
                      className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                    <button onClick={handleEscalate} disabled={actionLoading || !escalateReason.trim()} className="mt-2 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 w-full">⚠ Escalate Complaint</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
