import { type FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  Bell,
  Calendar,
  Check,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useModalPlacement } from '../hooks/useModalPlacement';
import { useTheme } from '../theme/ThemeProvider';
import { CvAnalyticsPanel } from './CvAnalyticsView';
import {
  ANNOUNCEMENT_BADGES,
  ANNOUNCEMENT_CONSTRAINTS,
  OWNER_EMAIL,
  defaultMonthYearLabel,
  validateAnnouncementDraft,
  type AnnouncementBadge,
  type AnnouncementRecord,
} from '../utils/announcementValidation';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  date: string;
  title: string;
  summary: string;
  badge: AnnouncementBadge;
  linkUrl: string;
}

function createEmptyForm(): FormState {
  return {
    date: defaultMonthYearLabel(),
    title: '',
    summary: '',
    badge: 'VERIFIED',
    linkUrl: '',
  };
}

export default function AnnouncementsModal({ isOpen, onClose }: AnnouncementsModalProps) {
  const { isLight } = useTheme();
  const alignClass = useModalPlacement(isOpen);
  const {
    user,
    authReady,
    isOwner,
    announcements,
    usingStarterFallback,
    signInAsOwner,
    signOutOwner,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    importStarterAnnouncements,
    cvDownloadLogs,
  } = useFirebase();

  const [ownerTab, setOwnerTab] = useState<'announcements' | 'analytics'>('announcements');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyForm());
  const [keepStarterOnFirstPublish, setKeepStarterOnFirstPublish] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setOwnerTab('announcements');
      setComposerOpen(false);
      setEditingId(null);
      setConfirmDeleteId(null);
      setFeedbackError(null);
      setFeedbackSuccess(null);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

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
    });
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setComposerOpen(true);
  };

  const handleOwnerLogin = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await signInAsOwner();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user') || msg.includes('cancelled-popup-request')) {
        setFeedbackError('Sign-in popup was closed before completing.');
      } else if (msg.includes('popup-blocked')) {
        setFeedbackError('Sign-in popup was blocked by your browser. Please allow popups and retry.');
      } else {
        setFeedbackError('Unable to complete Google sign-in right now.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const check = validateAnnouncementDraft(form);
    if (!check.valid) {
      setFeedbackError(check.errors[0] || 'Please check the announcement fields.');
      return;
    }

    setBusy(true);
    try {
      if (editingId) {
        await updateAnnouncement(editingId, check.normalized);
        setFeedbackSuccess('Announcement updated.');
      } else {
        await createAnnouncement(check.normalized, keepStarterOnFirstPublish);
        setFeedbackSuccess('Announcement published live.');
      }
      setComposerOpen(false);
      setEditingId(null);
      setForm(createEmptyForm());
    } catch (err) {
      setFeedbackError(
        err instanceof Error ? err.message : 'Unable to save announcement. Please verify owner access.'
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
      setFeedbackError(
        err instanceof Error ? err.message : 'Unable to delete announcement.'
      );
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
      setFeedbackSuccess('Starter milestones imported to live database.');
    } catch (err) {
      setFeedbackError(
        err instanceof Error ? err.message : 'Unable to import starter announcements.'
      );
    } finally {
      setBusy(false);
    }
  };

  const panel = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-700/80 bg-[#0d121f]';
  const card = isLight
    ? 'border-slate-200 bg-slate-50 hover:border-slate-300'
    : 'border-slate-800 bg-[#090d16] hover:border-slate-700';
  const dateCls = isLight ? 'text-sky-700' : 'text-cyan-400';
  const badge = isLight
    ? 'bg-sky-50 border-sky-200 text-sky-800'
    : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const bodyCls = isLight ? 'text-slate-600' : 'text-slate-300';
  const footer = isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0d121f]';
  const backdrop = isLight ? 'bg-slate-900/45' : 'bg-black/80';
  const inputCls = isLight
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500'
    : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500 focus:border-cyan-500';
  const labelCls = isLight ? 'text-slate-600' : 'text-slate-400';

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Announcements & Publications"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-50 flex ${alignClass} justify-center p-2.5 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm overflow-y-auto print:hidden ${backdrop}`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            className={`relative w-full max-w-xl 2xl:max-w-2xl max-h-[min(calc(100dvh-1.5rem),35.5rem)] sm:max-h-[min(calc(100dvh-2.5rem),36rem)] lg:max-h-[min(calc(100dvh-3rem),46rem)] overflow-hidden rounded-2xl border shadow-2xl flex flex-col ${panel}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header only — always dark */}
            <div className="relative flex items-start justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800/90 bg-[#0b101b] shrink-0">
              <ModalHeaderScan active={isOpen} />
              <div className="absolute top-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                    Announcements &amp; Publications
                  </h3>
                  <p className="text-[11px] sm:text-xs font-mono text-cyan-400/90">
                    Architectural milestones, whitepapers, and certifications
                  </p>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Close Announcements"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Body — follows site theme */}
            <div className="flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6 pr-3 sm:pr-5">
              {/* Non-owner signed in banner */}
              {authReady && user && !isOwner && (
                <div
                  className={`rounded-xl border p-3.5 text-xs flex flex-wrap items-center justify-between gap-2 ${
                    isLight
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                  }`}
                >
                  <span className="leading-snug">
                    Signed in as <strong className="font-mono">{user.email}</strong>. Publishing is restricted to{' '}
                    <span className="font-mono">{OWNER_EMAIL}</span>.
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleOwnerLogin()}
                      className="px-2.5 py-1 rounded-md border border-current/30 font-mono text-[11px] hover:opacity-80 cursor-pointer"
                    >
                      Switch Account
                    </button>
                    <button
                      type="button"
                      onClick={() => void signOutOwner()}
                      className="px-2.5 py-1 rounded-md border border-current/30 font-mono text-[11px] hover:opacity-80 cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}

              {/* Owner toolbar */}
              {isOwner && (
                <div
                  className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2 ${
                    isLight
                      ? 'border-sky-200 bg-sky-50/70'
                      : 'border-cyan-500/30 bg-cyan-950/25'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <ShieldCheck className={`w-4 h-4 shrink-0 ${dateCls}`} />
                    <span className={titleCls}>Owner Mode</span>
                    <div
                      className={`ml-1 inline-flex rounded-lg border p-0.5 ${
                        isLight ? 'border-slate-300 bg-white' : 'border-slate-700 bg-[#080c15]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setOwnerTab('announcements')}
                        className={`px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                          ownerTab === 'announcements'
                            ? 'bg-[#38bdf8] text-slate-950 font-semibold'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Announcements
                      </button>
                      <button
                        type="button"
                        onClick={() => setOwnerTab('analytics')}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                          ownerTab === 'analytics'
                            ? 'bg-[#38bdf8] text-slate-950 font-semibold'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <BarChart3 className="w-3 h-3" />
                        <span>CV Downloads ({cvDownloadLogs.length})</span>
                      </button>
                    </div>
                  </div>

                  {ownerTab === 'announcements' && (
                    <div className="flex flex-wrap items-center gap-2">
                      {usingStarterFallback && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleSyncStarter()}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-50 ${
                            isLight
                              ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#38bdf8] hover:bg-sky-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {composerOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{composerOpen ? 'Cancel' : 'New Announcement'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Feedback alerts */}
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

              {isOwner && ownerTab === 'analytics' ? (
                <CvAnalyticsPanel isLight={isLight} />
              ) : (
                <>
                  {/* Owner Add / Edit Form */}
                  <AnimatePresence>
                    {isOwner && composerOpen && (
                      <motion.form
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                        onSubmit={handleSubmit}
                        className={`rounded-xl border p-4 space-y-3 ${
                          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-700/80 bg-[#080d17]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className={`font-display font-bold text-sm ${titleCls}`}>
                            {editingId ? 'Edit Announcement' : 'Publish New Announcement'}
                          </h4>
                          <span className={`text-[10px] font-mono ${labelCls}`}>
                            {form.summary.length}/{ANNOUNCEMENT_CONSTRAINTS.summaryMaxLength} chars
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={`block text-[11px] font-mono uppercase mb-1 ${labelCls}`}>
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
                            <label className={`block text-[11px] font-mono uppercase mb-1 ${labelCls}`}>
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
                          <label className={`block text-[11px] font-mono uppercase mb-1 ${labelCls}`}>
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
                          <label className={`block text-[11px] font-mono uppercase mb-1 ${labelCls}`}>
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
                          <label className={`block text-[11px] font-mono uppercase mb-1 ${labelCls}`}>
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

                        {!editingId && usingStarterFallback && (
                          <label className={`flex items-center gap-2 text-xs cursor-pointer ${bodyCls}`}>
                            <input
                              type="checkbox"
                              checked={keepStarterOnFirstPublish}
                              onChange={(e) => setKeepStarterOnFirstPublish(e.target.checked)}
                              className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                            />
                            <span>Keep existing 3 milestones in the feed alongside this new announcement</span>
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

                  {/* Announcements List */}
                  {announcements.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.04 + idx * 0.03, ease: EASE_OUT_EXPO }}
                      className={`rounded-xl border p-4 space-y-2 transition-colors ${card}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <span className={`flex items-center gap-1.5 ${dateCls}`}>
                          <Calendar className="w-3 h-3" />
                          {item.date}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${badge}`}>
                            {item.badge}
                          </span>

                          {isOwner && item.source === 'cloud' && (
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
                                      isLight ? 'border-slate-300 text-slate-600' : 'border-slate-700 text-slate-300'
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

                      <p className={`text-xs leading-relaxed font-light ${bodyCls}`}>
                        {item.summary}
                      </p>

                      {item.linkUrl && (
                        <a
                          href={item.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-[11px] font-mono pt-0.5 hover:underline ${dateCls}`}
                        >
                          <span>View Reference</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </motion.div>
                  ))}
                </>
              )}
            </div>

            <div className={`px-4 sm:px-6 py-3.5 border-t flex items-center justify-between gap-3 shrink-0 ${footer}`}>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => void signOutOwner()}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-mono transition-colors cursor-pointer ${
                    isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out owner</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleOwnerLogin()}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-60 ${
                    isLight ? 'text-slate-500 hover:text-sky-700' : 'text-slate-400 hover:text-cyan-300'
                  }`}
                >
                  {authBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Owner Manage</span>
                </button>
              )}

              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
