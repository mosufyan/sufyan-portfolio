import { useEffect, useState } from 'react';
import {
  Mail,
  Linkedin,
  Send,
  Check,
  Copy,
  ArrowUpRight,
  MessageSquare,
  Clock,
  QrCode,
  UserPlus,
  Sparkles
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PERSONAL_INFO } from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import { downloadVCard } from '../utils/vcard';
import HeaderSpotlight from './HeaderSpotlight';
import { Reveal, EASE_OUT_EXPO } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';

interface ContactProps {
  onOpenDigitalCard?: () => void;
}

const INTENT_PRESETS = [
  {
    id: 'role',
    label: 'Staff / Principal Role',
    subject: 'Opportunity: Principal / Staff Cloud Solutions Architect',
    starter:
      'Hi Mohammed,\n\nWe are hiring for a Principal / Staff Cloud & Security Architecture role and would love to connect regarding team scope, timeline, and availability.',
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
      'Hi Mohammed,\n\nWe are looking for executive technical advisory on multi-cloud resilience, DevSecOps governance, or FinOps optimization.',
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
  const { isLight } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    website: ''
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [vcfSaved, setVcfSaved] = useState(false);
  const [localTime, setLocalTime] = useState<string>(() => formatSanJoseTime());

  useEffect(() => {
    const id = window.setInterval(() => {
      setLocalTime(formatSanJoseTime());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  const copyEmail = () => {
    navigator.clipboard?.writeText(PERSONAL_INFO.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setStatus('error');
      setErrorMsg('Please fill out the required fields: Name, Email, and Message.');
      return;
    }

    setErrorMsg('');
    setStatus('sending');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          subject: formData.subject.trim(),
          message: formData.message.trim(),
          website: formData.website,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Unable to send message right now.');
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
      setErrorMsg(err instanceof Error ? err.message : 'Unable to send message right now.');
    }
  };

  return (
    <section id="contact" className="relative py-16 lg:py-24 border-b border-slate-800/80 bg-[#06080d]">
      <SectionScanLine />
      <div className="page-shell">
        {/* Main 2-column split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Left Column: Direct channels and bio */}
          <Reveal className="lg:col-span-5 flex flex-col justify-between space-y-8">
            <div>
              <HeaderSpotlight>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>INITIATE COLLABORATION</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight leading-tight">
                Let&apos;s Connect &amp; Collaborate
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed font-light">
                Interested in discussing Enterprise Cloud Architecture, Zero Trust implementations, Multi-Cloud scale, or Senior Engineering leadership opportunities?
              </p>
              </HeaderSpotlight>

              {/* Live Local Time & Role Readiness Indicator */}
              <div className="mt-5 inline-flex flex-wrap items-center gap-2.5 px-3.5 py-2 rounded-xl border border-slate-800 bg-[#0b101d] text-xs font-mono">
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active · San Jose, CA</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="inline-flex items-center gap-1.5 text-cyan-300">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{localTime}</span>
                </span>
              </div>
            </div>

            {/* Direct Channel Cards */}
            <div className="space-y-3">
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
                rel="noreferrer"
                className="p-4 rounded-xl border border-slate-800 bg-[#0d121f]/80 flex items-center justify-between gap-3 hover:border-cyan-500/40 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2.5 rounded-lg shrink-0 ${
                      isLight
                        ? 'brand-on-color bg-[#0A66C2] border border-[#0A66C2] text-white'
                        : 'bg-blue-950/50 border border-blue-500/30 text-blue-400'
                    }`}
                  >
                    <Linkedin className="w-4 h-4" />
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
                    Transmit Message
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Direct dispatch to Mohammed Sufyan&apos;s priority inbox
                  </p>
                </div>
                <span className="text-[10px] font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded shrink-0">
                  P1 ROUTING
                </span>
              </div>

              <AnimatePresence mode="wait">
                {status === 'error' && errorMsg && (
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
                        formData.subject.trim() || `Portfolio Inquiry from ${formData.name.trim() || 'Visitor'}`
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
                        <motion.span
                          aria-hidden="true"
                          initial={{ scale: 0.5, opacity: 0.45 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
                          className="pointer-events-none absolute left-7 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-emerald-400/25 blur-md"
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
                      <strong className="font-semibold">Message Transmitted Successfully!</strong>
                      <p className="text-xs text-emerald-300/80 mt-1">
                        Your message has been delivered directly to {PERSONAL_INFO.email}. Mohammed will review it and reply promptly.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer ${
                            active
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
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
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5"
                    >
                      Email Address *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      maxLength={254}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. john@enterprise.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
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
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
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
                    <input
                      id="contact-phone"
                      type="tel"
                      maxLength={40}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
                    />
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors resize-none"
                  ></textarea>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    type="submit"
                    disabled={status === 'sending'}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs sm:text-sm transition-colors shadow-md shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {status === 'sending' ? (
                      <span>Transmitting Payload...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Message</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
