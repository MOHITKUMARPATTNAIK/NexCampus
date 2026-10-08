import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Users,
  UserPlus,
  Building,
  Search,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

export const FacultyDirectory = () => {
  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
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
    employeeId: '',
    departmentId: '',
    designation: 'Associate Professor',
    specialization: 'Artificial Intelligence & Systems',
    cabinNumber: 'Room 304, Academic Block'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [facRes, refRes] = await Promise.all([
        api.get(`/admin/faculty${departmentId ? `?departmentId=${departmentId}` : ''}`),
        api.get('/admin/reference-data')
      ]);
      if (facRes.data.success) setFaculty(facRes.data.faculty);
      if (refRes.data.success) setDepartments(refRes.data.data.departments);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch faculty directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [departmentId]);

  const handleCreateFaculty = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post('/admin/faculty', formData);
      if (res.data.success) {
        setSuccess(res.data.message);
        setIsModalOpen(false);
        setFormData({
          fullName: '',
          email: '',
          password: '',
          phone: '',
          employeeId: '',
          departmentId: '',
          designation: 'Associate Professor',
          specialization: '',
          cabinNumber: ''
        });
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating faculty account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change faculty status to ${newStatus}?`)) {
      return;
    }
    try {
      const res = await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      if (res.data.success) {
        setSuccess(res.data.message);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update faculty status.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-400" />
            <span>Faculty Directory & Workload</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage academic professors, instructors, departmental allocations, and teaching credentials.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/30"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Faculty Member</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
        >
          <option value="">All Academic Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
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

      {/* Faculty Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-bold">Faculty Member</th>
                <th className="py-3.5 px-4 font-bold">Department</th>
                <th className="py-3.5 px-4 font-bold">Designation & Specialization</th>
                <th className="py-3.5 px-4 font-bold">Cabin / Office</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading faculty records...</span>
                  </td>
                </tr>
              ) : faculty.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No faculty records found. Click &quot;Add Faculty Member&quot; above to create one.
                  </td>
                </tr>
              ) : (
                faculty.map((fac) => (
                  <tr key={fac.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-white">{fac.full_name}</div>
                      <div className="text-xs text-blue-400 font-mono font-medium">{fac.employee_id}</div>
                      <div className="text-[11px] text-slate-400">{fac.email}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-white">{fac.department_name || 'Academic Faculty'}</div>
                      <div className="text-xs text-slate-400">{fac.department_code || 'ACAD'}</div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-300">
                      <div className="font-medium text-white">{fac.designation}</div>
                      <div className="text-slate-400 text-[11px]">{fac.specialization || 'General Curriculum'}</div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">
                      {fac.cabin_number || 'Shared Department Office'}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize inline-flex items-center gap-1.5 ${
                          fac.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : fac.status === 'suspended'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          fac.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`} />
                        {fac.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {fac.status === 'active' ? (
                          <>
                            <button
                              onClick={() => handleStatusChange(fac.id, 'suspended')}
                              title="Suspend"
                              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() => handleStatusChange(fac.id, 'deactivated')}
                              title="Deactivate"
                              className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition"
                            >
                              Deactivate
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(fac.id, 'active')}
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
              <UserPlus className="w-5 h-5 text-blue-400" />
              <span>Add Faculty Member</span>
            </h2>
            <p className="text-slate-400 text-xs mb-6">
              Create an academic instructor profile and allocate teaching permissions.
            </p>

            <form onSubmit={handleCreateFaculty} className="space-y-4">
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
                    placeholder="e.g. Prof. Alan Turing"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="FAC-CSE-001"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Institutional Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="prof.turing@nexcampus.edu"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
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
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Department
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Assistant Professor / HoD"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    placeholder="e.g. Distributed Computing"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Cabin / Office Number
                  </label>
                  <input
                    type="text"
                    value={formData.cabinNumber}
                    onChange={(e) => setFormData({ ...formData, cabinNumber: e.target.value })}
                    placeholder="e.g. Room 412, Block C"
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
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
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-600/30"
                >
                  {submitting ? 'Creating...' : 'Create Faculty Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyDirectory;
