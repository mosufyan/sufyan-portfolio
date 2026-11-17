import { useEffect, useState } from 'react';
import { Check, ExternalLink, ShieldCheck, X, Calendar, Hash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Certification, PERSONAL_INFO } from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import IssuerMark from './IssuerMark';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import ShineSurface from './ShineSurface';

interface CredentialModalProps {
  certification: Certification | null;
  onClose: () => void;
}

export default function CredentialModal({ certification, onClose }: CredentialModalProps) {
  const { theme, isLight } = useTheme();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
    if (!certification) return;

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
  }, [certification, onClose]);

  const panel = isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-[#0d121f]';
  const meta = isLight
    ? 'bg-slate-50 border-slate-200'
    : 'bg-[#090d16] border-slate-800';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const muted = isLight ? 'text-slate-500' : 'text-slate-500';
  const body = isLight ? 'text-slate-700' : 'text-slate-200';
  const accent = isLight ? 'text-sky-700' : 'text-cyan-400';
  const skillChip = isLight
    ? 'bg-slate-100 border-slate-200 text-slate-700'
    : 'bg-slate-900 border-slate-700/80 text-slate-300';
  const footer = isLight ? 'border-slate-200' : 'border-slate-800';
  const secondaryBtn = isLight
    ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
    : 'border-slate-700 hover:border-slate-600 bg-slate-800/80 text-slate-200';
  const closeBtn = isLight
    ? 'border-slate-300 hover:bg-slate-50 text-slate-600'
    : 'border-slate-800 hover:bg-slate-800 text-slate-300';
  const backdrop = isLight ? 'bg-slate-900/45' : 'bg-black/80';

  return (
    <AnimatePresence>
      {certification && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={certification.title}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden ${backdrop}`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            className={`relative w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col ${panel}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Always-dark header */}
            <div className="relative flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-800/90 bg-[#0b101b] shrink-0">
              <ModalHeaderScan active={Boolean(certification)} />
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                    Officially Verified Credential
                  </div>
                  <h3 className="font-display font-bold text-white text-sm sm:text-base leading-snug line-clamp-2">
                    {certification.title}
                  </h3>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Close Modal"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
              <div className={`flex items-center gap-2 text-sm font-medium ${accent}`}>
                <IssuerMark issuer={certification.issuer} size="sm" theme={theme} />
                <span>Issued by {certification.issuer}</span>
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border text-xs font-mono ${meta}`}>
                <div>
                  <div className={`uppercase text-[10px] tracking-wider flex items-center gap-1 ${muted}`}>
                    <Calendar className="w-3 h-3" /> Issue Date
                  </div>
                  <div className={`font-semibold mt-0.5 ${body}`}>{certification.issueDate}</div>
                </div>

                <div>
                  <div className={`uppercase text-[10px] tracking-wider flex items-center gap-1 ${muted}`}>
                    <Calendar className="w-3 h-3" /> Expiry Status
                  </div>
                  <div className={`font-semibold mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    {certification.expiryDate ? `Valid thru ${certification.expiryDate}` : 'Permanent / Non-Expiring'}
                  </div>
                </div>

                <div className={`sm:col-span-2 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                  <div className={`uppercase text-[10px] tracking-wider flex items-center gap-1 ${muted}`}>
                    <Hash className="w-3 h-3" /> Credential Identifier
                  </div>
                  <div className={`font-semibold mt-0.5 select-all break-all ${isLight ? 'text-sky-700' : 'text-cyan-300'}`}>
                    {certification.credentialId || `VERIFIED-${certification.issuer.toUpperCase()}-${certification.id.toUpperCase()}`}
                  </div>
                </div>
              </div>

              <div>
                <div className={`text-xs font-mono uppercase tracking-wider mb-2 ${muted}`}>
                  Competencies & Skills Validated
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {certification.skills.map((skill, idx) => (
                    <motion.span
                      key={idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.03, ease: EASE_OUT_EXPO }}
                      className={`px-2.5 py-1 rounded text-xs font-mono border ${skillChip}`}
                    >
                      {skill}
                    </motion.span>
                  ))}
                </div>
              </div>

              <div className={`pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${footer}`}>
                <div className={`text-xs ${muted}`}>
                  Candidate:{' '}
                  <span className={`font-medium ${titleCls}`}>{PERSONAL_INFO.name}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ShineSurface className="rounded-lg" shineClassName="via-white/45">
                    <motion.a
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      href={certification.credentialUrl || 'https://www.linkedin.com/in/mohammed-sufyan/details/certifications/'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors"
                    >
                      <span>Show Credential</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </motion.a>
                  </ShineSurface>

                  {certification.credentialId && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        navigator.clipboard?.writeText(certification.credentialId!).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }).catch(() => {});
                      }}
                      className={`relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${secondaryBtn}`}
                    >
                      {copied ? (
                        <>
                          <Check className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                          <span className={isLight ? 'text-emerald-700' : 'text-emerald-300'}>Copied ID</span>
                          <motion.span
                            aria-hidden="true"
                            initial={{ scale: 0.35, opacity: 0.65 }}
                            animate={{ scale: 2.2, opacity: 0 }}
                            transition={{ duration: 0.85, ease: EASE_OUT_EXPO }}
                            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-emerald-400/60"
                          />
                        </>
                      ) : (
                        <span>Copy ID</span>
                      )}
                    </motion.button>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={onClose}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${closeBtn}`}
                  >
                    Close
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
