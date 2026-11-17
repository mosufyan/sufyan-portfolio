import { ReactNode, useRef } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

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
}

export function CollapseTimelineNode({
  children,
  className = '',
  nodeTopClassName = 'top-7',
}: CollapseTimelineNodeProps) {
  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden="true"
        className={`hidden md:flex print:hidden absolute -left-9 ${nodeTopClassName} w-6 h-6 items-center justify-center rounded-full bg-[#07090e] border border-cyan-500/50 shadow-[0_0_12px_rgba(34,211,238,0.2)] z-10`}
      >
        <span className="w-2 h-2 rounded-full bg-cyan-400" />
      </div>
      {children}
    </div>
  );
}
