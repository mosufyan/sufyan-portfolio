import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTheme } from '../theme/ThemeProvider';
import { EASE_OUT_EXPO } from './MotionPrimitives';

export default function FloatingBackToTop() {
  const [visible, setVisible] = useState(false);
  const { isLight } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 520);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.94 }}
          onClick={scrollToTop}
          aria-label="Back to top"
          title="Back to top"
          className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 flex h-11 w-11 items-center justify-center rounded-xl border shadow-lg backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 print:hidden overflow-hidden ${
            isLight
              ? 'border-sky-300 bg-white/95 text-sky-700 shadow-slate-300/50 hover:bg-sky-50'
              : 'border-cyan-500/40 bg-[#0d121f]/95 text-cyan-300 shadow-cyan-950/40 hover:bg-cyan-950/80 hover:text-white'
          }`}
        >
          {!shouldReduceMotion && (
            <motion.span
              aria-hidden="true"
              animate={{ x: ['-140%', '220%'], opacity: [0, 0.7, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
              className={`pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent to-transparent skew-x-[-20deg] ${
                isLight ? 'via-sky-300/40' : 'via-cyan-200/30'
              }`}
            />
          )}
          <ArrowUp className="relative z-10 w-4 h-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
