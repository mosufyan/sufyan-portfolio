import { useEffect, useState } from 'react';
import { Check, ExternalLink, ShieldCheck, X, Calendar, Hash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Certification, PERSONAL_INFO } from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import IssuerMark from './IssuerMark';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface CredentialModalProps {
  certification: Certification | null;
  onClose: () => void;
}

export default function CredentialModal({ certification, onClose }: CredentialModalProps) {
  const { theme } = useTheme();
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:hidden"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#0d121f] p-5 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Close Button */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close Modal"
            >
              <X className="w-5 h-5" />
            </motion.button>

            {/* Verification Status Header */}
            <div className="flex items-center gap-2 mb-6 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg w-fit">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>OFFICIALLY VERIFIED CREDENTIAL</span>
            </div>

            {/* Certificate Title & Issuer */}
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight leading-snug">
                {certification.title}
              </h3>
              <div className="flex items-center gap-2 text-sm font-medium text-cyan-400">
                <IssuerMark issuer={certification.issuer} size="sm" theme={theme} />
                <span>Issued by {certification.issuer}</span>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6 p-4 rounded-xl bg-[#090d16] border border-slate-800 text-xs font-mono">
              <div>
                <div className="text-slate-500 uppercase text-[10px] tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Issue Date
                </div>
                <div className="text-slate-200 font-semibold mt-0.5">{certification.issueDate}</div>
              </div>

              <div>
                <div className="text-slate-500 uppercase text-[10px] tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Expiry Status
                </div>
                <div className="text-emerald-400 font-semibold mt-0.5">
                  {certification.expiryDate ? `Valid thru ${certification.expiryDate}` : 'Permanent / Non-Expiring'}
                </div>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-800/80">
                <div className="text-slate-500 uppercase text-[10px] tracking-wider flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" /> Credential Identifier
                </div>
                <div className="text-cyan-300 font-semibold mt-0.5 select-all break-all">
                  {certification.credentialId || `VERIFIED-${certification.issuer.toUpperCase()}-${certification.id.toUpperCase()}`}
                </div>
              </div>
            </div>

            {/* Skills Validated */}
            <div className="mb-6">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                Competencies & Skills Validated
              </div>
              <div className="flex flex-wrap gap-1.5">
                {certification.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded text-xs font-mono bg-slate-900 border border-slate-700/80 text-slate-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Candidate & Verification CTA */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Candidate: <span className="text-white font-medium">{PERSONAL_INFO.name}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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

                {certification.credentialId && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      navigator.clipboard?.writeText(certification.credentialId!).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }).catch(() => {});
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/80 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied ID</span>
                      </>
                    ) : (
                      <span>Copy ID</span>
                    )}
                  </motion.button>
                )}

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Close
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
