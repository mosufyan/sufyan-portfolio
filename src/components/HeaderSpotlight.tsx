import { MouseEvent as ReactMouseEvent, ReactNode, useState } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'motion/react';

interface HeaderSpotlightProps {
  children: ReactNode;
  className?: string;
}

/**
 * Soft cyan cursor spotlight for section headers.
 */
export default function HeaderSpotlight({ children, className = '' }: HeaderSpotlightProps) {
  const shouldReduceMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovered, setHovered] = useState(false);
  const glow = useMotionTemplate`radial-gradient(220px circle at ${mouseX}px ${mouseY}px, rgba(56,189,248,0.14), transparent 70%)`;

  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <div
      onMouseMove={onMove}
      onMouseEnter={() => !shouldReduceMotion && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative ${className}`}
    >
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-3 rounded-2xl print:hidden"
          style={{ background: glow, opacity: hovered ? 1 : 0 }}
          transition={{ opacity: { duration: 0.25 } }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
