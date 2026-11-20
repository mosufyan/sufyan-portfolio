import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  Printer,
  ShieldCheck,
  Smartphone,
  User,
  X,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useModalPlacement } from '../hooks/useModalPlacement';
import { useTheme } from '../theme/ThemeProvider';
import {
  collectClientTelemetryContext,
  type CvTrackingSummary,
} from '../utils/cvDownloadLogValidation';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import ShineSurface from './ShineSurface';

export type AccessGateAction = 'pdf' | 'print' | 'ats' | 'install';

/** @deprecated Prefer CV_EXPORT_UNLOCK_KEY / PWA_INSTALL_UNLOCK_KEY — kept for session migration */
export const ACCESS_UNLOCK_STORAGE_KEY = 'ms_cv_download_unlocked';
export const CV_EXPORT_UNLOCK_KEY = 'ms_cv_export_unlocked';
export const PWA_INSTALL_UNLOCK_KEY = 'ms_pwa_install_unlocked';
export const CV_SESSION_RECEIPT_KEY = 'ms_cv_session_receipt';
export const PWA_SESSION_RECEIPT_KEY = 'ms_pwa_session_receipt';

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

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface AccessGateModalProps {
  action: AccessGateAction | null;
  formatLabel?: string;
  /** Override site theme (e.g. CV Light Paper). Defaults to site theme. */
  isLight?: boolean;
  onClose: () => void;
  onVerified: (action: AccessGateAction, trackingSummary?: CvTrackingSummary) => void;
}

interface OtpStepState {
  challengeId: string;
  challengeToken: string;
  maskedEmail: string;
  riskReasons: string[];
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

function readStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function removeStorage(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** CV export actions share one unlock; install is tracked separately. */
export function isAccessUnlocked(action: AccessGateAction = 'pdf'): boolean {
  if (action === 'install') {
    return readStorage(PWA_INSTALL_UNLOCK_KEY) === '1';
  }
  if (
    readStorage(CV_EXPORT_UNLOCK_KEY) === '1' ||
    readStorage(ACCESS_UNLOCK_STORAGE_KEY) === '1'
  ) {
    return true;
  }
  return false;
}

export function getSessionReceipt(action: AccessGateAction = 'pdf'): string | null {
  return readStorage(action === 'install' ? PWA_SESSION_RECEIPT_KEY : CV_SESSION_RECEIPT_KEY);
}

export function markAccessUnlocked(action: AccessGateAction, sessionReceipt?: string): void {
  if (action === 'install') {
    writeStorage(PWA_INSTALL_UNLOCK_KEY, '1');
    if (sessionReceipt) writeStorage(PWA_SESSION_RECEIPT_KEY, sessionReceipt);
    return;
  }
  writeStorage(CV_EXPORT_UNLOCK_KEY, '1');
  if (sessionReceipt) writeStorage(CV_SESSION_RECEIPT_KEY, sessionReceipt);
  removeStorage(ACCESS_UNLOCK_STORAGE_KEY);
}

export function clearAccessUnlocked(action: AccessGateAction = 'pdf'): void {
  if (action === 'install') {
    removeStorage(PWA_INSTALL_UNLOCK_KEY);
    removeStorage(PWA_SESSION_RECEIPT_KEY);
    return;
  }
  removeStorage(CV_EXPORT_UNLOCK_KEY);
  removeStorage(CV_SESSION_RECEIPT_KEY);
}

export async function trackSubsequentCvEvent(params: {
  action: AccessGateAction;
  formatLabel: string;
  theme: 'dark' | 'light';
  onPersistLog?: (summary: CvTrackingSummary) => Promise<void>;
}): Promise<CvTrackingSummary | null> {
  const receipt = getSessionReceipt(params.action);
  if (!receipt) return null;

  try {
    const context = collectClientTelemetryContext();
    const res = await fetch('/api/cv-event', {
      method: 'POST',
      signal: AbortSignal.timeout(4000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionReceipt: receipt,
        action: params.action,
        formatLabel: params.formatLabel,
        theme: params.theme,
        ...context,
      }),
    });

    if (res.status === 401) {
      clearAccessUnlocked(params.action);
      return null;
    }

    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      trackingSummary?: CvTrackingSummary;
    };

    if (data.ok && data.trackingSummary) {
      if (params.onPersistLog) {
        void params.onPersistLog(data.trackingSummary).catch((err) => {
          console.warn('Firestore subsequent telemetry write skipped:', err);
        });
      }
      return data.trackingSummary;
    }
    return null;
  } catch {
    return null;
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
  const alignClass = useModalPlacement(action !== null);
  const { recordCvDownloadLog } = useFirebase();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    reason: '',
    website: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpStep, setOtpStep] = useState<OtpStepState | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>(
    () => (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || ''
  );
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (action === null) {
      setOtpStep(null);
      setOtpCode('');
      setError(null);
      setTurnstileToken('');
      return;
    }

    if (!turnstileSiteKey) {
      fetch('/api/access-config')
        .then((r) => (r.ok ? r.json() : null))
        .then((cfg: { turnstileSiteKey?: string } | null) => {
          if (cfg?.turnstileSiteKey) {
            setTurnstileSiteKey(cfg.turnstileSiteKey);
          }
        })
        .catch(() => {
          /* ignore */
        });
    }
  }, [action, turnstileSiteKey]);

  useEffect(() => {
    if (action === null || !turnstileSiteKey || otpStep) return;
    const container = turnstileContainerRef.current;
    if (!container) return;

    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !window.turnstile || !turnstileContainerRef.current) return;
      try {
        if (turnstileWidgetIdRef.current) {
          window.turnstile.remove(turnstileWidgetIdRef.current);
          turnstileWidgetIdRef.current = null;
        }
        turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: turnstileSiteKey,
          theme: isLight ? 'light' : 'dark',
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
      } catch {
        /* ignore */
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
      );
      if (existingScript) {
        existingScript.addEventListener('load', renderWidget, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          /* ignore */
        }
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [action, turnstileSiteKey, isLight, otpStep]);

  const close = () => {
    if (submitting) return;
    setError(null);
    setOtpStep(null);
    setOtpCode('');
    onClose();
  };

  const finalizeVerifiedSession = (
    targetAction: AccessGateAction,
    data: { sessionReceipt?: string; trackingSummary?: CvTrackingSummary }
  ) => {
    markAccessUnlocked(targetAction, data.sessionReceipt);
    if (data.trackingSummary) {
      void recordCvDownloadLog(data.trackingSummary).catch((err) => {
        console.warn('Firestore download log skipped:', err);
      });
    }
    setOtpStep(null);
    setOtpCode('');
    onVerified(targetAction, data.trackingSummary);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!action || submitting) return;

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

    if (turnstileSiteKey && !turnstileToken) {
      setError('Please complete the Cloudflare security verification checkbox below.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const clientContext = collectClientTelemetryContext();
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
          theme: isLight ? 'light' : 'dark',
          turnstileToken,
          ...clientContext,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        status?: 'verified' | 'otp_required';
        provider?: string;
        sessionReceipt?: string;
        trackingSummary?: CvTrackingSummary;
        challengeId?: string;
        challengeToken?: string;
        maskedEmail?: string;
        riskReasons?: string[];
      };

      if (!response.ok) {
        if (turnstileWidgetIdRef.current && window.turnstile) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
          setTurnstileToken('');
        }
        throw new Error(data.error || 'Could not verify request right now. Please try again.');
      }

      // Honeypot hits return 200 + provider:"filtered" — fake success, never unlock
      if (data.ok !== true || data.provider === 'filtered') {
        onClose();
        return;
      }

      if (data.status === 'otp_required' && data.challengeId && data.challengeToken) {
        setOtpStep({
          challengeId: data.challengeId,
          challengeToken: data.challengeToken,
          maskedEmail: data.maskedEmail || cleanEmail,
          riskReasons: Array.isArray(data.riskReasons) ? data.riskReasons : [],
        });
        setOtpCode('');
        return;
      }

      finalizeVerifiedSession(action, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify request right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!action || !otpStep || submitting) return;

    const cleanCode = otpCode.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      setError('Please enter the 6-digit numeric code sent to your email.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/cv-verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: otpStep.challengeId,
          challengeToken: otpStep.challengeToken,
          code: cleanCode,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        sessionReceipt?: string;
        trackingSummary?: CvTrackingSummary;
      };

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || 'Invalid verification code. Please check and try again.');
      }

      finalizeVerifiedSession(action, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const quickPicks = action === 'install' ? INSTALL_REASON_QUICK_PICKS : REASON_QUICK_PICKS;
  const SubmitIcon = action ? submitLabel(action).icon : Download;

  const panel = isLight
    ? 'border-slate-200 bg-white'
    : 'border-slate-700 bg-[#0d121f]';
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
          className={`fixed inset-0 z-[60] flex ${alignClass} justify-center p-2.5 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm overflow-y-auto print:hidden ${
            isLight ? 'bg-slate-900/45' : 'bg-black/80'
          }`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
            className={`access-gate-modal w-full max-w-lg 2xl:max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[min(calc(100dvh-1.5rem),36rem)] sm:max-h-[min(calc(100dvh-2.5rem),38rem)] lg:max-h-[min(calc(100dvh-3rem),46rem)] ${panel}`}
          >
            {/* Always-dark header */}
            <div className={`relative shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b ${header}`}>
              <ModalHeaderScan active={action !== null} />
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${lockBox}`}>
                  {otpStep ? <KeyRound className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-display font-bold text-base ${title}`}>
                      {otpStep ? 'Enter Email Verification Code' : `Verify to ${actionTitle(action)}`}
                    </h3>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${badge}`}>
                      {formatLabel}
                    </span>
                  </div>
                  <p className={`text-[11px] font-mono mt-0.5 ${headerMuted}`}>
                    {otpStep
                      ? `6-digit code dispatched to ${otpStep.maskedEmail}`
                      : action === 'install'
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

            {otpStep ? (
              <form onSubmit={handleOtpSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className={`p-3 rounded-xl border text-xs ${errorBox}`}
                  >
                    {error}
                  </div>
                )}

                <div
                  className={`rounded-xl border p-3.5 text-xs space-y-1.5 ${
                    isLight
                      ? 'border-sky-200 bg-sky-50/70 text-slate-700'
                      : 'border-cyan-500/30 bg-cyan-950/25 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-[11px] uppercase">
                    <ShieldCheck className={`w-3.5 h-3.5 ${icon}`} />
                    <span>Adaptive Verification Required</span>
                  </div>
                  <p className="leading-relaxed">
                    We sent a 6-digit verification code to{' '}
                    <strong className="font-mono">{otpStep.maskedEmail}</strong>. Check your inbox or spam folder and enter the code below.
                  </p>
                  {otpStep.riskReasons.length > 0 && (
                    <p className={`text-[11px] font-mono ${muted}`}>
                      Trigger: {otpStep.riskReasons.join(' · ')}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="access-gate-otp"
                    className={`flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider mb-1.5 ${label}`}
                  >
                    <KeyRound className={`w-3 h-3 ${icon}`} />
                    <span>6-Digit Verification Code *</span>
                  </label>
                  <input
                    id="access-gate-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      if (error) setError(null);
                      setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6));
                    }}
                    placeholder="123456"
                    className={`w-full px-4 py-3 rounded-xl border text-center font-mono text-xl tracking-[0.35em] focus:outline-none transition-colors ${field}`}
                  />
                </div>

                <div className={`flex items-center justify-between gap-2.5 pt-2 border-t ${footer}`}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setOtpStep(null);
                      setOtpCode('');
                      setError(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${cancelBtn}`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Edit Details</span>
                  </button>

                  <ShineSurface className="rounded-xl" shineClassName="via-white/45">
                    <button
                      type="submit"
                      disabled={submitting || otpCode.length !== 6}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#38bdf8] hover:bg-sky-300 disabled:opacity-60 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-sky-500/20 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying Code...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify &amp; Unlock</span>
                        </>
                      )}
                    </button>
                  </ShineSurface>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
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
                        placeholder="+1 (408) 555-1234"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none transition-colors ${field}`}
                      />
                    </div>
                  </div>
                  <p className={`text-[11px] font-mono ${muted}`}>
                    Provide a valid Email ID or Phone Number (VPN/proxy networks require Email OTP).
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

                {turnstileSiteKey && (
                  <div className="flex justify-center pt-1">
                    <div ref={turnstileContainerRef} />
                  </div>
                )}

                <p className={`text-[10px] font-mono leading-relaxed ${muted}`}>
                  Security notice: Email domain MX, network location, and export activity are logged to protect against automated scraping.
                </p>

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
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Portal outside .site-theme so light remapping cannot wash out the dark header
  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
