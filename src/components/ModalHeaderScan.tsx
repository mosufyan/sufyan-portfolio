import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface ModalHeaderScanProps {
  active: boolean;
}

/**
 * One-shot cyan scan across a modal header when it opens.
 */
export default function ModalHeaderScan({ active }: ModalHeaderScanProps) {
  const shouldReduceMotion = useReducedMotion();
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (!active || shouldReduceMotion) {
      setPlay(false);
      return;
    }
    setPlay(true);
    const t = window.setTimeout(() => setPlay(false), 1200);
    return () => window.clearTimeout(t);
  }, [active, shouldReduceMotion]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden print:hidden"
    >
      <AnimatePresence>
        {play && (
          <motion.div
            key="modal-scan"
            initial={{ x: '-40%', opacity: 0 }}
            animate={{ x: '140%', opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.05, ease: EASE_OUT_EXPO }}
            className="h-px w-[45%] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_rgba(103,232,249,0.7)]"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
