import { ReactNode, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface CollapseTimelineProps {
  children: ReactNode;
  className?: string;
  /** Vertical spacing between nodes (default space-y-6 / space-y-8) */
  gapClassName?: string;
}

/**
 * Scroll-linked cyan timeline rail + glowing nodes for collapsible stacks.
 * Matches the Professional Experience expand/collapse treatment.
 */
export function CollapseTimeline({
  children,
  className = '',
  gapClassName = 'space-y-6',
}: CollapseTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ['start 75%', 'end 65%'],
  });
  const railScaleY = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div ref={timelineRef} className={`relative md:pl-9 print:pl-0 ${className}`}>
      <div
        aria-hidden="true"
        className="hidden md:block print:hidden absolute left-3 top-8 bottom-8 w-[2px] bg-slate-800/80 rounded-full overflow-hidden"
      >
        <motion.div
          style={{ scaleY: railScaleY }}
          className="w-full h-full origin-top bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-500"
        />
      </div>
      <div className={gapClassName}>{children}</div>
    </div>
  );
}

interface CollapseTimelineNodeProps {
  children: ReactNode;
  className?: string;
  /** Vertical offset of the glowing node relative to the card header */
  nodeTopClassName?: string;
  /** When true (e.g. section expanded), node pulses once */
  pulse?: boolean;
}

export function CollapseTimelineNode({
  children,
  className = '',
  nodeTopClassName = 'top-7',
  pulse = false,
}: CollapseTimelineNodeProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={`relative ${className}`}>
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : pulse
              ? {
                  scale: [1, 1.18, 1],
                  borderColor: [
                    'rgba(34,211,238,0.5)',
                    'rgba(103,232,249,1)',
                    'rgba(34,211,238,0.5)',
                  ],
                  boxShadow: [
                    '0 0 12px rgba(34,211,238,0.2)',
                    '0 0 24px rgba(34,211,238,0.7)',
                    '0 0 12px rgba(34,211,238,0.2)',
                  ],
                }
              : {
                  scale: 1,
                  borderColor: 'rgba(34,211,238,0.5)',
                  boxShadow: '0 0 12px rgba(34,211,238,0.2)',
                }
        }
        transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
        className={`hidden md:flex print:hidden absolute -left-9 ${nodeTopClassName} w-6 h-6 items-center justify-center rounded-full bg-[#07090e] border border-cyan-500/50 shadow-[0_0_12px_rgba(34,211,238,0.2)] z-10`}
      >
        <motion.span
          animate={
            shouldReduceMotion
              ? undefined
              : pulse
                ? { scale: [1, 1.45, 1], opacity: [1, 1, 1] }
                : { scale: 1 }
          }
          transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
          className="w-2 h-2 rounded-full bg-cyan-400"
        />
      </motion.div>
      {children}
    </div>
  );
}
