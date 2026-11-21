import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

/**
 * One-shot cyan scan sweep when a section enters the viewport.
 */
export default function SectionScanLine() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.12 });
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-px overflow-hidden print:hidden"
    >
      {!shouldReduceMotion && inView && (
        <>
          <motion.div
            initial={{ x: '-35%', opacity: 0 }}
            animate={{ x: '135%', opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.15, ease: EASE_OUT_EXPO }}
            className="h-px w-[42%] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_14px_rgba(34,211,238,0.65)]"
          />
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: [0, 0.55, 0] }}
            transition={{ duration: 1.35, delay: 0.12, ease: EASE_OUT_EXPO }}
            className="absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-cyan-400/0 via-cyan-300/50 to-sky-400/0"
          />
        </>
      )}
    </div>
  );
}
