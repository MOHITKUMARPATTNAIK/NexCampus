import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  UserPlus,
  QrCode,
  Home,
  UtensilsCrossed,
  Wrench,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

export const StaffLifecycle = () => {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [gates, setGates] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
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
    staffCategory: 'security_guard',
    designation: 'Senior Security Guard',
    assignedArea: 'Main Campus Perimeter',
    gateId: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [staffRes, refRes] = await Promise.all([
        api.get(`/admin/staff${categoryFilter ? `?category=${categoryFilter}` : ''}`),
        api.get('/admin/reference-data')
      ]);
      if (staffRes.data.success) setStaffList(staffRes.data.staff);
      if (refRes.data.success) setGates(refRes.data.data.gates);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load staff records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryFilter]);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post('/admin/staff', formData);
      if (res.data.success) {
        setSuccess(res.data.message);
        setIsModalOpen(false);
        setFormData({
          fullName: '',
          email: '',
          password: '',
          phone: '',
          staffCategory: 'security_guard',
          designation: 'Senior Security Guard',
          assignedArea: 'Main Campus Perimeter',
          gateId: ''
        });
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating operational staff account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change this staff member's status to ${newStatus}?`)) {
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

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'security_guard':
        return <QrCode className="w-4 h-4 text-emerald-400" />;
      case 'hostel_warden':
        return <Home className="w-4 h-4 text-sky-400" />;
      case 'mess_staff':
        return <UtensilsCrossed className="w-4 h-4 text-amber-400" />;
      case 'maintenance_staff':
        return <Wrench className="w-4 h-4 text-purple-400" />;
      default:
        return <Shield className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-emerald-400" />
            <span>Operational Staff Lifecycle</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage security guards, hostel wardens, mess staff, and maintenance repair technicians.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/30"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Operational Staff</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: '', label: 'All Personnel' },
          { id: 'security_guard', label: 'Security Guards' },
          { id: 'hostel_warden', label: 'Hostel Wardens' },
          { id: 'mess_staff', label: 'Mess Staff' },
          { id: 'maintenance_staff', label: 'Maintenance Technicians' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategoryFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              categoryFilter === tab.id
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
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

      {/* Staff Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-bold">Staff Member</th>
                <th className="py-3.5 px-4 font-bold">Role & Category</th>
                <th className="py-3.5 px-4 font-bold">Assigned Area / Gate</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Created</th>
                <th className="py-3.5 px-4 font-bold text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading operational staff records...</span>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No operational staff records found for this category. Click &quot;Add Operational Staff&quot; above.
                  </td>
                </tr>
              ) : (
                staffList.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-white">{st.full_name}</div>
                      <div className="text-xs text-slate-400">{st.email}</div>
                      <div className="text-[11px] text-slate-400">ID: {st.employee_id}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-white flex items-center gap-1.5">
                        {getCategoryIcon(st.staff_category)}
                        <span>{st.designation}</span>
                      </div>
                      <div className="text-xs text-slate-400 capitalize">{st.staff_category.replace('_', ' ')}</div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-300">
                      {st.assigned_area || 'Campus-wide duties'}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize inline-flex items-center gap-1.5 ${
                          st.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : st.status === 'suspended'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          st.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`} />
                        {st.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">
                      {new Date(st.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {st.status === 'active' ? (
                          <>
                            <button
                              onClick={() => handleStatusChange(st.id, 'suspended')}
                              title="Suspend"
                              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() => handleStatusChange(st.id, 'deactivated')}
                              title="Deactivate"
                              className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition"
                            >
                              Deactivate
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(st.id, 'active')}
                            title="Re-activate"
                            className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition"
                          >
                            Re-activate
                          </button>
                        )}
                      </div>
                    </td>
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
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <span>Add Operational Staff Account</span>
            </h2>
            <p className="text-slate-400 text-xs mb-6">
              Create an operational duty staff account with designated area or gate checkpoint assignments.
            </p>

            <form onSubmit={handleCreateStaff} className="space-y-4">
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
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="staff.ramesh@nexcampus.edu"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
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
                    placeholder="Min 8 chars"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Staff Category *
                  </label>
                  <select
                    value={formData.staffCategory}
                    onChange={(e) => setFormData({ ...formData, staffCategory: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="security_guard">Security Guard (Gate & Scanner)</option>
                    <option value="hostel_warden">Hostel Warden (Hostel & Complaints)</option>
                    <option value="mess_staff">Mess Supervisor / Staff</option>
                    <option value="maintenance_staff">Maintenance & Repair Technician</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Designation Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Senior Security Officer / Head Electrician"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Assigned Campus Area
                  </label>
                  <input
                    type="text"
                    value={formData.assignedArea}
                    onChange={(e) => setFormData({ ...formData, assignedArea: e.target.value })}
                    placeholder="e.g. Main Gate, Boys Hostel Block 1"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {formData.staffCategory === 'security_guard' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                      Assigned Security Gate
                    </label>
                    <select
                      value={formData.gateId}
                      onChange={(e) => setFormData({ ...formData, gateId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select Physical Gate</option>
                      {gates.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.gate_number}: {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  {submitting ? 'Creating...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffLifecycle;
