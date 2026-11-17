import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface ShineSurfaceProps {
  children: ReactNode;
  className?: string;
  /** Tailwind via-* class for the sweep highlight */
  shineClassName?: string;
  /** How often the idle sweep repeats */
  repeatDelay?: number;
}

/**
 * Idle light-sweep wrapper for primary CTAs. Works in light and dark.
 */
export default function ShineSurface({
  children,
  className = '',
  shineClassName = 'via-white/40',
  repeatDelay = 4.8,
}: ShineSurfaceProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <span className={`relative inline-flex max-w-full overflow-hidden rounded-[inherit] ${className}`}>
      {children}
      {!shouldReduceMotion && (
        <motion.span
          aria-hidden="true"
          animate={{ x: ['-130%', '230%'], opacity: [0, 0.9, 0] }}
          transition={{
            duration: 1.35,
            repeat: Infinity,
            repeatDelay,
            ease: 'easeInOut',
          }}
          className={`pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent ${shineClassName} to-transparent skew-x-[-20deg] print:hidden`}
        />
      )}
    </span>
  );
}
