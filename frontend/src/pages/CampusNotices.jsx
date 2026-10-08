import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Pin, Tag, Plus, Archive, Edit2, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TYPE_COLORS = {
  general:     'bg-blue-100 text-blue-700',
  academic:    'bg-purple-100 text-purple-700',
  hostel:      'bg-yellow-100 text-yellow-700',
  fees:        'bg-green-100 text-green-700',
  security:    'bg-red-100 text-red-700',
  maintenance: 'bg-orange-100 text-orange-700',
  event:       'bg-indigo-100 text-indigo-700',
};

const PRIORITY_COLORS = {
  low:    'border-l-gray-300',
  normal: 'border-l-blue-400',
  high:   'border-l-orange-500',
  urgent: 'border-l-red-600',
};

export default function CampusNotices() {
  const { t } = useTranslation();
  const { user, hasRole } = useAuth();
  const canPublish = hasRole('super_admin') || hasRole('delegated_admin') || hasRole('faculty');

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    title: '', content: '', notice_type: 'general',
    priority: 'normal', is_pinned: false, expires_at: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadNotices(); }, [filter]);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.type = filter;
      const res = await api.get('/notices', { params });
      setNotices(res.data.notices || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await api.post('/notices', form);
      setSuccess('Notice published successfully!');
      setShowForm(false);
      setForm({ title: '', content: '', notice_type: 'general', priority: 'normal', is_pinned: false, expires_at: '' });
      loadNotices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to publish notice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id) => {
    if (!confirm('Archive this notice?')) return;
    try {
      await api.delete(`/notices/${id}`);
      setSuccess('Notice archived');
      setSelectedNotice(null);
      loadNotices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to archive notice');
    }
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtFull = (dt) => dt ? new Date(dt).toLocaleString() : '—';

  const pinned = notices.filter(n => n.is_pinned);
  const regular = notices.filter(n => !n.is_pinned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.notices', 'Campus Notices')}</h1>
        </div>
        <div className="flex gap-2">
          {canPublish && (
            <button
              onClick={() => { setShowForm(v => !v); setError(''); setSuccess(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> {t('notices.publishNotice', 'Publish Notice')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

      {/* Publish Form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Publish New Notice</h2>
          <form onSubmit={handlePublish} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Notice title" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <textarea required rows={5} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Write the full notice content here..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.notice_type} onChange={e => setForm(f => ({ ...f, notice_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expires on</label>
                <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
                    className="rounded border-gray-300" />
                  📌 Pin to top
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {submitting ? t('common.loading', 'Publishing...') : t('notices.publishNotice', 'Publish Notice')}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">{t('common.cancel', 'Cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!filter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {t('common.all', 'All')}
        </button>
        {Object.keys(TYPE_COLORS).map(tKey => (
          <button key={tKey} onClick={() => setFilter(tKey)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === tKey ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {tKey}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading notices...</div>
      ) : (
        <div className="flex gap-6">
          {/* Notice List */}
          <div className="flex-1 space-y-3">
            {pinned.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase text-gray-400 mb-2 flex items-center gap-1"><Pin className="w-3 h-3" /> Pinned</div>
                {pinned.map(n => <NoticeCard key={n.id} notice={n} onSelect={setSelectedNotice} selected={selectedNotice?.id === n.id} canPublish={canPublish} onArchive={handleArchive} fmt={fmt} priorityColors={PRIORITY_COLORS} typeColors={TYPE_COLORS} />)}
              </div>
            )}
            {regular.length > 0 && (
              <div>
                {pinned.length > 0 && <div className="text-xs font-bold uppercase text-gray-400 mb-2">Recent Notices</div>}
                {regular.map(n => <NoticeCard key={n.id} notice={n} onSelect={setSelectedNotice} selected={selectedNotice?.id === n.id} canPublish={canPublish} onArchive={handleArchive} fmt={fmt} priorityColors={PRIORITY_COLORS} typeColors={TYPE_COLORS} />)}
              </div>
            )}
            {notices.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                No notices published yet.
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedNotice && (
            <div className="w-96 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-h-[75vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[selectedNotice.notice_type] || TYPE_COLORS.general}`}>{selectedNotice.notice_type}</span>
                    {selectedNotice.is_pinned && <span className="text-xs text-orange-500 font-medium">📌 Pinned</span>}
                    {selectedNotice.priority === 'urgent' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold">🚨 Urgent</span>}
                  </div>
                  <h2 className="font-bold text-gray-900">{selectedNotice.title}</h2>
                  <div className="text-xs text-gray-500 mt-1">By {selectedNotice.published_by_name} · {fmtFull(selectedNotice.created_at)}</div>
                  {selectedNotice.expires_at && <div className="text-xs text-orange-500 mt-0.5">⏰ Expires: {fmtFull(selectedNotice.expires_at)}</div>}
                </div>
                <button onClick={() => setSelectedNotice(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-5 h-5" /></button>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-3">
                {selectedNotice.content}
              </div>
              {canPublish && (
                <button onClick={() => handleArchive(selectedNotice.id)}
                  className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                  <Archive className="w-3.5 h-3.5" /> Archive Notice
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoticeCard({ notice, onSelect, selected, canPublish, onArchive, fmt, priorityColors, typeColors }) {
  return (
    <div
      onClick={() => onSelect(selected ? null : notice)}
      className={`bg-white rounded-xl border-l-4 border border-gray-200 shadow-sm p-4 cursor-pointer hover:shadow-md transition-all ${priorityColors[notice.priority] || 'border-l-blue-300'} ${selected ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {notice.is_pinned && <Pin className="w-3 h-3 text-orange-500 flex-shrink-0" />}
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${typeColors[notice.notice_type] || typeColors.general}`}>{notice.notice_type}</span>
            {notice.priority === 'urgent' && <span className="text-xs text-red-600 font-bold">🚨 Urgent</span>}
            {notice.priority === 'high' && <span className="text-xs text-orange-600 font-medium">High Priority</span>}
          </div>
          <div className="font-semibold text-gray-900 truncate">{notice.title}</div>
          <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">{notice.content}</div>
          <div className="text-xs text-gray-400 mt-1.5">{notice.published_by_name} · {fmt(notice.created_at)}</div>
        </div>
      </div>
    </div>
  );
}
