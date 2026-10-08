import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Clock, Filter } from 'lucide-react';
import api from '../../services/api';

export default function GateMovements() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'checkout' | 'checkin'
  const [dateFilter, setDateFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadMovements(); }, []);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/security/recent-movements', { params: { limit: 100 } });
      setMovements(res.data.movements || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';
  const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString() : '—';

  const filtered = movements.filter(m => {
    const typeMatch = filter === 'all' || m.movement_type === filter;
    const dateMatch = !dateFilter || fmtDate(m.recorded_at || m.created_at) === fmtDate(dateFilter);
    return typeMatch && dateMatch;
  });

  const stats = {
    total: movements.length,
    checkout: movements.filter(m => m.movement_type === 'checkout').length,
    checkin: movements.filter(m => m.movement_type === 'checkin').length,
    overdue: movements.filter(m => m.movement_type === 'checkout' && !m.checkin_recorded).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Gate Movement Log</h1>
        </div>
        <button onClick={loadMovements} className="text-sm text-blue-600 hover:underline font-medium">↻ Refresh</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Today', value: stats.total, color: 'blue' },
          { label: 'Checkouts', value: stats.checkout, color: 'orange', icon: <ArrowUpRight className="w-5 h-5" /> },
          { label: 'Check-ins', value: stats.checkin, color: 'green', icon: <ArrowDownLeft className="w-5 h-5" /> },
          { label: 'Still Outside', value: stats.overdue, color: 'red' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className={`bg-white rounded-xl p-4 border border-gray-200 shadow-sm`}>
            <div className={`flex items-center gap-2 text-${color}-600 mb-1`}>
              {icon}
              <span className="text-xs font-medium uppercase text-gray-500">{label}</span>
            </div>
            <div className={`text-3xl font-bold text-${color}-600`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex gap-2">
          {['all', 'checkout', 'checkin'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f === 'all' ? 'All' : f === 'checkout' ? '⬆ Checkouts' : '⬇ Check-ins'}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {dateFilter && (
          <button onClick={() => setDateFilter('')} className="text-sm text-red-500 hover:underline">Clear date</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && <div className="p-4 text-red-600 text-sm">{error}</div>}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading movement records...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No movements found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['#', 'Student', 'Roll No.', 'Type', 'Gate', 'Date & Time', 'Guard / Verifier', 'Pass No.'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((m, i) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{m.student_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{m.roll_number || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${m.movement_type === 'checkout' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {m.movement_type === 'checkout' ? <><ArrowUpRight className="w-3 h-3" />Checkout</> : <><ArrowDownLeft className="w-3 h-3" />Check-in</>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.gate_name || 'Main Gate'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(m.recorded_at || m.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{m.verified_by_name || m.guard_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{m.pass_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 bg-gray-50">
          Showing {filtered.length} of {movements.length} records
        </div>
      </div>
    </div>
  );
}
