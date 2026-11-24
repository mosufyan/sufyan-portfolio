import { Linkedin } from './icons/Linkedin';
import { useEffect, useRef, useState } from 'react';
import {
  Mail,
  Send,
  Check,
  Copy,
  ArrowUpRight,
  ArrowLeft,
  MessageSquare,
  Clock,
  QrCode,
  UserPlus,
  Sparkles,
  KeyRound,
  ShieldCheck,
  PauseCircle,
  Loader2,
  Reply,
  Target,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PERSONAL_INFO } from '../data/portfolioData';
import { useFirebase } from '../contexts/FirebaseContext';
import { useTheme } from '../theme/ThemeProvider';
import { viteTurnstileSiteKey } from '../vitePublicEnv.ts';
import type { ContactMessageSummary } from '../utils/contactMessageLogValidation';
import { collectClientTelemetryContext } from '../utils/cvDownloadLogValidation';
import {
  PHONE_COUNTRY_OPTIONS,
  detectCountryFromPlusPrefix,
  guessDefaultPhoneCountry,
  validateAndNormalizePhone,
  type SelectedPhoneCountry,
} from '../utils/phoneValidation';
import { downloadVCard } from '../utils/vcard';
import HeaderSpotlight from './HeaderSpotlight';
import { Reveal, EASE_OUT_EXPO } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';
import { toUserFacingError } from '../utils/userFacingError';

interface ContactProps {
  onOpenDigitalCard?: () => void;
}

interface ContactOtpStepState {
  challengeId: string;
  challengeToken: string;
  maskedEmail: string;
}

const INTENT_PRESETS = [
  {
    id: 'role',
    label: 'Software Engineer Role',
    subject: 'Opportunity: Software Engineer — Security / Platform',
    starter:
      'Hi Mohammed,\n\nWe are hiring for a Software Engineer role focused on security data platforms or multi-cloud systems and would love to connect regarding scope, timeline, and availability.',
  },
  {
    id: 'architecture',
    label: 'Security & AI Platforms',
    subject: 'Architecture Inquiry: Zero Trust & AI Data Platforms',
    starter:
      'Hi Mohammed,\n\nI reviewed your Cisco Systems Inc. STO and multi-cloud security work and would like to discuss an enterprise architecture challenge involving security data pipelines or GenAI.',
  },
  {
    id: 'advisory',
    label: 'Advisory / Consulting',
    subject: 'Advisory & Cloud Governance Discussion',
    starter:
      'Hi Mohammed,\n\nWe are looking for technical advisory on multi-cloud resilience, DevSecOps governance, or FinOps optimization.',
  },
  {
    id: 'speaking',
    label: 'Speaking / Reference',
    subject: 'Leadership Discussion / Technical Reference',
    starter:
      'Hi Mohammed,\n\nReaching out regarding a technical panel, engineering leadership roundtable, or reference conversation.',
  },
];

function formatSanJoseTime(): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date());
  } catch {
    return 'San Jose, CA (PST/PDT)';
  }
}

export default function Contact({ onOpenDigitalCard }: ContactProps) {
  const { theme, accent, isLight } = useTheme();
  const { recordContactMessageLog, portfolioSettings, effectivePortfolioSettings } = useFirebase();
  const shouldReduceMotion = useReducedMotion();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    website: '',
  });
  const [phoneCountry, setPhoneCountry] = useState<SelectedPhoneCountry>(() =>
    guessDefaultPhoneCountry()
  );
  const [status, setStatus] = useState<'idle' | 'sending' | 'otp' | 'success' | 'error'>('idle');
  const [otpStep, setOtpStep] = useState<ContactOtpStepState | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [vcfSaved, setVcfSaved] = useState(false);
  const [localTime, setLocalTime] = useState<string>(() => formatSanJoseTime());
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>(
    () => viteTurnstileSiteKey()
  );
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLocalTime(formatSanJoseTime());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (turnstileSiteKey) return;
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
  }, [turnstileSiteKey]);

  const showingOtpPanel = Boolean(otpStep && (status === 'otp' || status === 'sending'));

  useEffect(() => {
    if (!turnstileSiteKey || showingOtpPanel || !effectivePortfolioSettings.enableContactForm) return;
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
  }, [turnstileSiteKey, isLight, showingOtpPanel, effectivePortfolioSettings.enableContactForm]);

  const copyEmail = () => {
    navigator.clipboard
      ?.writeText(PERSONAL_INFO.email)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  const handleSaveVcf = () => {
    downloadVCard();
    setVcfSaved(true);
    window.setTimeout(() => setVcfSaved(false), 2400);
  };

  const applyIntentPreset = (preset: (typeof INTENT_PRESETS)[number]) => {
    const isStarterOrEmpty =
      !formData.message.trim() ||
      INTENT_PRESETS.some((p) => p.starter === formData.message.trim());
    setFormData((prev) => ({
      ...prev,
      subject: preset.subject,
      message: isStarterOrEmpty ? preset.starter : prev.message,
    }));
  };

  const availabilityBadge = (() => {
    const custom = portfolioSettings.availabilityText.trim();
    if (portfolioSettings.availabilityStatus === 'advisory') {
      return {
        dotCls: 'bg-amber-400',
        textCls: 'text-amber-300',
        label: custom || 'Advisory & Consulting · San Jose, CA',
      };
    }
    if (portfolioSettings.availabilityStatus === 'unavailable') {
      return {
        dotCls: 'bg-rose-400',
        textCls: 'text-rose-300',
        label: custom || 'Limited Availability · San Jose, CA',
      };
    }
    return {
      dotCls: 'bg-emerald-400',
      textCls: 'text-emerald-300',
      label: custom || 'Active · San Jose, CA',
    };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectivePortfolioSettings.enableContactForm) {
      setStatus('error');
      setErrorMsg(
        'Direct form submissions are temporarily paused. Please use the email button below.'
      );
      return;
    }

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setStatus('error');
      setErrorMsg('Please fill out the required fields: Name, Email, and Message.');
      return;
    }

    let normalizedPhone = '';
    if (formData.phone.trim()) {
      const phoneCheck = validateAndNormalizePhone(formData.phone, phoneCountry);
      if (!phoneCheck.valid) {
        setStatus('error');
        setErrorMsg(
          phoneCheck.reason ||
            'Please provide a genuine phone number (with country code) or leave it blank.'
        );
        return;
      }
      normalizedPhone = phoneCheck.normalizedE164;
    }

    if (turnstileSiteKey && !turnstileToken) {
      setStatus('error');
      setErrorMsg('Please complete the Cloudflare security verification checkbox below.');
      return;
    }

    setErrorMsg('');
    setStatus('sending');

    try {
      const clientContext = collectClientTelemetryContext();
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: normalizedPhone,
          subject: formData.subject.trim(),
          message: formData.message.trim(),
          website: formData.website,
          theme,
          accent,
          turnstileToken,
          ...clientContext,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        status?: 'otp_required' | 'sent';
        provider?: string;
        challengeId?: string;
        challengeToken?: string;
        maskedEmail?: string;
        contactSummary?: ContactMessageSummary;
        telemetryPersistedByServer?: boolean;
      };

      if (!response.ok) {
        if (turnstileWidgetIdRef.current && window.turnstile) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
          setTurnstileToken('');
        }
        throw new Error(data.error || 'Unable to send message right now.');
      }

      // Honeypot hits return ok: true + provider: 'filtered'
      if (data.provider === 'filtered') {
        setStatus('success');
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: '',
          message: '',
          website: '',
        });
        setTimeout(() => setStatus('idle'), 6000);
        return;
      }

      if (data.status === 'otp_required' && data.challengeId && data.challengeToken) {
        setOtpStep({
          challengeId: data.challengeId,
          challengeToken: data.challengeToken,
          maskedEmail: data.maskedEmail || formData.email.trim(),
        });
        setOtpCode('');
        setStatus('otp');
        return;
      }

      // Fallback in case server returned direct completion
      if (data.ok === true && data.contactSummary && !data.telemetryPersistedByServer) {
        void recordContactMessageLog(data.contactSummary).catch((err) => {
          console.warn('Firestore contact log skipped:', err);
        });
      }

      setStatus('success');
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        website: '',
      });
      setTimeout(() => setStatus('idle'), 6000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(toUserFacingError(err, 'Unable to send message right now.'));
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpStep || status === 'sending') return;

    const cleanCode = otpCode.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      setErrorMsg('Please enter the 6-digit numeric code sent to your email.');
      return;
    }

    setErrorMsg('');
    setStatus('sending');

    try {
      const response = await fetch('/api/contact-verify-otp', {
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
        provider?: string;
        contactSummary?: ContactMessageSummary;
        telemetryPersistedByServer?: boolean;
      };

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || 'Invalid verification code. Please check and try again.');
      }

      if (data.contactSummary && !data.telemetryPersistedByServer) {
        void recordContactMessageLog(data.contactSummary).catch((err) => {
          console.warn('Firestore contact log skipped:', err);
        });
      }

      setOtpStep(null);
      setOtpCode('');
      setTurnstileToken('');
      setStatus('success');
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        website: '',
      });
      setTimeout(() => setStatus('idle'), 6000);
    } catch (err) {
      setStatus('otp');
      setErrorMsg(toUserFacingError(err, 'Verification failed. Please try again.'));
    }
  };

  return (
    <section id="contact" className="relative py-16 lg:py-24 2xl:py-28 border-b border-slate-800/80 bg-[#06080d]">
      <SectionScanLine />
      <div
        aria-hidden="true"
        className="ambient-orb ambient-orb-delayed pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl print:hidden"
      />
      <div className="page-shell">
        {/* Main 2-column split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 min-[2560px]:gap-14 items-stretch">
          {/* Left Column: Direct channels and bio */}
          <Reveal className="lg:col-span-5 flex flex-col gap-8 lg:gap-10">
            <div>
              <HeaderSpotlight>
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>INITIATE COLLABORATION</span>
                </div>
                <h2 className="fluid-title font-display font-bold text-white tracking-tight">
                  Let&apos;s Connect &amp; Collaborate
                </h2>
                <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed font-light">
                  {PERSONAL_INFO.openTo}
                </p>
              </HeaderSpotlight>

              {/* Live Local Time & Availability Status */}
              <div className="mt-5 inline-flex flex-wrap items-center gap-2.5 px-3.5 py-2 rounded-xl border border-slate-800 bg-[#0b101d] text-xs font-mono">
                <span className={`inline-flex items-center gap-1.5 ${availabilityBadge.textCls}`}>
                  <span className={`w-2 h-2 rounded-full ${availabilityBadge.dotCls}`} />
                  <span>{availabilityBadge.label}</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="inline-flex items-center gap-1.5 text-cyan-300">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{localTime}</span>
                </span>
              </div>
            </div>

            {/* Collaboration brief — fills the mid-column without becoming a stats dashboard */}
            <div
              className={`rounded-xl border px-4 py-4 space-y-3.5 ${
                isLight
                  ? 'border-slate-200 bg-slate-50/80'
                  : 'border-slate-800 bg-[#0b101d]/90'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Collaboration brief</span>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      isLight
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-cyan-500/30 bg-cyan-950/50 text-cyan-400'
                    }`}
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Typical reply
                    </div>
                    <p className={`text-sm leading-snug mt-0.5 ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
                      Within 24–48 hours on Pacific time — sooner for OTP-verified inquiries.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      isLight
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-cyan-500/30 bg-cyan-950/50 text-cyan-400'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Best fit
                    </div>
                    <p className={`text-sm leading-snug mt-0.5 ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
                      Software Engineer roles across security data platforms, multi-cloud systems, and applied AI — San Jose / hybrid.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      isLight
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-cyan-500/30 bg-cyan-950/50 text-cyan-400'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Prefer
                    </div>
                    <p className={`text-sm leading-snug mt-0.5 ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
                      {effectivePortfolioSettings.enablePortfolioChat
                        ? 'This form (email OTP) · LinkedIn · portfolio chat when verified.'
                        : 'This form (email OTP) · LinkedIn · direct email for time-sensitive notes.'}
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Direct Channel Cards */}
            <div className="space-y-3 lg:mt-auto">
              {/* Email Card */}
              <motion.div
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="p-4 rounded-xl border border-slate-800 hover:border-cyan-500/40 bg-[#0d121f]/80 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2.5 rounded-lg shrink-0 ${
                      isLight
                        ? 'bg-sky-100 border border-sky-300 text-sky-700'
                        : 'bg-cyan-950/50 border border-cyan-500/30 text-cyan-400'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase text-slate-400">Direct Email</div>
                    <a
                      href={`mailto:${PERSONAL_INFO.email}`}
                      className="text-xs sm:text-sm font-semibold text-white hover:text-cyan-400 transition-colors break-all"
                    >
                      {PERSONAL_INFO.email}
                    </a>
                  </div>
                </div>

                <button
                  onClick={copyEmail}
                  className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors shrink-0"
                  title="Copy email address"
                  aria-label="Copy email address"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </motion.div>

              {/* LinkedIn Card */}
              <motion.a
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                href={PERSONAL_INFO.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-xl border border-slate-800 bg-[#0d121f]/80 flex items-center justify-between gap-3 hover:border-cyan-500/40 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 shrink-0">
                    <Linkedin className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase text-slate-400">Professional Network</div>
                    <div className="text-xs sm:text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors break-all">
                      linkedin.com/in/mohammed-sufyan
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
              </motion.a>

              {/* One-Tap Digital Business Card (.vcf + QR) */}
              <div className="p-4 rounded-xl border border-slate-800 bg-[#0d121f]/80 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase text-slate-400">Digital Business Card</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Save directly to Contacts or scan QR
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSaveVcf}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                      isLight
                        ? 'border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800'
                        : 'border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-200'
                    }`}
                  >
                    {vcfSaved ? (
                      <>
                        <Check className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                        <span>Saved .vcf</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Save .vcf</span>
                      </>
                    )}
                  </button>
                  {onOpenDigitalCard && (
                    <button
                      type="button"
                      onClick={onOpenDigitalCard}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                        isLight
                          ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                          : 'border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <QrCode className={`w-3.5 h-3.5 ${isLight ? 'text-sky-700' : 'text-cyan-400'}`} />
                      <span>QR Code</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right Column: Interactive Transmit Message Form */}
          <Reveal delay={0.1} className="lg:col-span-7 print:hidden">
            <div className="rounded-2xl border border-slate-800 bg-[#0d121f]/90 p-5 sm:p-8 shadow-2xl relative">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80 mb-6">
                <div>
                  <h3 className="font-display font-bold text-lg text-white">
                    {showingOtpPanel ? 'Verify Email to Transmit' : 'Transmit Message'}
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    {showingOtpPanel
                      ? `Enter the 6-digit OTP sent to ${otpStep?.maskedEmail}`
                      : 'Direct OTP-verified dispatch to Mohammed Sufyan’s priority inbox'}
                  </p>
                </div>
                <span className="text-[10px] font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded shrink-0">
                  OTP VERIFIED
                </span>
              </div>

              {!effectivePortfolioSettings.enableContactForm ? (
                <div
                  className={`rounded-xl border p-6 space-y-4 ${
                    isLight
                      ? 'border-amber-300 bg-amber-50/80 text-slate-800'
                      : 'border-amber-500/35 bg-amber-950/20 text-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <PauseCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-display font-bold text-base">
                        Web Inquiries Temporarily Paused
                      </h4>
                      <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
                        {effectivePortfolioSettings.maintenanceMode &&
                        effectivePortfolioSettings.maintenanceMessage
                          ? effectivePortfolioSettings.maintenanceMessage
                          : 'Direct web form submissions are temporarily paused. Please reach out directly via email or LinkedIn.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <a
                      href={`mailto:${PERSONAL_INFO.email}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email {PERSONAL_INFO.email}</span>
                    </a>
                    <button
                      type="button"
                      onClick={copyEmail}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/70 text-xs font-mono text-slate-200 hover:text-cyan-300 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied Email' : 'Copy Email'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <AnimatePresence mode="wait">
                    {errorMsg && (
                      <motion.div
                        key="contact-error"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        role="alert"
                        aria-live="polite"
                        className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs sm:text-sm space-y-2"
                      >
                        <div>{errorMsg}</div>
                        <a
                          href={`mailto:${PERSONAL_INFO.email}?subject=${encodeURIComponent(
                            formData.subject.trim() ||
                              `Portfolio Inquiry from ${formData.name.trim() || 'Visitor'}`
                          )}&body=${encodeURIComponent(
                            `Name: ${formData.name}\nEmail: ${formData.email}${
                              formData.phone ? `\nPhone: ${formData.phone}` : ''
                            }\n\n${formData.message}`
                          )}`}
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-300 hover:text-cyan-200 underline"
                        >
                          <span>Send via your default email client instead</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      </motion.div>
                    )}

                    {status === 'success' && (
                      <motion.div
                        key="contact-success"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        role="status"
                        aria-live="polite"
                        className="relative mb-6 overflow-hidden p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5"
                      >
                        {!shouldReduceMotion && (
                          <>
                            <motion.span
                              aria-hidden="true"
                              initial={{ scale: 0.35, opacity: 0.7 }}
                              animate={{ scale: 2.6, opacity: 0 }}
                              transition={{ duration: 1.05, ease: EASE_OUT_EXPO }}
                              className="pointer-events-none absolute left-7 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border-2 border-emerald-400/55"
                            />
                            <motion.span
                              aria-hidden="true"
                              initial={{ scale: 0.35, opacity: 0.55 }}
                              animate={{ scale: 3.2, opacity: 0 }}
                              transition={{ duration: 1.25, delay: 0.12, ease: EASE_OUT_EXPO }}
                              className="pointer-events-none absolute left-7 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border border-emerald-300/40"
                            />
                          </>
                        )}
                        <motion.span
                          initial={shouldReduceMotion ? false : { scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                          className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/40 mt-0.5"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                        </motion.span>
                        <div className="relative z-10">
                          <strong className="font-semibold">
                            Email Verified &amp; Message Transmitted!
                          </strong>
                          <p className="text-xs text-emerald-300/80 mt-1">
                            Your verified message has been delivered directly to {PERSONAL_INFO.email}. Mohammed will review it and reply promptly.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {showingOtpPanel && otpStep ? (
                    <form onSubmit={handleOtpSubmit} className="space-y-4">
                      <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/25 p-4 text-xs text-slate-200 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-[11px] uppercase text-cyan-300">
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Mandatory Sender Verification</span>
                        </div>
                        <p className="leading-relaxed">
                          We sent a 6-digit verification code to{' '}
                          <strong className="font-mono text-white">{otpStep.maskedEmail}</strong>. Check your inbox or spam folder and enter the code below to complete transmission.
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="contact-otp-input"
                          className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                          <span>6-Digit Verification Code *</span>
                        </label>
                        <input
                          id="contact-otp-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          autoFocus
                          required
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => {
                            if (errorMsg) setErrorMsg('');
                            setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6));
                          }}
                          placeholder="123456"
                          className="contact-field w-full px-4 py-3 rounded-xl bg-[#090d16] border border-slate-800 text-center font-mono text-xl tracking-[0.35em] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-all"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                          type="button"
                          disabled={status === 'sending'}
                          onClick={() => {
                            setOtpStep(null);
                            setOtpCode('');
                            setErrorMsg('');
                            setStatus('idle');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Edit Details</span>
                        </button>

                        <button
                          type="submit"
                          disabled={status === 'sending' || otpCode.length !== 6}
                          className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs sm:text-sm transition-colors shadow-md shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                        >
                          {status === 'sending' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Verifying &amp; Sending...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4" />
                              <span>Verify &amp; Transmit Message</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="sr-only" aria-hidden="true">
                        <label htmlFor="contact-website">Leave this field blank</label>
                        <input
                          id="contact-website"
                          type="text"
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        />
                      </div>

                      {/* Recruiter Quick-Intent Presets */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          <span>Quick Inquiry Presets</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {INTENT_PRESETS.map((preset) => {
                            const active = formData.subject === preset.subject;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyIntentPreset(preset)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                                  active
                                    ? 'skill-chip-active bg-cyan-500 border-cyan-500 text-slate-950 font-semibold'
                                    : 'bg-[#090d16] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Name */}
                        <div>
                          <label
                            htmlFor="contact-name"
                            className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5"
                          >
                            Full Name *
                          </label>
                          <input
                            id="contact-name"
                            type="text"
                            required
                            maxLength={120}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. John Doe"
                            className="contact-field w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.18)] transition-all"
                          />
                        </div>

                        {/* Email */}
                        <div>
                          <label
                            htmlFor="contact-email"
                            className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5"
                          >
                            Email Address * (OTP Verified)
                          </label>
                          <input
                            id="contact-email"
                            type="email"
                            required
                            maxLength={254}
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="e.g. john@enterprise.com"
                            className="contact-field w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.18)] transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Subject / Intent */}
                        <div>
                          <label
                            htmlFor="contact-subject"
                            className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5"
                          >
                            Subject / Intent
                          </label>
                          <input
                            id="contact-subject"
                            type="text"
                            maxLength={200}
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            placeholder="e.g. Multi-Cloud Architecture Discussion"
                            className="contact-field w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.18)] transition-all"
                          />
                        </div>

                        {/* Phone */}
                        <div>
                          <label
                            htmlFor="contact-phone"
                            className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5"
                          >
                            Phone Number (Optional)
                          </label>
                          <div className="flex gap-1.5">
                            <select
                              aria-label="Phone country code"
                              value={phoneCountry}
                              onChange={(e) =>
                                setPhoneCountry(e.target.value as SelectedPhoneCountry)
                              }
                              className="contact-field w-[86px] shrink-0 px-2 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400 transition-all"
                            >
                              {PHONE_COUNTRY_OPTIONS.map((opt) => (
                                <option key={opt.code} value={opt.code}>
                                  {opt.label} {opt.dialCode}
                                </option>
                              ))}
                            </select>
                            <input
                              id="contact-phone"
                              type="tel"
                              maxLength={40}
                              value={formData.phone}
                              onChange={(e) => {
                                const nextVal = e.target.value;
                                const detected = detectCountryFromPlusPrefix(nextVal);
                                if (detected) setPhoneCountry(detected);
                                setFormData({ ...formData, phone: nextVal });
                              }}
                              placeholder={
                                PHONE_COUNTRY_OPTIONS.find((opt) => opt.code === phoneCountry)
                                  ?.example || '(408) 839-4720'
                              }
                              className="contact-field flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.18)] transition-all"
                            />
                          </div>
                          {formData.phone.trim().length > 0 &&
                            (() => {
                              const preview = validateAndNormalizePhone(
                                formData.phone,
                                phoneCountry
                              );
                              if (preview.valid) {
                                return (
                                  <p className="mt-1 text-[10px] font-mono text-emerald-400 truncate">
                                    Verified format: {preview.internationalDisplay} (
                                    {preview.countryCode})
                                  </p>
                                );
                              }
                              if (formData.phone.replace(/\D/g, '').length >= 7) {
                                return (
                                  <p className="mt-1 text-[10px] font-mono text-amber-400">
                                    {preview.reason}
                                  </p>
                                );
                              }
                              return null;
                            })()}
                        </div>
                      </div>

                      {/* Message */}
                      <div>
                        <label
                          htmlFor="contact-message"
                          className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5"
                        >
                          Message Details *
                        </label>
                        <textarea
                          id="contact-message"
                          rows={4}
                          required
                          maxLength={5000}
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          placeholder="Describe your architectural requirements, project scope, or opportunity..."
                          className="contact-field w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.18)] transition-all resize-none"
                        ></textarea>
                      </div>

                      {turnstileSiteKey && (
                        <div className="pt-1 flex w-full justify-center">
                          <div ref={turnstileContainerRef} />
                        </div>
                      )}

                      <p className="text-[11px] font-mono text-slate-400">
                        Security check: submitting sends a 6-digit verification code to your email address before delivering your inquiry.
                      </p>

                      {/* Submit button */}
                      <div className="pt-1">
                        <motion.button
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.985 }}
                          type="submit"
                          disabled={status === 'sending'}
                          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs sm:text-sm transition-colors shadow-md shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                        >
                          {status === 'sending' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Sending Verification Code...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              <span>Send Verification Code &amp; Transmit</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
