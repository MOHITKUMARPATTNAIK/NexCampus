import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building,
  Sliders,
  FileCheck2,
  Lock,
  Plus
} from 'lucide-react';

export const CMOAppointment = () => {
  const { user } = useAuth();
  const [cmos, setCmos] = useState([]);
  const [categories, setCategories] = useState([]);
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
    assignedCategories: [],
    assignedHostels: ['Hostel A', 'Hostel B', 'Hostel C'],
    notes: 'Primary Campus Complaint Coordinator'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cmoRes, refRes] = await Promise.all([
        api.get('/admin/cmo-list'),
        api.get('/admin/reference-data')
      ]);
      if (cmoRes.data.success) setCmos(cmoRes.data.cmos);
      if (refRes.data.success) setCategories(refRes.data.data.complaintCategories);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch CMO records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCategoryToggle = (catId) => {
    setFormData((prev) => {
      const exists = prev.assignedCategories.includes(catId);
      return {
        ...prev,
        assignedCategories: exists
          ? prev.assignedCategories.filter((id) => id !== catId)
          : [...prev.assignedCategories, catId]
      };
    });
  };

  const handleAppointCMO = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post('/admin/cmo-appointment', formData);
      if (res.data.success) {
        setSuccess(res.data.message);
        setIsModalOpen(false);
        setFormData({
          fullName: '',
          email: '',
          password: '',
          phone: '',
          assignedCategories: [],
          assignedHostels: ['Hostel A', 'Hostel B'],
          notes: ''
        });
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error appointing Complaint Management Officer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change this Complaint Officer's status to ${newStatus}?`)) {
      return;
    }
    try {
      const res = await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      if (res.data.success) {
        setSuccess(res.data.message);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update CMO status.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <span>Complaint Management Officer (CMO) Designation</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Sole authority: <strong className="text-white">Super Administrator</strong>. Designate, configure scope, replace, and audit Complaint Officers.
          </p>
        </div>

        {user.isSuperAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition shadow-lg shadow-amber-600/30"
          >
            <UserCheck className="w-4 h-4" />
            <span>Designate New CMO</span>
          </button>
        )}
      </div>

      {/* Security Rule Alert Banner */}
      <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
        <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <strong className="text-white block mb-0.5">Appointment Restriction Enforced:</strong>
          Only the Super Admin holds the authority to designate, modify, or deactivate Complaint Management Officers.
          CMOs are granted triage, assignment, and resolution verification authority, but cannot self-appoint or escalate their own privileges.
        </div>
      </div>

      {/* Feedback Alerts */}
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

      {/* CMO Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-bold">Officer Profile</th>
                <th className="py-3.5 px-4 font-bold">Authorized Scope & Categories</th>
                <th className="py-3.5 px-4 font-bold">Handled Complaints</th>
                <th className="py-3.5 px-4 font-bold">Account Status</th>
                <th className="py-3.5 px-4 font-bold">Appointed At</th>
                {user.isSuperAdmin && <th className="py-3.5 px-4 font-bold text-right">Super Admin Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading designated complaint officers...</span>
                  </td>
                </tr>
              ) : cmos.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No Complaint Management Officer designated yet. Click &quot;Designate New CMO&quot; above.
                  </td>
                </tr>
              ) : (
                cmos.map((cmo) => (
                  <tr key={cmo.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{cmo.full_name}</span>
                        {cmo.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                            Active CMO
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{cmo.email}</div>
                      {cmo.phone && <div className="text-[11px] text-slate-400">{cmo.phone}</div>}
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <div className="text-xs text-slate-300 font-medium mb-1">
                        {cmo.scope_details?.notes || 'Campus-wide Complaint Coordination'}
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px] text-slate-400">
                        {cmo.scope_details?.hostels && (
                          <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                            Hostels: {cmo.scope_details.hostels.join(', ')}
                          </span>
                        )}
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {cmo.scope_details?.categories?.length || 'All'} Categories Scoped
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm font-bold text-white bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                        {cmo.total_complaints_handled} cases
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize inline-flex items-center gap-1.5 ${
                          cmo.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : cmo.status === 'suspended'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          cmo.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`} />
                        {cmo.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">
                      <div>{new Date(cmo.appointed_at).toLocaleDateString()}</div>
                      <div className="text-[11px] text-slate-400">by {cmo.appointed_by_name || 'Super Admin'}</div>
                    </td>
                    {user.isSuperAdmin && (
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {cmo.status === 'active' ? (
                            <>
                              <button
                                onClick={() => handleStatusChange(cmo.id, 'suspended')}
                                title="Suspend CMO Account"
                                className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition"
                              >
                                Suspend
                              </button>
                              <button
                                onClick={() => handleStatusChange(cmo.id, 'deactivated')}
                                title="Revoke CMO Authority"
                                className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition"
                              >
                                Deactivate
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(cmo.id, 'active')}
                              title="Re-activate CMO Authority"
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative my-8">
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Designate Complaint Management Officer</span>
            </h2>
            <p className="text-slate-400 text-xs mb-6">
              Create a dedicated CMO credentials and define assigned categories and campus boundaries.
            </p>

            <form onSubmit={handleAppointCMO} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Officer Vikram Rao"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
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
                    placeholder="cmo.desk@nexcampus.edu"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Official Contact
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Scoped Categories */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                  Assigned Complaint Categories (Leave empty for All)
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/80 border border-slate-800 rounded-xl max-h-36 overflow-y-auto text-xs">
                  {categories.map((c) => {
                    const isSelected = formData.assignedCategories.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleCategoryToggle(c.id)}
                        className={`p-2 rounded-lg cursor-pointer border transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {isSelected && <span className="text-amber-400 text-xs font-bold">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                  Administrative Designation Notes
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Chief Campus Maintenance & Student Welfare Coordinator"
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                />
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
                  className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-600/30"
                >
                  {submitting ? 'Designating...' : 'Appoint CMO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CMOAppointment;
