import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  FileText,
  Search,
  Filter,
  Shield,
  Clock,
  Terminal,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export const AuditLogsView = () => {
  const [logs, setLogs] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (moduleFilter) params.append('module', moduleFilter);
      if (search) params.append('search', search);

      const res = await api.get(`/admin/audit-logs?${params.toString()}`);
      if (res.data.success) {
        setLogs(res.data.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [moduleFilter, search]);

  const toggleExpand = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getModuleBadge = (mod) => {
    switch (mod) {
      case 'auth':
        return <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] px-2 py-0.5 rounded font-mono">AUTH</span>;
      case 'admin':
        return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] px-2 py-0.5 rounded font-mono">ADMIN</span>;
      case 'security':
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded font-mono">SECURITY</span>;
      case 'complaint':
      case 'cmo':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded font-mono">COMPLAINT</span>;
      case 'attendance':
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] px-2 py-0.5 rounded font-mono">ATTENDANCE</span>;
      case 'fee':
        return <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] px-2 py-0.5 rounded font-mono">FEE_GATEWAY</span>;
      default:
        return <span className="bg-slate-700 text-slate-300 text-[10px] px-2 py-0.5 rounded font-mono">{mod.toUpperCase()}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          <FileText className="w-6 h-6 text-sky-400" />
          <span>System Audit Trail & Accountability</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Immutable system log recording administrative delegations, CMO designations, attendance overrides, and security scans.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action or actor name/email..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['', 'admin', 'auth', 'security', 'cmo', 'attendance', 'fee'].map((mod) => (
            <button
              key={mod}
              onClick={() => setModuleFilter(mod)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition shrink-0 ${
                moduleFilter === mod
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-950/50 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {mod || 'All Modules'}
            </button>
          ))}
        </div>
      </div>

      {/* Log Entries Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-bold">Timestamp</th>
                <th className="py-3.5 px-4 font-bold">Module</th>
                <th className="py-3.5 px-4 font-bold">Action Event</th>
                <th className="py-3.5 px-4 font-bold">Actor</th>
                <th className="py-3.5 px-4 font-bold">Target Entity</th>
                <th className="py-3.5 px-4 font-bold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Querying immutable audit records...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No audit records found matching your filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-slate-800/40 transition cursor-pointer"
                      >
                        <td className="py-4 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          {getModuleBadge(log.module)}
                        </td>
                        <td className="py-4 px-4 font-semibold text-white">
                          <code className="text-xs text-sky-300 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/40 font-mono">
                            {log.action}
                          </code>
                        </td>
                        <td className="py-4 px-4 text-xs">
                          <div className="font-semibold text-slate-200">{log.actor_name || 'System Auto'}</div>
                          <div className="text-[11px] text-slate-400">{log.actor_email}</div>
                        </td>
                        <td className="py-4 px-4 text-xs font-mono text-slate-400 truncate max-w-[150px]">
                          {log.target_record_id || 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button className="text-slate-400 hover:text-white p-1">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-950/90 border-y border-slate-800">
                          <td colSpan="6" className="p-4 pl-12 font-mono text-xs">
                            <div className="text-slate-400 mb-1 flex items-center gap-2">
                              <Terminal className="w-3.5 h-3.5 text-sky-400" />
                              <span>Audit Payload (IP: {log.ip_address || 'Internal'}):</span>
                            </div>
                            <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-sky-200 overflow-x-auto text-[11px]">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogsView;
