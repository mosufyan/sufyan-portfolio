import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Calendar, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useModalPlacement } from '../hooks/useModalPlacement';
import { useTheme } from '../theme/ThemeProvider';
import ModalHeaderScan from './ModalHeaderScan';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOwnerConsole?: () => void;
}

export default function AnnouncementsModal({
  isOpen,
  onClose,
  onOpenOwnerConsole,
}: AnnouncementsModalProps) {
  const { isLight } = useTheme();
  const alignClass = useModalPlacement(isOpen);
  const { isOwner, announcements } = useFirebase();

  useEffect(() => {
    if (!isOpen) return;

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
            className={`relative w-full max-w-xl 2xl:max-w-2xl max-h-[min(calc(100dvh-1.5rem),35.5rem)] sm:max-h-[min(calc(100dvh-2.5rem),38rem)] lg:max-h-[min(calc(100dvh-3rem),50rem)] overflow-hidden rounded-2xl border shadow-2xl flex flex-col ${panel}`}
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

            {/* Body — clean public announcements feed */}
            <div className="flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6 pr-3 sm:pr-5">
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
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${badge}`}>
                      {item.badge}
                    </span>
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
            </div>

            <div className={`px-4 sm:px-6 py-3.5 border-t flex items-center justify-between gap-3 shrink-0 ${footer}`}>
              {isOwner && onOpenOwnerConsole ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenOwnerConsole();
                  }}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-mono transition-colors cursor-pointer ${
                    isLight ? 'text-sky-700 hover:text-sky-900' : 'text-cyan-400 hover:text-cyan-300'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Manage in Owner Console</span>
                </button>
              ) : (
                <span className={`text-[11px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Verified Milestones Feed
                </span>
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
