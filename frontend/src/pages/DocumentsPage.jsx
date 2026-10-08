import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Plus,
  Download,
  Trash2,
  Filter,
  FolderOpen,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  X,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DOC_TYPES = ['all', 'general', 'academic', 'hostel', 'fees', 'policy', 'form', 'other'];

const TYPE_ICONS = {
  academic:    '📚',
  hostel:      '🏠',
  fees:        '💳',
  form:        '📋',
  policy:      '📜',
  result:      '📊',
  certificate: '🏆',
  general:     '📄',
  other:       '📁',
};

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { user, hasRole } = useAuth();
  const canUpload = hasRole('super_admin') || hasRole('delegated_admin') || hasRole('faculty');

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [myOnly, setMyOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const initialForm = {
    title: '',
    description: '',
    document_type: 'academic',
    file_url: '',
    file_name: '',
    file_base64: '',
    file_type: 'application/pdf',
    is_public: true,
    target_audience: 'all'
  };
  const [form, setForm] = useState(initialForm);

  useEffect(() => { loadDocs(); }, [filter, myOnly]);

  const loadDocs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filter && filter !== 'all') params.type = filter;
      if (myOnly) params.my_only = 'true';
      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents || []);
    } catch (err) {
      setError(err.response?.data?.error || t('common.error', 'Failed to load institutional documents.'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError(t('documents.sizeLimitError', 'File size exceeds 20MB limit.'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({
        ...prev,
        file_base64: reader.result,
        file_name: file.name,
        file_type: file.type,
        title: prev.title || file.name.replace(/\.[^/.]+$/, "")
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.file_base64 && !form.file_url) {
      setError(t('documents.fileRequiredError', 'Please select a file to upload or provide a document link.'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.post('/documents', form);
      setSuccess(t('documents.uploadSuccess', 'Document registered and published successfully!'));
      setShowForm(false);
      setForm(initialForm);
      loadDocs();
    } catch (err) {
      setError(err.response?.data?.error || t('common.error', 'Failed to publish document.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('documents.deleteConfirm', 'Are you sure you want to delete this document?'))) return;
    try {
      await api.delete(`/documents/${id}`);
      setSuccess(t('documents.deleteSuccess', 'Document removed successfully.'));
      loadDocs();
    } catch (err) {
      setError(err.response?.data?.error || t('common.error', 'Failed to delete document.'));
    }
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{t('documents.title', 'Institutional Documents & Vault')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('documents.subtitle', 'Academic calendars, codes of conduct, policy circulars, and institutional forms.')}</p>
          </div>
        </div>

        {canUpload && (
          <button
            onClick={() => { setShowForm(v => !v); setError(''); setSuccess(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-600/20 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{t('documents.uploadBtn', 'Upload New Document')}</span>
          </button>
        )}
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

      {/* UPLOAD FORM MODAL / DRAWER */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-6">
            <h3 className="font-black text-slate-900 text-base">{t('documents.formTitle', 'Register & Publish Campus Document')}</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('documents.docTitle', 'Document Title *')}</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t('documents.docTitlePlaceholder', 'e.g. Academic Calendar 2026-2027')}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('documents.classification', 'Document Classification *')}</label>
                <select
                  value={form.document_type}
                  onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
                >
                  {DOC_TYPES.filter(tKey => tKey !== 'all').map(tKey => (
                    <option key={tKey} value={tKey}>
                      {TYPE_ICONS[tKey] || '📁'} {t(`documents.filter${tKey.charAt(0).toUpperCase() + tKey.slice(1)}`, tKey).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('documents.description', 'Description / Summary')}</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('documents.descriptionPlaceholder', 'Official notice summary or circular details')}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('documents.uploadFile', 'Upload Document File (PDF / Office Docs up to 20MB)')}</label>
                <div className="border border-dashed border-slate-300 rounded-xl p-5 text-center hover:bg-slate-50 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <UploadCloud className="w-8 h-8 text-indigo-600 mx-auto mb-1.5" />
                  <div className="text-xs font-bold text-slate-800">
                    {form.file_name ? form.file_name : t('documents.clickToSelect', 'Click to select institutional file from your computer')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t('documents.supportedFormats', 'Supports PDF, DOC, DOCX, XLSX, JPG, PNG')}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('documents.targetAudience', 'Target Audience')}</label>
                <select
                  value={form.target_audience}
                  onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600"
                >
                  <option value="all">{t('documents.audienceAll', 'Campus-Wide (Everyone)')}</option>
                  <option value="student">{t('documents.audienceStudent', 'Students Only')}</option>
                  <option value="faculty">{t('documents.audienceFaculty', 'Faculty & Staff Only')}</option>
                  <option value="hostel">{t('documents.audienceHostel', 'Hostel Residents Only')}</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={form.is_public}
                  onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="is_public" className="text-xs font-semibold text-slate-700">{t('documents.publicDoc', 'Public Document (Searchable by all roles)')}</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                {t('documents.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {submitting ? t('documents.publishing', 'Publishing...') : t('documents.publishBtn', 'Publish Document')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        {DOC_TYPES.map(tKey => (
          <button
            key={tKey}
            onClick={() => setFilter(tKey)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
              filter === tKey
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {TYPE_ICONS[tKey] || ''} {tKey === 'all' ? t('documents.filterAll', 'All Resources') : t(`documents.filter${tKey.charAt(0).toUpperCase() + tKey.slice(1)}`, tKey)}
          </button>
        ))}

        {canUpload && (
          <button
            onClick={() => setMyOnly(v => !v)}
            className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              myOnly
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t('documents.myUploadsOnly', 'My Uploads Only')}
          </button>
        )}
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-sm font-semibold">{t('documents.loading', 'Loading document repository...')}</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <div className="font-bold text-slate-700">{t('documents.emptyTitle', 'No institutional documents found.')}</div>
          <div className="text-xs text-slate-400 mt-1">{t('documents.emptyDesc', 'Select a different category or upload a document.')}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <div key={doc.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 transition shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-2xl">{TYPE_ICONS[doc.document_type] || '📄'}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {t(`documents.filter${doc.document_type.charAt(0).toUpperCase() + doc.document_type.slice(1)}`, doc.document_type)}
                    </span>
                    {(doc.uploaded_by === user?.id || hasRole('super_admin')) && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title={t('documents.deleteDoc', 'Delete Document')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mb-1 line-clamp-2">{doc.title}</h3>
                {doc.description && (
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{doc.description}</p>
                )}

                <div className="text-[11px] text-slate-400 space-y-0.5 pt-2 border-t border-slate-100">
                  <div>{t('documents.publishedBy', 'Published by')} <strong className="text-slate-700">{doc.uploaded_by_name || 'Administration'}</strong> · {fmt(doc.created_at)}</div>
                  {doc.file_name && <div className="font-mono truncate">{doc.file_name} {doc.file_size ? `· ${fmtSize(doc.file_size)}` : ''}</div>}
                </div>
              </div>

              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="mt-4 flex items-center justify-center gap-2 w-full px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('documents.openDownload', 'Open / Download Document')}</span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
