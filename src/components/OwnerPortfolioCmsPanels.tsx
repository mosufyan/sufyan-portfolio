import { type FormEvent, useEffect, useState } from 'react';
import {
  Award as AwardIcon,
  BadgeCheck,
  Briefcase,
  Check,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Quote,
  Trash2,
  X,
} from 'lucide-react';
import { usePortfolioContent } from '../contexts/PortfolioContentContext';
import {
  PORTFOLIO_CERT_CATEGORIES,
  PORTFOLIO_REC_TYPES,
  type AwardDraft,
  type CertificationDraft,
  type CiscoRoleDraft,
  type DisciplineDraft,
  type RecommendationDraft,
} from '../utils/portfolioContentValidation';
import { toUserFacingError } from '../utils/userFacingError';

function usePanelChrome(isLight: boolean) {
  return {
    card: isLight
      ? 'border-slate-200 bg-white hover:border-slate-300'
      : 'border-slate-800 bg-[#090d16] hover:border-slate-700',
    titleCls: isLight ? 'text-slate-900' : 'text-white',
    mutedCls: isLight ? 'text-slate-500' : 'text-slate-400',
    bodyCls: isLight ? 'text-slate-600' : 'text-slate-300',
    accentCls: isLight ? 'text-sky-700' : 'text-cyan-400',
    inputCls: isLight
      ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500 focus-visible:ring-sky-500/40'
      : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus-visible:ring-cyan-500/40',
    toolbar: isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#090d16]',
    primaryBtn:
      'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#38bdf8] hover:bg-sky-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60',
  };
}

function Feedback({
  error,
  success,
  isLight,
}: {
  error: string | null;
  success: string | null;
  isLight: boolean;
}) {
  if (!error && !success) return null;
  return (
    <>
      {error && (
        <div
          role="alert"
          className={`rounded-xl border px-3.5 py-2.5 text-xs ${
            isLight
              ? 'border-rose-300 bg-rose-50 text-rose-800'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
          }`}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-center gap-2 ${
            isLight
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-emerald-500/40 bg-emerald-950/35 text-emerald-200'
          }`}
        >
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </>
  );
}

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function listToLines(value: string[]): string {
  return value.join('\n');
}

export function OwnerCredentialsPanel({ isLight }: { isLight: boolean }) {
  const { certifications, upsertCertification, deleteCertification } = usePortfolioContent();
  const ui = usePanelChrome(isLight);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<CertificationDraft>(() => ({
    title: '',
    issuer: '',
    issueDate: '',
    expiryDate: '',
    credentialId: '',
    credentialUrl: '',
    category: 'cloud',
    skills: [],
  }));
  const [skillsText, setSkillsText] = useState('');

  const openNew = () => {
    setEditingId(null);
    setForm({
      title: '',
      issuer: '',
      issueDate: '',
      expiryDate: '',
      credentialId: '',
      credentialUrl: '',
      category: 'cloud',
      skills: [],
    });
    setSkillsText('');
    setComposerOpen(true);
    setError(null);
    setSuccess(null);
  };

  const openEdit = (id: string) => {
    const item = certifications.find((c) => c.id === id);
    if (!item) return;
    setEditingId(id);
    setForm({
      title: item.title,
      issuer: item.issuer,
      issueDate: item.issueDate,
      expiryDate: item.expiryDate || '',
      credentialId: item.credentialId || '',
      credentialUrl: item.credentialUrl || '',
      category: item.category,
      skills: item.skills,
    });
    setSkillsText(item.skills.join(', '));
    setComposerOpen(true);
    setError(null);
    setSuccess(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const skills = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await upsertCertification({ ...form, skills }, editingId || undefined);
      setSuccess(editingId ? 'Certification updated and persisted.' : 'Certification published to portfolio.');
      setComposerOpen(false);
      setEditingId(null);
    } catch (err) {
      setError(toUserFacingError(err, 'Unable to save certification.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${ui.toolbar}`}>
        <div className="flex items-start gap-2.5 min-w-0">
          <BadgeCheck className={`w-4 h-4 mt-0.5 shrink-0 ${ui.accentCls}`} />
          <div className="min-w-0">
            <h3 className={`text-sm font-display font-bold ${ui.titleCls}`}>Licenses &amp; Certifications</h3>
            <p className={`text-xs ${ui.mutedCls}`}>
              Add or edit credentials. Edits persist in Firestore and override seed data by id.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => (composerOpen ? setComposerOpen(false) : openNew())} className={ui.primaryBtn}>
          {composerOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{composerOpen ? 'Cancel' : 'New Certification'}</span>
        </button>
      </div>

      <Feedback error={error} success={success} isLight={isLight} />

      {composerOpen && (
        <form onSubmit={onSubmit} className={`rounded-xl border p-4 space-y-3 ${ui.toolbar}`}>
          <h4 className={`text-sm font-display font-bold ${ui.titleCls}`}>
            {editingId ? 'Edit Certification' : 'Add Certification'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Title *" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Issuer *" value={form.issuer} onChange={(e) => setForm((p) => ({ ...p, issuer: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Issue date *" value={form.issueDate} onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Expiry (optional)" value={form.expiryDate} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} />
            <select className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as CertificationDraft['category'] }))}>
              {PORTFOLIO_CERT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Credential ID" value={form.credentialId} onChange={(e) => setForm((p) => ({ ...p, credentialId: e.target.value }))} />
          </div>
          <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="https:// credential URL" value={form.credentialUrl} onChange={(e) => setForm((p) => ({ ...p, credentialUrl: e.target.value }))} />
          <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Skills (comma-separated)" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="submit" disabled={busy} className={ui.primaryBtn}>
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingId ? 'Save Changes' : 'Publish'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {certifications.map((item) => (
          <div key={item.id} className={`rounded-xl border p-4 space-y-2 ${ui.card}`}>
            <div className={`text-[11px] font-mono ${ui.accentCls}`}>{item.issueDate} · {item.category}</div>
            <div className={`text-sm font-display font-semibold ${ui.titleCls}`}>{item.title}</div>
            <div className={`text-xs ${ui.bodyCls}`}>{item.issuer}</div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => openEdit(item.id)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] ${isLight ? 'border-slate-300' : 'border-slate-700'}`}>
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  void deleteCertification(item.id)
                    .then(() => setSuccess('Certification removed.'))
                    .catch((err) => setError(toUserFacingError(err, 'Delete failed.')));
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] ${isLight ? 'border-rose-300 text-rose-700' : 'border-rose-500/40 text-rose-300'}`}
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OwnerRecognitionPanel({ isLight }: { isLight: boolean }) {
  const { awards, upsertAward, deleteAward } = usePortfolioContent();
  const ui = usePanelChrome(isLight);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<AwardDraft>({
    title: '',
    organization: '',
    date: '',
    category: '',
    description: '',
    associatedWith: '',
  });

  const openEdit = (id: string) => {
    const item = awards.find((a) => a.id === id);
    if (!item) return;
    setEditingId(id);
    setForm({
      title: item.title,
      organization: item.organization,
      date: item.date,
      category: item.category,
      description: item.description,
      associatedWith: item.associatedWith || '',
    });
    setComposerOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertAward(form, editingId || undefined);
      setSuccess(editingId ? 'Award updated and persisted.' : 'Award published.');
      setComposerOpen(false);
      setEditingId(null);
    } catch (err) {
      setError(toUserFacingError(err, 'Unable to save award.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${ui.toolbar}`}>
        <div className="flex items-start gap-2.5">
          <AwardIcon className={`w-4 h-4 mt-0.5 ${ui.accentCls}`} />
          <div>
            <h3 className={`text-sm font-display font-bold ${ui.titleCls}`}>Recognition &amp; Honors</h3>
            <p className={`text-xs ${ui.mutedCls}`}>Edit existing awards or add new ones — persisted in Firestore.</p>
          </div>
        </div>
        <button type="button" className={ui.primaryBtn} onClick={() => { setEditingId(null); setForm({ title: '', organization: '', date: '', category: '', description: '', associatedWith: '' }); setComposerOpen((v) => !v); }}>
          {composerOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{composerOpen ? 'Cancel' : 'New Award'}</span>
        </button>
      </div>
      <Feedback error={error} success={success} isLight={isLight} />
      {composerOpen && (
        <form onSubmit={onSubmit} className={`rounded-xl border p-4 space-y-3 ${ui.toolbar}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Title *" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Organization *" value={form.organization} onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Date *" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
          </div>
          <textarea className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 resize-y ${ui.inputCls}`} required rows={3} placeholder="Description *" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Associated with (Cisco / HCL / TCS)" value={form.associatedWith} onChange={(e) => setForm((p) => ({ ...p, associatedWith: e.target.value }))} />
          <div className="flex justify-end"><button type="submit" disabled={busy} className={ui.primaryBtn}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}<span>{editingId ? 'Save Changes' : 'Publish'}</span></button></div>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {awards.map((item) => (
          <div key={item.id} className={`rounded-xl border p-4 space-y-2 ${ui.card}`}>
            <div className={`text-[11px] font-mono ${ui.accentCls}`}>{item.date} · {item.organization}</div>
            <div className={`text-sm font-display font-semibold ${ui.titleCls}`}>{item.title}</div>
            <p className={`text-xs line-clamp-3 ${ui.bodyCls}`}>{item.description}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => openEdit(item.id)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] ${isLight ? 'border-slate-300' : 'border-slate-700'}`}><Pencil className="w-3 h-3" /> Edit</button>
              <button type="button" onClick={() => void deleteAward(item.id).then(() => setSuccess('Award removed.')).catch((err) => setError(toUserFacingError(err, 'Delete failed.')))} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] ${isLight ? 'border-rose-300 text-rose-700' : 'border-rose-500/40 text-rose-300'}`}><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OwnerRecommendationsPanel({ isLight }: { isLight: boolean }) {
  const { recommendations, upsertRecommendation, deleteRecommendation } = usePortfolioContent();
  const ui = usePanelChrome(isLight);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<RecommendationDraft>({
    author: '',
    role: '',
    date: '',
    relationship: '',
    relationshipType: 'peer',
    quote: '',
    featured: false,
  });

  const openEdit = (id: string) => {
    const item = recommendations.find((r) => r.id === id);
    if (!item) return;
    setEditingId(id);
    setForm({
      author: item.author,
      role: item.role,
      date: item.date,
      relationship: item.relationship,
      relationshipType: item.relationshipType,
      quote: item.quote,
      featured: Boolean(item.featured),
    });
    setComposerOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertRecommendation(form, editingId || undefined);
      setSuccess(editingId ? 'Recommendation updated.' : 'Recommendation published.');
      setComposerOpen(false);
      setEditingId(null);
    } catch (err) {
      setError(toUserFacingError(err, 'Unable to save recommendation.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${ui.toolbar}`}>
        <div className="flex items-start gap-2.5">
          <Quote className={`w-4 h-4 mt-0.5 ${ui.accentCls}`} />
          <div>
            <h3 className={`text-sm font-display font-bold ${ui.titleCls}`}>LinkedIn Recommendations</h3>
            <p className={`text-xs ${ui.mutedCls}`}>Edit existing endorsements or add new quotes — Firestore-backed.</p>
          </div>
        </div>
        <button type="button" className={ui.primaryBtn} onClick={() => { setEditingId(null); setForm({ author: '', role: '', date: '', relationship: '', relationshipType: 'peer', quote: '', featured: false }); setComposerOpen((v) => !v); }}>
          {composerOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{composerOpen ? 'Cancel' : 'New Recommendation'}</span>
        </button>
      </div>
      <Feedback error={error} success={success} isLight={isLight} />
      {composerOpen && (
        <form onSubmit={onSubmit} className={`rounded-xl border p-4 space-y-3 ${ui.toolbar}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Author *" value={form.author} onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Role *" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Date *" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            <select className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} value={form.relationshipType} onChange={(e) => setForm((p) => ({ ...p, relationshipType: e.target.value as RecommendationDraft['relationshipType'] }))}>
              {PORTFOLIO_REC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Relationship label" value={form.relationship} onChange={(e) => setForm((p) => ({ ...p, relationship: e.target.value }))} />
          <textarea className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 resize-y ${ui.inputCls}`} required rows={4} placeholder="Quote *" value={form.quote} onChange={(e) => setForm((p) => ({ ...p, quote: e.target.value }))} />
          <label className={`inline-flex items-center gap-2 text-xs ${ui.bodyCls}`}>
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))} />
            Featured recommendation
          </label>
          <div className="flex justify-end"><button type="submit" disabled={busy} className={ui.primaryBtn}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}<span>{editingId ? 'Save Changes' : 'Publish'}</span></button></div>
        </form>
      )}
      <div className="grid grid-cols-1 gap-3">
        {recommendations.map((item) => (
          <div key={item.id} className={`rounded-xl border p-4 space-y-2 ${ui.card}`}>
            <div className={`text-[11px] font-mono ${ui.accentCls}`}>{item.date} · {item.relationshipType}{item.featured ? ' · featured' : ''}</div>
            <div className={`text-sm font-display font-semibold ${ui.titleCls}`}>{item.author}</div>
            <div className={`text-xs ${ui.mutedCls}`}>{item.role}</div>
            <p className={`text-xs line-clamp-3 ${ui.bodyCls}`}>{item.quote}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => openEdit(item.id)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] ${isLight ? 'border-slate-300' : 'border-slate-700'}`}><Pencil className="w-3 h-3" /> Edit</button>
              <button type="button" onClick={() => void deleteRecommendation(item.id).then(() => setSuccess('Recommendation removed.')).catch((err) => setError(toUserFacingError(err, 'Delete failed.')))} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] ${isLight ? 'border-rose-300 text-rose-700' : 'border-rose-500/40 text-rose-300'}`}><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OwnerDisciplinesPanel({ isLight }: { isLight: boolean }) {
  const { disciplines, upsertDiscipline, deleteDiscipline } = usePortfolioContent();
  const ui = usePanelChrome(isLight);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<DisciplineDraft>({
    title: '',
    status: 'CUSTOM',
    description: '',
    technologies: [],
    level: 90,
  });
  const [techText, setTechText] = useState('');

  const openEdit = (id: string) => {
    const item = disciplines.find((d) => d.id === id);
    if (!item) return;
    setEditingId(id);
    setForm({
      title: item.title,
      status: item.status,
      description: item.description,
      technologies: [...item.technologies],
      level: item.level,
    });
    setTechText(item.technologies.join(', '));
    setComposerOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const technologies = techText.split(',').map((t) => t.trim()).filter(Boolean);
      await upsertDiscipline({ ...form, technologies }, editingId || undefined);
      setSuccess(editingId ? 'Discipline updated.' : 'Discipline published.');
      setComposerOpen(false);
      setEditingId(null);
    } catch (err) {
      setError(toUserFacingError(err, 'Unable to save discipline.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${ui.toolbar}`}>
        <div className="flex items-start gap-2.5">
          <Layers className={`w-4 h-4 mt-0.5 ${ui.accentCls}`} />
          <div>
            <h3 className={`text-sm font-display font-bold ${ui.titleCls}`}>Skills &amp; Architecture Disciplines</h3>
            <p className={`text-xs ${ui.mutedCls}`}>Edit technical discipline cards and technology tags.</p>
          </div>
        </div>
        <button type="button" className={ui.primaryBtn} onClick={() => { setEditingId(null); setForm({ title: '', status: 'CUSTOM', description: '', technologies: [], level: 90 }); setTechText(''); setComposerOpen((v) => !v); }}>
          {composerOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{composerOpen ? 'Cancel' : 'New Discipline'}</span>
        </button>
      </div>
      <Feedback error={error} success={success} isLight={isLight} />
      {composerOpen && (
        <form onSubmit={onSubmit} className={`rounded-xl border p-4 space-y-3 ${ui.toolbar}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Title *" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Status label" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} />
            <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} type="number" min={1} max={100} value={form.level} onChange={(e) => setForm((p) => ({ ...p, level: Number(e.target.value) }))} />
          </div>
          <textarea className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 resize-y ${ui.inputCls}`} required rows={3} placeholder="Description *" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} required placeholder="Technologies (comma-separated) *" value={techText} onChange={(e) => setTechText(e.target.value)} />
          <div className="flex justify-end"><button type="submit" disabled={busy} className={ui.primaryBtn}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}<span>{editingId ? 'Save Changes' : 'Publish'}</span></button></div>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {disciplines.map((item) => (
          <div key={item.id} className={`rounded-xl border p-4 space-y-2 ${ui.card}`}>
            <div className={`text-[11px] font-mono ${ui.accentCls}`}>{item.status} · {item.level}</div>
            <div className={`text-sm font-display font-semibold ${ui.titleCls}`}>{item.title}</div>
            <p className={`text-xs line-clamp-2 ${ui.bodyCls}`}>{item.description}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => openEdit(item.id)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] ${isLight ? 'border-slate-300' : 'border-slate-700'}`}><Pencil className="w-3 h-3" /> Edit</button>
              <button type="button" onClick={() => void deleteDiscipline(item.id).then(() => setSuccess('Discipline removed.')).catch((err) => setError(toUserFacingError(err, 'Delete failed.')))} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] ${isLight ? 'border-rose-300 text-rose-700' : 'border-rose-500/40 text-rose-300'}`}><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OwnerCiscoRolePanel({ isLight }: { isLight: boolean }) {
  const { ciscoRole, saveCiscoRole } = usePortfolioContent();
  const ui = usePanelChrome(isLight);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<CiscoRoleDraft>(ciscoRole);
  const [highlightsText, setHighlightsText] = useState(listToLines(ciscoRole.highlights));
  const [techText, setTechText] = useState(ciscoRole.technologies.join(', '));

  useEffect(() => {
    setForm(ciscoRole);
    setHighlightsText(listToLines(ciscoRole.highlights));
    setTechText(ciscoRole.technologies.join(', '));
  }, [ciscoRole]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveCiscoRole({
        ...form,
        highlights: linesToList(highlightsText),
        technologies: techText.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setSuccess('Cisco current-role highlights saved to Firestore.');
    } catch (err) {
      setError(toUserFacingError(err, 'Unable to save Cisco role.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${ui.toolbar}`}>
        <div className="flex items-start gap-2.5">
          <Briefcase className={`w-4 h-4 mt-0.5 ${ui.accentCls}`} />
          <div>
            <h3 className={`text-sm font-display font-bold ${ui.titleCls}`}>Current Role · Cisco Highlights</h3>
            <p className={`text-xs ${ui.mutedCls}`}>
              Update Project Atlas highlights, domain, proof metrics, and technologies. Persisted and merged live.
            </p>
          </div>
        </div>
      </div>
      <Feedback error={error} success={success} isLight={isLight} />
      <form onSubmit={onSubmit} className={`rounded-xl border p-4 space-y-3 ${ui.toolbar}`}>
        <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Domain" value={form.domain} onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))} />
        <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Proof metric" value={form.proofMetric} onChange={(e) => setForm((p) => ({ ...p, proofMetric: e.target.value }))} />
        <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Recognition badge (optional)" value={form.recognitionBadge} onChange={(e) => setForm((p) => ({ ...p, recognitionBadge: e.target.value }))} />
        <textarea className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 resize-y min-h-32 ${ui.inputCls}`} placeholder="Highlights (one per line)" value={highlightsText} onChange={(e) => setHighlightsText(e.target.value)} />
        <input className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 ${ui.inputCls}`} placeholder="Technologies (comma-separated)" value={techText} onChange={(e) => setTechText(e.target.value)} />
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className={ui.primaryBtn}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Current Role</span>
          </button>
        </div>
      </form>
    </div>
  );
}
