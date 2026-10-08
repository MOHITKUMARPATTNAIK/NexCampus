import { useState, useEffect } from 'react';
import { AlertTriangle, Phone, Clock, RefreshCw, User } from 'lucide-react';
import api from '../../services/api';

export default function OverdueMonitor() {
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    loadOverdue();
    // Auto-refresh every 2 minutes
    const interval = setInterval(loadOverdue, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadOverdue = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/security/overdue-students');
      setOverdue(res.data.students || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load overdue students');
    } finally {
      setLoading(false);
    }
  };

  const hoursOverdue = (expectedReturn) => {
    if (!expectedReturn) return null;
    const diff = Date.now() - new Date(expectedReturn).getTime();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const severityColor = (expectedReturn) => {
    if (!expectedReturn) return 'yellow';
    const hours = (Date.now() - new Date(expectedReturn).getTime()) / 3600000;
    if (hours > 4) return 'red';
    if (hours > 2) return 'orange';
    return 'yellow';
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-7 h-7 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Overdue Students Monitor</h1>
            <p className="text-sm text-gray-500 mt-0.5">Students who have not returned by their expected time</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">Last refreshed: {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button
            onClick={loadOverdue}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800">
              {overdue.length} student{overdue.length !== 1 ? 's' : ''} overdue
            </h3>
            <p className="text-sm text-red-600 mt-0.5">
              These students have checked out but have not returned within their approved time window. Contact them immediately.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-300" />
          Loading overdue students...
        </div>
      ) : overdue.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">All Clear</h3>
          <p className="text-gray-500 mt-2">No overdue students at this time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {overdue.map((student) => {
            const color = severityColor(student.expected_return_time);
            const overdueDuration = hoursOverdue(student.expected_return_time);
            return (
              <div
                key={student.id || student.gate_pass_id}
                className={`bg-white rounded-xl border-2 shadow-sm p-5 ${color === 'red' ? 'border-red-400' : color === 'orange' ? 'border-orange-400' : 'border-yellow-400'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${color === 'red' ? 'bg-red-100' : color === 'orange' ? 'bg-orange-100' : 'bg-yellow-100'}`}>
                      <User className={`w-6 h-6 ${color === 'red' ? 'text-red-600' : color === 'orange' ? 'text-orange-600' : 'text-yellow-600'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{student.student_name || '—'}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                        <span className="font-mono">{student.roll_number || '—'}</span>
                        {student.hostel_name && <span>🏠 {student.hostel_name}</span>}
                        {student.room_number && <span>Room: {student.room_number}</span>}
                        {student.department_name && <span>📚 {student.department_name}</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-2">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Expected return: <strong className="text-gray-800">{fmt(student.expected_return_time)}</strong>
                        </span>
                        <span className="text-gray-500">
                          Checkout at: <strong className="text-gray-800">{fmt(student.checkout_time)}</strong>
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Pass reason:</span> {student.reason || '—'}
                      </div>
                      {student.phone && (
                        <a href={`tel:${student.phone}`} className="inline-flex items-center gap-1.5 mt-2 text-blue-600 hover:underline text-sm font-medium">
                          <Phone className="w-4 h-4" /> {student.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  {overdueDuration && (
                    <div className={`text-center flex-shrink-0 px-4 py-2 rounded-xl ${color === 'red' ? 'bg-red-100' : color === 'orange' ? 'bg-orange-100' : 'bg-yellow-100'}`}>
                      <div className="text-xs font-medium uppercase text-gray-500 mb-1">Overdue by</div>
                      <div className={`text-2xl font-bold ${color === 'red' ? 'text-red-600' : color === 'orange' ? 'text-orange-600' : 'text-yellow-600'}`}>
                        {overdueDuration}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-gray-400 text-center">
        Auto-refreshes every 2 minutes. Last updated: {lastRefresh?.toLocaleTimeString() || 'never'}
      </div>
    </div>
  );
}
