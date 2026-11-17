import { FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Copy,
  Download,
  FileText,
  Loader2,
  Lock,
  Mail,
  Phone,
  Printer,
  Smartphone,
  User,
  X,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import ShineSurface from './ShineSurface';

export type AccessGateAction = 'pdf' | 'print' | 'ats' | 'install';

export const ACCESS_UNLOCK_STORAGE_KEY = 'ms_cv_download_unlocked';

const REASON_QUICK_PICKS = [
  'Recruiting / Hiring Role',
  'Architecture Review',
  'Advisory / Consulting',
  'Networking / Reference',
] as const;

const INSTALL_REASON_QUICK_PICKS = [
  'Offline portfolio access',
  'Recruiting / Hiring Role',
  'Architecture Review',
  'Networking / Reference',
] as const;

interface AccessGateModalProps {
  action: AccessGateAction | null;
  formatLabel?: string;
  /** Override site theme (e.g. CV Light Paper). Defaults to site theme. */
  isLight?: boolean;
  onClose: () => void;
  onVerified: (action: AccessGateAction) => void;
}

function actionTitle(action: AccessGateAction): string {
  if (action === 'print') return 'Print CV';
  if (action === 'ats') return 'Copy ATS Text';
  if (action === 'install') return 'Install App';
  return 'Download PDF';
}

function reasonLabel(action: AccessGateAction): string {
  if (action === 'install') return 'Why do you want to install this portfolio app? *';
  return 'Why do you want to download / print this CV? *';
}

function submitLabel(action: AccessGateAction): { icon: typeof Download; text: string } {
  if (action === 'print') return { icon: Printer, text: 'Verify & Print CV' };
  if (action === 'ats') return { icon: Copy, text: 'Verify & Copy ATS Text' };
  if (action === 'install') return { icon: Smartphone, text: 'Verify & Install App' };
  return { icon: Download, text: 'Verify & Download PDF' };
}

export function isAccessUnlocked(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(ACCESS_UNLOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAccessUnlocked(): void {
  try {
    window.sessionStorage.setItem(ACCESS_UNLOCK_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function AccessGateModal({
  action,
  formatLabel = 'Portfolio Access',
  isLight: isLightProp,
  onClose,
  onVerified,
}: AccessGateModalProps) {
  const { isLight: siteIsLight } = useTheme();
  const isLight = isLightProp ?? siteIsLight;

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    reason: '',
    website: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!action) return;

    const cleanName = form.name.trim();
    const cleanEmail = form.email.trim();
    const cleanPhone = form.phone.trim();
    const cleanReason = form.reason.trim();

    if (!cleanEmail && !cleanPhone) {
      setError('Please provide either your Email ID or Phone Number to continue.');
      return;
    }

    if (cleanEmail) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
      if (/[?#<>()[\]\\,;:\s]/.test(cleanEmail) || !emailRegex.test(cleanEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
    }

    if (cleanPhone) {
      const digits = cleanPhone.replace(/\D/g, '').length;
      if (!/^[+\d\s().-]+$/.test(cleanPhone) || digits < 7 || digits > 15) {
        setError('Please enter a valid phone number (at least 7 digits).');
        return;
      }
    }

    if (cleanReason.length < 3) {
      setError(
        action === 'install'
          ? 'Please share a brief reason (at least 3 characters) why you want to install this app.'
          : 'Please share a brief reason (at least 3 characters) why you want to download or print this CV.'
      );
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/cv-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          reason: cleanReason,
          action,
          formatLabel,
          website: form.website,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Could not verify request right now. Please try again.');
      }

      markAccessUnlocked();
      onVerified(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify request right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const quickPicks = action === 'install' ? INSTALL_REASON_QUICK_PICKS : REASON_QUICK_PICKS;
  const SubmitIcon = action ? submitLabel(action).icon : Download;

  const panel = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-700 bg-[#0d121f]';
  // Header chrome stays dark in both themes for brand consistency
  const header = 'border-slate-800 bg-[#080b13]';
  const lockBox = 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400';
  const title = 'text-white';
  const badge = 'bg-cyan-950/50 border-cyan-500/30 text-cyan-300';
  const headerMuted = 'text-slate-400';
  const closeBtn = 'text-slate-400 hover:text-white hover:bg-slate-800';
  const muted = isLight ? 'text-slate-500' : 'text-slate-400';
  const label = isLight ? 'text-slate-500' : 'text-slate-400';
  const icon = isLight ? 'text-sky-700' : 'text-cyan-400';
  const field = isLight
    ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-sky-500/60'
    : 'bg-[#090d16] border-slate-800 text-slate-200 placeholder-slate-600 focus:border-cyan-500/60';
  const chipIdle = isLight
    ? 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
    : 'bg-[#090d16] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700';
  const chipActive = isLight
    ? 'bg-sky-50 border-sky-400 text-sky-800'
    : 'bg-cyan-500/20 border-cyan-400 text-cyan-200';
  const footer = isLight ? 'border-slate-200' : 'border-slate-800/80';
  const cancelBtn = isLight
    ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900'
    : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white';
  const errorBox = isLight
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : 'bg-rose-950/40 border-rose-500/40 text-rose-300';

  const modal = (
    <AnimatePresence>
      {action !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
          className={`fixed inset-0 z-[60] flex justify-center p-4 backdrop-blur-sm overflow-y-auto print:hidden ${
            isLight ? 'bg-slate-900/45' : 'bg-black/80'
          }`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
            className={`access-gate-modal w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden my-auto ${panel}`}
          >
            {/* Always-dark header — must stay outside .site-theme remapping (ported to body) */}
            <div className={`relative flex items-start justify-between gap-3 px-5 py-4 border-b ${header}`}>
              <ModalHeaderScan active={action !== null} />
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${lockBox}`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-display font-bold text-base ${title}`}>
                      Verify to {actionTitle(action)}
                    </h3>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${badge}`}>
                      {formatLabel}
                    </span>
                  </div>
                  <p className={`text-[11px] font-mono mt-0.5 ${headerMuted}`}>
                    {action === 'install'
                      ? 'Quick check — notifies Mohammed Sufyan before unlocking install'
                      : 'Quick check — notifies Mohammed Sufyan before unlocking export'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={close}
                disabled={submitting}
                aria-label="Close verification prompt"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0 ${closeBtn}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="access-gate-website">Leave this field blank</label>
                <input
                  id="access-gate-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className={`p-3 rounded-xl border text-xs ${errorBox}`}
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="access-gate-name"
                  className={`flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider mb-1.5 ${label}`}
                >
                  <User className={`w-3 h-3 ${icon}`} />
                  <span>Full Name (Optional)</span>
                </label>
                <input
                  id="access-gate-name"
                  type="text"
                  autoFocus
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => {
                    if (error) setError(null);
                    setForm((prev) => ({ ...prev, name: e.target.value }));
                  }}
                  placeholder="e.g. Alex Rivera"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none transition-colors ${field}`}
                />
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="access-gate-email"
                      className={`flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider mb-1.5 ${label}`}
                    >
                      <Mail className={`w-3 h-3 ${icon}`} />
                      <span>Email ID</span>
                    </label>
                    <input
                      id="access-gate-email"
                      type="email"
                      maxLength={254}
                      value={form.email}
                      onChange={(e) => {
                        if (error) setError(null);
                        setForm((prev) => ({ ...prev, email: e.target.value }));
                      }}
                      placeholder="you@company.com"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none transition-colors ${field}`}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="access-gate-phone"
                      className={`flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider mb-1.5 ${label}`}
                    >
                      <Phone className={`w-3 h-3 ${icon}`} />
                      <span>Phone Number</span>
                    </label>
                    <input
                      id="access-gate-phone"
                      type="tel"
                      maxLength={40}
                      value={form.phone}
                      onChange={(e) => {
                        if (error) setError(null);
                        setForm((prev) => ({ ...prev, phone: e.target.value }));
                      }}
                      placeholder="+1 (555) 000-0000"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none transition-colors ${field}`}
                    />
                  </div>
                </div>
                <p className={`text-[11px] font-mono ${muted}`}>
                  Provide at least an Email ID or Phone Number.
                </p>
              </div>

              <div>
                <label
                  htmlFor="access-gate-reason"
                  className={`flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider mb-2 ${label}`}
                >
                  <FileText className={`w-3 h-3 ${icon}`} />
                  <span>{reasonLabel(action)}</span>
                </label>

                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {quickPicks.map((pick) => {
                    const active = form.reason.trim() === pick;
                    return (
                      <button
                        key={pick}
                        type="button"
                        onClick={() => {
                          if (error) setError(null);
                          setForm((prev) => ({ ...prev, reason: pick }));
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors cursor-pointer ${
                          active ? chipActive : chipIdle
                        }`}
                      >
                        {pick}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  id="access-gate-reason"
                  rows={3}
                  required
                  minLength={3}
                  maxLength={5000}
                  value={form.reason}
                  onChange={(e) => {
                    if (error) setError(null);
                    setForm((prev) => ({ ...prev, reason: e.target.value }));
                  }}
                  placeholder={
                    action === 'install'
                      ? 'e.g. Want offline access to portfolio credentials and timeline...'
                      : 'e.g. Evaluating for Principal Cloud Architect role, technical review, or advisory discussion...'
                  }
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none transition-colors resize-none ${field}`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2.5 pt-2 border-t ${footer}`}>
                <button
                  type="button"
                  onClick={close}
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${cancelBtn}`}
                >
                  Cancel
                </button>
                <ShineSurface className="rounded-xl" shineClassName="via-white/45">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#38bdf8] hover:bg-sky-300 disabled:opacity-60 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-sky-500/20 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying &amp; Notifying...</span>
                      </>
                    ) : (
                      <>
                        <SubmitIcon className="w-3.5 h-3.5" />
                        <span>{submitLabel(action).text}</span>
                      </>
                    )}
                  </button>
                </ShineSurface>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Portal outside .site-theme so light remapping cannot wash out the dark header
  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
