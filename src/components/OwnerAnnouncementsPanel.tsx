import { type FormEvent, useState } from 'react';
import {
  Calendar,
  Check,
  ExternalLink,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  ANNOUNCEMENT_BADGES,
  ANNOUNCEMENT_CONSTRAINTS,
  ANNOUNCEMENT_STATUSES,
  defaultMonthYearLabel,
  validateAnnouncementDraft,
  type AnnouncementBadge,
  type AnnouncementRecord,
  type AnnouncementStatus,
} from '../utils/announcementValidation';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import { toUserFacingError } from '../utils/userFacingError';

interface FormState {
  date: string;
  title: string;
  summary: string;
  badge: AnnouncementBadge;
  linkUrl: string;
  status: AnnouncementStatus;
  scheduledLocal: string;
}

function createEmptyForm(): FormState {
  return {
    date: defaultMonthYearLabel(),
    title: '',
    summary: '',
    badge: 'VERIFIED',
    linkUrl: '',
    status: 'published',
    scheduledLocal: '',
  };
}

function toLocalInputValue(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OwnerAnnouncementsPanel({ isLight }: { isLight: boolean }) {
  const {
    announcements,
    usingStarterFallback,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    importStarterAnnouncements,
  } = useFirebase();

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyForm());
  const [keepStarterOnFirstPublish, setKeepStarterOnFirstPublish] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const openNewComposer = () => {
    setEditingId(null);
    setForm(createEmptyForm());
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setComposerOpen(true);
  };

  const openEditComposer = (item: AnnouncementRecord) => {
    setEditingId(item.id);
    setForm({
      date: item.date,
      title: item.title,
      summary: item.summary,
      badge: item.badge,
      linkUrl: item.linkUrl,
      status: item.status || 'published',
      scheduledLocal: toLocalInputValue(item.scheduledAtMs),
    });
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setComposerOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const scheduledAtMs =
      form.status === 'scheduled' && form.scheduledLocal
        ? new Date(form.scheduledLocal).getTime()
        : null;

    const check = validateAnnouncementDraft({
      ...form,
      scheduledAtMs,
    });
    if (!check.valid) {
      setFeedbackError(check.errors[0] || 'Please check the announcement fields.');
      return;
    }

    setBusy(true);
    try {
      if (editingId) {
        await updateAnnouncement(editingId, check.normalized);
        setFeedbackSuccess('Announcement updated cleanly.');
      } else {
        await createAnnouncement(check.normalized, keepStarterOnFirstPublish);
        setFeedbackSuccess(
          check.normalized.status === 'published'
            ? 'Announcement published live to visitors.'
            : `Announcement saved as ${check.normalized.status}.`
        );
      }
      setComposerOpen(false);
      setEditingId(null);
      setForm(createEmptyForm());
    } catch (err) {
      setFeedbackError(
        toUserFacingError(err, 'Unable to save announcement. Please verify owner access.')
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await deleteAnnouncement(id);
      setConfirmDeleteId(null);
      setFeedbackSuccess('Announcement deleted.');
    } catch (err) {
      setFeedbackError(toUserFacingError(err, 'Unable to delete announcement.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSyncStarter = async () => {
    if (busy) return;
    setBusy(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await importStarterAnnouncements();
      setFeedbackSuccess('Starter milestones imported into live Firestore.');
    } catch (err) {
      setFeedbackError(
        toUserFacingError(err, 'Unable to import starter announcements.')
      );
    } finally {
      setBusy(false);
    }
  };

  const card = isLight
    ? 'border-slate-200 bg-white hover:border-slate-300'
    : 'border-slate-800 bg-[#090d16] hover:border-slate-700';
  const dateCls = isLight ? 'text-sky-700' : 'text-cyan-400';
  const badgeCls = isLight
    ? 'bg-sky-50 border-sky-200 text-sky-800'
    : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const bodyCls = isLight ? 'text-slate-600' : 'text-slate-300';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const inputCls = isLight
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500'
    : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500 focus:border-cyan-500';

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div
        className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#090d16]'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <Megaphone className={`w-4 h-4 mt-0.5 shrink-0 ${dateCls}`} />
          <div>
            <h3 className={`text-sm font-display font-bold ${titleCls}`}>
              Announcements &amp; Career Milestones
            </h3>
            <p className={`text-xs ${mutedCls}`}>
              Publish architecture launches, publications, awards, and certification updates synced in real time.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {usingStarterFallback && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSyncStarter()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer disabled:opacity-50 ${
                isLight
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-cyan-500/40'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Sync Starter Items</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (composerOpen ? setComposerOpen(false) : openNewComposer())}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#38bdf8] hover:bg-sky-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            {composerOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{composerOpen ? 'Cancel' : 'New Announcement'}</span>
          </button>
        </div>
      </div>

      {feedbackError && (
        <div
          role="alert"
          className={`rounded-xl border px-3.5 py-2.5 text-xs ${
            isLight
              ? 'border-rose-300 bg-rose-50 text-rose-800'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
          }`}
        >
          {feedbackError}
        </div>
      )}

      {feedbackSuccess && (
        <div
          role="status"
          className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-center gap-2 ${
            isLight
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-emerald-500/40 bg-emerald-950/35 text-emerald-200'
          }`}
        >
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {/* Create / Edit Composer */}
      <AnimatePresence>
        {composerOpen && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            onSubmit={handleSubmit}
            className={`rounded-xl border p-4 sm:p-5 space-y-3 ${
              isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-700/80 bg-[#080d17]'
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className={`font-display font-bold text-sm ${titleCls}`}>
                {editingId ? 'Edit Announcement' : 'Publish New Announcement'}
              </h4>
              <span className={`text-[10px] font-mono ${mutedCls}`}>
                {form.summary.length}/{ANNOUNCEMENT_CONSTRAINTS.summaryMaxLength} chars
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-mono uppercase mb-1 ${mutedCls}`}>
                  Date Label *
                </label>
                <input
                  type="text"
                  required
                  minLength={ANNOUNCEMENT_CONSTRAINTS.dateMinLength}
                  maxLength={ANNOUNCEMENT_CONSTRAINTS.dateMaxLength}
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  placeholder="NOVEMBER 2026"
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none ${inputCls}`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-mono uppercase mb-1 ${mutedCls}`}>
                  Category Badge
                </label>
                <select
                  value={form.badge}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, badge: e.target.value as AnnouncementBadge }))
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none ${inputCls}`}
                >
                  {ANNOUNCEMENT_BADGES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-[11px] font-mono uppercase mb-1 ${mutedCls}`}>
                Title *
              </label>
              <input
                type="text"
                required
                minLength={ANNOUNCEMENT_CONSTRAINTS.titleMinLength}
                maxLength={ANNOUNCEMENT_CONSTRAINTS.titleMaxLength}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Zero Trust Security Architecture Summit Keynote"
                className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
              />
            </div>

            <div>
              <label className={`block text-[11px] font-mono uppercase mb-1 ${mutedCls}`}>
                Summary *
              </label>
              <textarea
                required
                rows={3}
                minLength={ANNOUNCEMENT_CONSTRAINTS.summaryMinLength}
                maxLength={ANNOUNCEMENT_CONSTRAINTS.summaryMaxLength}
                value={form.summary}
                onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                placeholder="Describe the milestone, recognition, certification, or publication..."
                className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none resize-y ${inputCls}`}
              />
            </div>

            <div>
              <label className={`block text-[11px] font-mono uppercase mb-1 ${mutedCls}`}>
                Reference URL (Optional, https://)
              </label>
              <input
                type="url"
                maxLength={ANNOUNCEMENT_CONSTRAINTS.linkUrlMaxLength}
                value={form.linkUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                placeholder="https://www.mohammedsufyan.com/..."
                className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none ${inputCls}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-mono uppercase mb-1 ${mutedCls}`}>
                  Publish Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as AnnouncementStatus,
                    }))
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none ${inputCls}`}
                >
                  {ANNOUNCEMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-[11px] font-mono uppercase mb-1 ${mutedCls}`}>
                  Schedule (local time)
                </label>
                <input
                  type="datetime-local"
                  disabled={form.status !== 'scheduled'}
                  value={form.scheduledLocal}
                  onChange={(e) => setForm((prev) => ({ ...prev, scheduledLocal: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none disabled:opacity-40 ${inputCls}`}
                />
              </div>
            </div>

            {!editingId && usingStarterFallback && (
              <label className={`flex items-center gap-2 text-xs cursor-pointer ${bodyCls}`}>
                <input
                  type="checkbox"
                  checked={keepStarterOnFirstPublish}
                  onChange={(e) => setKeepStarterOnFirstPublish(e.target.checked)}
                  className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Keep existing starter milestones alongside this announcement</span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(false);
                  setEditingId(null);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isLight
                    ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#38bdf8] hover:bg-sky-300 disabled:opacity-60 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{editingId ? 'Save Changes' : 'Publish'}</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Announcements Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {announcements.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl border p-4 space-y-2 transition-colors flex flex-col justify-between ${card}`}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <span className={`flex items-center gap-1.5 ${dateCls}`}>
                  <Calendar className="w-3 h-3" />
                  {item.date}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${badgeCls}`}>
                    {item.badge}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase border ${
                      item.source === 'cloud'
                        ? isLight
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                        : isLight
                          ? 'border-slate-200 bg-slate-100 text-slate-500'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {item.source === 'cloud' ? 'Cloud' : 'Starter'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase ${
                      item.status === 'published'
                        ? isLight
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                        : item.status === 'scheduled'
                          ? isLight
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                          : isLight
                            ? 'border-slate-300 bg-slate-100 text-slate-600'
                            : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {item.status || 'published'}
                  </span>

                  {item.source === 'cloud' && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditComposer(item)}
                        title="Edit announcement"
                        aria-label={`Edit ${item.title}`}
                        className={`p-1 rounded border transition-colors cursor-pointer ${
                          isLight
                            ? 'border-slate-200 text-slate-600 hover:text-sky-700 hover:border-sky-300'
                            : 'border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40'
                        }`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>

                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDelete(item.id)}
                            className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-white text-[10px] font-semibold cursor-pointer disabled:opacity-60"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className={`px-1.5 py-0.5 rounded border text-[10px] cursor-pointer ${
                              isLight
                                ? 'border-slate-300 text-slate-600'
                                : 'border-slate-700 text-slate-300'
                            }`}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          title="Delete announcement"
                          aria-label={`Delete ${item.title}`}
                          className={`p-1 rounded border transition-colors cursor-pointer ${
                            isLight
                              ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300'
                              : 'border-slate-800 text-slate-400 hover:text-rose-300 hover:border-rose-500/40'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <h4 className={`text-sm font-display font-bold leading-snug ${titleCls}`}>
                {item.title}
              </h4>

              <p className={`text-xs leading-relaxed font-light ${bodyCls}`}>{item.summary}</p>
            </div>

            {item.linkUrl && (
              <a
                href={item.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-[11px] font-mono pt-1 hover:underline ${dateCls}`}
              >
                <span>View Reference</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
