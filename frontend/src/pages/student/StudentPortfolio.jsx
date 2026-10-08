import { useState, useEffect } from 'react';
import {
  Award,
  User,
  BookOpen,
  CreditCard,
  QrCode,
  CalendarCheck,
  Edit2,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
  FileText,
  ExternalLink,
  Eye,
  X,
  UploadCloud
} from 'lucide-react';
import api from '../../services/api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ACHIEVEMENT_CATEGORIES = [
  { value: 'certification', label: 'Certification' },
  { value: 'hackathon', label: 'Hackathon / Competition' },
  { value: 'publication', label: 'Research Publication' },
  { value: 'sports', label: 'Sports & Athletics' },
  { value: 'cultural', label: 'Cultural & Arts' },
  { value: 'academic', label: 'Academic Honor' }
];

export default function StudentPortfolio() {
  const [portfolio, setPortfolio] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Achievement Modals State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewCertModalOpen, setViewCertModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);

  // New Achievement Form State
  const initialAchForm = {
    title: '',
    category: 'certification',
    issuing_organization: '',
    achievement_date: '',
    description: '',
    file_base64: '',
    file_name: '',
    file_type: ''
  };
  const [achForm, setAchForm] = useState(initialAchForm);
  const [achSubmitting, setAchSubmitting] = useState(false);

  useEffect(() => {
    loadPortfolio();
    loadAchievements();
  }, []);

  const loadPortfolio = async () => {
    try {
      const res = await api.get('/portfolio/my');
      setPortfolio(res.data);
      setForm({
        phone: res.data.profile?.phone || '',
        address: res.data.profile?.address || '',
        emergency_contact_name: res.data.profile?.emergency_contact_name || '',
        emergency_contact_phone: res.data.profile?.emergency_contact_phone || '',
        blood_group: res.data.profile?.blood_group || '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load portfolio.');
    } finally {
      setLoading(false);
    }
  };

  const loadAchievements = async () => {
    try {
      const res = await api.get('/portfolio/achievements');
      if (res.data.success) {
        setAchievements(res.data.achievements || []);
      }
    } catch (err) {
      // quiet fail or log
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.patch('/portfolio/profile', form);
      setSuccess('Profile information updated successfully!');
      setEditMode(false);
      loadPortfolio();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAchForm(prev => ({
        ...prev,
        file_base64: reader.result,
        file_name: file.name,
        file_type: file.type
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAchievement = async (e) => {
    e.preventDefault();
    setAchSubmitting(true);
    setError('');
    try {
      const res = await api.post('/portfolio/achievements', achForm);
      if (res.data.success) {
        setSuccess('Achievement & Certificate uploaded successfully!');
        setAddModalOpen(false);
        setAchForm(initialAchForm);
        loadAchievements();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save achievement.');
    } finally {
      setAchSubmitting(false);
    }
  };

  const handleDeleteAchievement = async (id) => {
    if (!window.confirm('Are you sure you want to delete this achievement record?')) return;
    try {
      await api.delete(`/portfolio/achievements/${id}`);
      setSuccess('Achievement deleted successfully.');
      loadAchievements();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete achievement.');
    }
  };

  const fmtCur = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const leaveStats = portfolio?.leaves?.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {}) || {};
  const passStats  = portfolio?.gatepasses?.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {}) || {};
  const compStats  = portfolio?.complaints?.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {}) || {};
  const att = portfolio?.attendance || {};
  const attPct = att.percentage ? parseFloat(att.percentage) : null;

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-sm font-semibold">Loading your verified campus portfolio...</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Student Portfolio & Achievements</h1>
            <p className="text-xs text-slate-500 mt-0.5">Academic profile, verified attendance, and extracurricular credentials.</p>
          </div>
        </div>

        <button
          onClick={() => { setEditMode(v => !v); setError(''); setSuccess(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-600/20"
        >
          <Edit2 className="w-4 h-4" />
          <span>{editMode ? 'Cancel Edit' : 'Edit Profile'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-900">✕</button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {/* Primary Identity Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-md shadow-indigo-600/25 shrink-0">
            {portfolio?.profile?.full_name?.charAt(0)?.toUpperCase() || 'S'}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-slate-900">{portfolio?.profile?.full_name || 'Enrolled Student'}</h2>
            <div className="text-sm text-slate-500 mt-0.5">{portfolio?.profile?.email}</div>

            <div className="flex flex-wrap gap-2.5 mt-3">
              {portfolio?.profile?.roll_number && (
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full text-xs font-bold font-mono">
                  Roll: {portfolio.profile.roll_number}
                </span>
              )}
              {portfolio?.profile?.course_name && (
                <span className="bg-slate-100 text-slate-800 border border-slate-200 px-3 py-1 rounded-full text-xs font-semibold">
                  {portfolio.profile.course_name}
                </span>
              )}
              {portfolio?.profile?.department_name && (
                <span className="bg-slate-100 text-slate-800 border border-slate-200 px-3 py-1 rounded-full text-xs font-semibold">
                  {portfolio.profile.department_name}
                </span>
              )}
              {portfolio?.profile?.blood_group && (
                <span className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-xs font-bold">
                  Blood: {portfolio.profile.blood_group}
                </span>
              )}
            </div>
          </div>
        </div>

        {!editMode && (
          <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Contact Phone', value: portfolio?.profile?.phone || 'Not set' },
              { label: 'Hostel / Residence', value: portfolio?.profile?.hostel_name ? `${portfolio.profile.hostel_name} (Rm ${portfolio.profile.room_number || ''})` : 'Day Scholar' },
              { label: 'Emergency Contact', value: portfolio?.profile?.emergency_contact_name || 'Not set' },
              { label: 'Emergency Phone', value: portfolio?.profile?.emergency_contact_phone || 'Not set' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</div>
                <div className="text-xs font-bold text-slate-800 truncate">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EDIT PROFILE FORM */}
      {editMode && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">Edit Profile Information</h3>
            <span className="text-xs text-slate-400">Updates save directly to persistent database.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+91 9876543210"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
              <select
                value={form.blood_group}
                onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
              >
                <option value="">Select blood group...</option>
                {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Name</label>
              <input
                type="text"
                value={form.emergency_contact_name}
                onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                placeholder="Parent or Guardian Name"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Phone</label>
              <input
                type="tel"
                value={form.emergency_contact_phone}
                onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                placeholder="+91 9811122334"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Permanent Address</label>
              <textarea
                rows={2}
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Permanent residential address"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Operational Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-900 text-sm">Attendance</span>
          </div>
          {attPct !== null ? (
            <>
              <div className={`text-3xl font-black mb-1 ${attPct >= 75 ? 'text-emerald-700' : 'text-rose-700'}`}>{attPct}%</div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all ${attPct >= 75 ? 'bg-emerald-600' : 'bg-rose-600'}`}
                  style={{ width: `${Math.min(attPct, 100)}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 space-y-0.5">
                <div className="flex justify-between"><span>Present</span><strong className="text-emerald-700">{att.present || 0}</strong></div>
                <div className="flex justify-between"><span>Absent</span><strong className="text-rose-700">{att.absent || 0}</strong></div>
                <div className="flex justify-between"><span>Total Sessions</span><strong>{att.total || 0}</strong></div>
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-xs py-4 text-center">No attendance records yet</div>
          )}
        </div>

        {/* Leaves Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-slate-900 text-sm">Leave Applications</span>
          </div>
          <div className="space-y-1.5 text-xs">
            {[['approved', 'Approved', 'text-emerald-700'], ['pending', 'Pending', 'text-amber-700'], ['rejected', 'Rejected', 'text-rose-700']].map(([k, l, c]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-500">{l}</span>
                <strong className={c}>{leaveStats[k] || 0}</strong>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-1 flex justify-between font-bold text-slate-800">
              <span>Total Requests</span>
              <span>{Object.values(leaveStats).reduce((a, b) => a + b, 0)}</span>
            </div>
          </div>
        </div>

        {/* Fees Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-slate-900 text-sm">Fee Summary</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Invoices Settled</span><strong className="text-emerald-700">{portfolio?.fees?.fees_paid || 0}</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">Invoices Due</span><strong className="text-rose-700">{portfolio?.fees?.fees_pending || 0}</strong></div>
            <div className="border-t border-slate-100 pt-1">
              <div className="text-[11px] text-slate-400">Total Paid:</div>
              <div className="text-base font-black text-emerald-700">{fmtCur(portfolio?.fees?.total_paid)}</div>
            </div>
          </div>
        </div>

        {/* Gate Passes & Complaints */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-slate-900 text-sm">Gate & Complaints</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Gate Passes</span><strong className="text-slate-800">{Object.values(passStats).reduce((a, b) => a + b, 0)}</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">Active Passes</span><strong className="text-blue-700">{passStats['approved'] || 0}</strong></div>
            <div className="border-t border-slate-100 pt-1 flex justify-between">
              <span className="text-slate-500">Complaints Resolved</span>
              <strong className="text-emerald-700">{compStats['resolved'] || 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ACHIEVEMENTS & CERTIFICATES SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <span>Achievements, Certifications & Honors</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload certificates from competitions, hackathons, publications, and certifications.
            </p>
          </div>

          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-600/20 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Achievement</span>
          </button>
        </div>

        {achievements.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <div className="font-semibold text-slate-700">No achievements recorded yet.</div>
            <div className="text-xs text-slate-400 mt-1">Upload certificates and awards to build your digital institutional portfolio.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((ach) => (
              <div key={ach.id} className="border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 transition shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {ach.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      ach.is_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ach.is_verified ? 'Verified' : 'Pending Review'}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-base">{ach.title}</h4>
                  <div className="text-xs text-slate-500 mt-0.5 font-medium">
                    {ach.issuing_organization} • {ach.achievement_date ? new Date(ach.achievement_date).toLocaleDateString() : 'N/A'}
                  </div>

                  {ach.description && (
                    <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">{ach.description}</p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  {ach.file_url ? (
                    <button
                      onClick={() => {
                        setSelectedCert(ach);
                        setViewCertModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Certificate</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">No file attached</span>
                  )}

                  <button
                    onClick={() => handleDeleteAchievement(ach.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD ACHIEVEMENT MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-6">
              <h3 className="text-lg font-black text-slate-900">Add Achievement or Certificate</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAchievement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Achievement / Award Title *</label>
                <input
                  type="text"
                  required
                  value={achForm.title}
                  onChange={e => setAchForm({ ...achForm, title: e.target.value })}
                  placeholder="e.g. AWS Certified Solutions Architect or 1st Prize in Hackathon"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={achForm.category}
                    onChange={e => setAchForm({ ...achForm, category: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
                  >
                    {ACHIEVEMENT_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date Awarded *</label>
                  <input
                    type="date"
                    required
                    value={achForm.achievement_date}
                    onChange={e => setAchForm({ ...achForm, achievement_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Issuing Organization / Authority *</label>
                <input
                  type="text"
                  required
                  value={achForm.issuing_organization}
                  onChange={e => setAchForm({ ...achForm, issuing_organization: e.target.value })}
                  placeholder="e.g. Google, Amazon, IEEE, University"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Project Summary</label>
                <textarea
                  rows={2}
                  value={achForm.description}
                  onChange={e => setAchForm({ ...achForm, description: e.target.value })}
                  placeholder="Briefly describe what you built, researched, or achieved..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Upload Certificate File (PDF / PNG / JPG)</label>
                <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <UploadCloud className="w-8 h-8 text-indigo-600 mx-auto mb-1.5" />
                  <div className="text-xs font-bold text-slate-800">
                    {achForm.file_name ? achForm.file_name : 'Click to select certificate document'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Maximum file size: 10MB</div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={achSubmitting}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {achSubmitting ? 'Uploading...' : 'Save Achievement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW CERTIFICATE MODAL */}
      {viewCertModalOpen && selectedCert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">{selectedCert.title}</h3>
                <div className="text-xs text-slate-500">{selectedCert.issuing_organization}</div>
              </div>
              <button onClick={() => setViewCertModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center p-4">
              {selectedCert.file_url?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={selectedCert.file_url}
                  className="w-full h-96 rounded-lg border-0"
                  title="Certificate Preview"
                />
              ) : (
                <img
                  src={selectedCert.file_url}
                  alt={selectedCert.title}
                  className="max-h-96 max-w-full rounded-lg object-contain shadow-sm"
                />
              )}
            </div>

            <div className="mt-4 flex justify-between items-center">
              <a
                href={selectedCert.file_url}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </a>

              <button
                type="button"
                onClick={() => setViewCertModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
