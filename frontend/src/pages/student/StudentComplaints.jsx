import { useState, useEffect } from 'react';
import { MessageSquareWarning, Plus, Clock, CheckCircle, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const PRIORITY_CONFIG = {
  low:      { label: 'Low',      color: 'gray'   },
  medium:   { label: 'Medium',   color: 'blue'   },
  high:     { label: 'High',     color: 'orange' },
  critical: { label: 'Critical', color: 'red'    },
};

const STATUS_CONFIG = {
  open:        { label: 'Open',        icon: Clock,                 color: 'yellow' },
  in_progress: { label: 'In Progress', icon: AlertTriangle,         color: 'blue'   },
  resolved:    { label: 'Resolved',    icon: CheckCircle,           color: 'green'  },
  closed:      { label: 'Closed',      icon: CheckCircle,           color: 'gray'   },
  escalated:   { label: 'Escalated',   icon: AlertTriangle,         color: 'red'    },
  rejected:    { label: 'Rejected',    icon: XCircle,               color: 'red'    },
};

export default function StudentComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category_id: '', title: '', description: '', location: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, catRes] = await Promise.all([
        api.get('/complaints/my-complaints'),
        api.get('/complaints/categories'),
      ]);
      setComplaints(compRes.data.complaints || []);
      setCategories(catRes.data.categories || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await api.post('/complaints', form);
      setSuccess('Complaint submitted successfully! We will review it shortly.');
      setShowForm(false);
      setForm({ category_id: '', title: '', description: '', location: '', priority: 'medium' });
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
    const Icon = cfg.icon;
    const colorMap = {
      yellow: 'bg-yellow-100 text-yellow-700',
      blue:   'bg-blue-100 text-blue-700',
      green:  'bg-green-100 text-green-700',
      gray:   'bg-gray-100 text-gray-600',
      red:    'bg-red-100 text-red-700',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colorMap[cfg.color]}`}>
        <Icon className="w-3 h-3" />{cfg.label}
      </span>
    );
  };

  const PriorityBadge = ({ priority }) => {
    const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
    const colorMap = {
      gray:   'bg-gray-100 text-gray-600',
      blue:   'bg-blue-100 text-blue-700',
      orange: 'bg-orange-100 text-orange-700',
      red:    'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorMap[cfg.color]}`}>{cfg.label}</span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquareWarning className="w-7 h-7 text-amber-600" />
          <h1 className="text-2xl font-bold text-gray-900">My Complaints</h1>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(''); setSuccess(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Complaint
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

      {/* Submission Form */}
      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Submit a New Complaint</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">Select category (optional)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief summary of the issue" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea required rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue in detail — what happened, when, how often..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Building, room, or area (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="px-6 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">{submitting ? 'Submitting...' : 'Submit Complaint'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Complaints List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading your complaints...</div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessageSquareWarning className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No complaints submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-gray-400">{c.complaint_number}</span>
                    <StatusBadge status={c.status} />
                    <PriorityBadge priority={c.priority} />
                    {c.category_name && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{c.category_name}</span>}
                  </div>
                  <div className="font-semibold text-gray-900 mt-1">{c.title}</div>
                  <div className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</div>
                  {c.location && <div className="text-xs text-gray-400 mt-1">📍 {c.location}</div>}
                  {c.latest_update && (
                    <div className="text-xs text-blue-600 mt-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                      💬 Latest update: {c.latest_update}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">Submitted: {fmt(c.created_at)}</div>
                  {c.assigned_cmo_name && <div className="text-xs text-gray-500">Handled by: {c.assigned_cmo_name}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
