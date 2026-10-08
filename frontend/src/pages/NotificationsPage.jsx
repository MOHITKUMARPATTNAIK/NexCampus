import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Check, CheckCheck, AlertCircle } from 'lucide-react';
import api from '../services/api';

const TYPE_CONFIG = {
  notice:      { color: 'blue',   icon: '📢' },
  gate_pass:   { color: 'orange', icon: '🔑' },
  leave:       { color: 'purple', icon: '📅' },
  payment:     { color: 'green',  icon: '💳' },
  complaint:   { color: 'amber',  icon: '⚠️'  },
  general:     { color: 'gray',   icon: '🔔'  },
  security:    { color: 'red',    icon: '🛡️'  },
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [error, setError] = useState('');

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications/my');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (ids) => {
    try {
      await api.patch('/notifications/mark-read', { ids });
      setNotifications(prev =>
        prev.map(n => ids.includes(n.id) ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - ids.length));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/mark-read', {});
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const fmt = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const visible = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-7 h-7 text-blue-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.notifications', 'Notifications')}</h1>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['all', t('common.all', 'All')], ['unread', `Unread (${unreadCount})`]].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${filter === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading notifications...</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">{filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(n => {
            const cfg = TYPE_CONFIG[n.notification_type] || TYPE_CONFIG.general;
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead([n.id])}
                className={`bg-white rounded-xl border shadow-sm p-4 transition-all cursor-pointer hover:shadow-md ${!n.is_read ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xl ${!n.is_read ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-gray-900 text-sm">{n.title}</div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(n.created_at)}</span>
                        {n.is_read ? (
                          <CheckCheck className="w-4 h-4 text-gray-300" />
                        ) : (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-3">{n.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visible.length > 0 && (
        <div className="text-xs text-gray-400 text-center">
          Showing {visible.length} notification{visible.length !== 1 ? 's' : ''}
          {filter === 'all' && unreadCount > 0 && ` · ${unreadCount} unread`}
        </div>
      )}
    </div>
  );
}
