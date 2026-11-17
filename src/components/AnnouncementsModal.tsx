import { useEffect } from 'react';
import { Bell, Calendar, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ANNOUNCEMENTS } from '../data/portfolioData';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AnnouncementsModal({ isOpen, onClose }: AnnouncementsModalProps) {
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

  return (
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
            {/* Background glow */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Close Button */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close Announcements"
            >
              <X className="w-5 h-5" />
            </motion.button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white">
                  Announcements & Publications
                </h3>
                <p className="text-xs font-mono text-cyan-400/90">
                  Architectural milestones, whitepapers, and certifications
                </p>
              </div>
            </div>

            {/* Announcements List */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {ANNOUNCEMENTS.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 + idx * 0.04, ease: EASE_OUT_EXPO }}
                  className="rounded-xl border border-slate-800 bg-[#090d16] p-4.5 space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Calendar className="w-3 h-3" />
                      {item.date}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
                      VERIFIED
                    </span>
                  </div>

                  <h4 className="text-sm font-display font-bold text-white leading-snug">
                    {item.title}
                  </h4>

                  <p className="text-xs text-slate-300 leading-relaxed font-light">
                    {item.summary}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="pt-6 mt-6 border-t border-slate-800 flex justify-end">
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
}
