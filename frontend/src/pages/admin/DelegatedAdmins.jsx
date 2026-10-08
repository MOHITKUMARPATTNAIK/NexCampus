import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Search,
  Check,
  Building
} from 'lucide-react';

export const DelegatedAdmins = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [refData, setRefData] = useState({ departments: [], permissions: [] });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    roleType: 'Academic Administrator',
    departmentId: '',
    customPermissions: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [adminRes, refRes] = await Promise.all([
        api.get('/admin/delegated-admins'),
        api.get('/admin/reference-data')
      ]);
      if (adminRes.data.success) setAdmins(adminRes.data.admins);
      if (refRes.data.success) setRefData(refRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch administrator records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePermissionToggle = (code) => {
    setFormData((prev) => {
      const exists = prev.customPermissions.includes(code);
      return {
        ...prev,
        customPermissions: exists
          ? prev.customPermissions.filter((c) => c !== code)
          : [...prev.customPermissions, code]
      };
    });
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post('/admin/delegated-admins', formData);
      if (res.data.success) {
        setSuccess(res.data.message);
        setIsModalOpen(false);
        setFormData({
          fullName: '',
          email: '',
          password: '',
          phone: '',
          roleType: 'Academic Administrator',
          departmentId: '',
          customPermissions: []
        });
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error appointing delegated administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change this administrator account status to ${newStatus}?`)) {
      return;
    }
    try {
      const res = await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      if (res.data.success) {
        setSuccess(res.data.message);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>Delegated Administrators</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Super Admin-appointed functional administrators with department and permission boundaries.
          </p>
        </div>

        {user.isSuperAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>Appoint Delegated Admin</span>
          </button>
        )}
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

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-bold">Administrator</th>
                <th className="py-3.5 px-4 font-bold">Role & Jurisdiction</th>
                <th className="py-3.5 px-4 font-bold">Assigned Permissions</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Appointed By</th>
                {user.isSuperAdmin && <th className="py-3.5 px-4 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading administrator records...</span>
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No delegated administrators appointed yet. Click &quot;Appoint Delegated Admin&quot; above.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => (
                  <tr key={adm.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-white">{adm.full_name}</div>
                      <div className="text-xs text-slate-400">{adm.email}</div>
                      {adm.phone && <div className="text-[11px] text-slate-400">{adm.phone}</div>}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-indigo-300">{adm.role_type}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Building className="w-3.5 h-3.5" />
                        <span>{adm.department_name || 'All Departments'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {adm.permissions && adm.permissions.length > 0 ? (
                          adm.permissions.map((p) => (
                            <span
                              key={p}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300"
                            >
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">Standard role default</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize inline-flex items-center gap-1.5 ${
                          adm.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : adm.status === 'suspended'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          adm.status === 'active' ? 'bg-emerald-400' : adm.status === 'suspended' ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                        {adm.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">
                      <div>{adm.appointed_by_name || 'Super Admin'}</div>
                      <div className="text-[11px] text-slate-400">{new Date(adm.created_at).toLocaleDateString()}</div>
                    </td>
                    {user.isSuperAdmin && (
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {adm.status === 'active' ? (
                            <>
                              <button
                                onClick={() => handleStatusChange(adm.id, 'suspended')}
                                title="Suspend Account"
                                className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition"
                              >
                                Suspend
                              </button>
                              <button
                                onClick={() => handleStatusChange(adm.id, 'deactivated')}
                                title="Deactivate Account"
                                className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition"
                              >
                                Deactivate
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(adm.id, 'active')}
                              title="Re-activate Account"
                              className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition"
                            >
                              Re-activate
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative my-8">
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              <span>Appoint Delegated Administrator</span>
            </h2>
            <p className="text-slate-400 text-xs mb-6">
              Create an administrative account with scoped department authority and custom permissions.
            </p>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Dr. Sarah Jenkins"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Institutional Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="admin.dept@nexcampus.edu"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Temporary Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 8 chars"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Administrative Function / Role *
                  </label>
                  <select
                    value={formData.roleType}
                    onChange={(e) => setFormData({ ...formData, roleType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Academic Administrator">Academic Administrator</option>
                    <option value="Accounts and Fee Administrator">Accounts & Fee Administrator</option>
                    <option value="Hostel Administrator">Hostel Administrator</option>
                    <option value="Security Manager">Security Manager</option>
                    <option value="Attendance Administrator">Attendance Administrator</option>
                    <option value="Examination Administrator">Examination Administrator</option>
                    <option value="Student Affairs Administrator">Student Affairs Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Jurisdiction / Department
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Campus-Wide (All Departments)</option>
                    {refData.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Granular Permission Checklist */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Grant Custom Functional Permissions
                </label>
                <div className="max-h-48 overflow-y-auto p-3 bg-slate-950/80 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {refData.permissions.map((p) => {
                    const isChecked = formData.customPermissions.includes(p.code);
                    return (
                      <label
                        key={p.code}
                        onClick={() => handlePermissionToggle(p.code)}
                        className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition border ${
                          isChecked
                            ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-200'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                          isChecked ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700'
                        }`}>
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <div>
                          <div className="font-semibold text-white leading-tight">{p.code}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{p.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  {submitting ? 'Appointing...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DelegatedAdmins;
