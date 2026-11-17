import { MouseEvent as ReactMouseEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  HTMLMotionProps,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';

export const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface SpotlightCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  glowColor?: string;
}

export function SpotlightCard({
  children,
  className = '',
  glowColor = 'rgba(56, 189, 248, 0.11)',
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...props
}: SpotlightCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const mouseX = useMotionValue(-999);
  const mouseY = useMotionValue(-999);
  const [hovered, setHovered] = useState(false);

  const background = useMotionTemplate`radial-gradient(340px circle at ${mouseX}px ${mouseY}px, ${glowColor}, transparent 72%)`;

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!shouldReduceMotion) {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    }
    onMouseMove?.(e);
  };

  return (
    <motion.div
      {...props}
      onMouseMove={handleMouseMove}
      onMouseEnter={(e) => {
        if (!shouldReduceMotion) setHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        onMouseLeave?.(e);
      }}
      className={`relative overflow-hidden print-force-visible ${className}`}
    >
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300 print:hidden"
          style={{ background, opacity: hovered ? 1 : 0 }}
        />
      )}
      {children}
    </motion.div>
  );
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  x?: number;
}

export function Reveal({ children, className = '', delay = 0, y = 18, x = 0 }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.52, delay, ease: EASE_OUT_EXPO }}
      className={`print-force-visible ${className}`}
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({
  children,
  className = '',
  staggerDelay = 0.06,
}: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.05 }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, ease: EASE_OUT_EXPO },
        },
      }}
      className={`print-force-visible ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedMetric({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const shouldReduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!inView || shouldReduceMotion) {
      setDisplay(value);
      return;
    }

    const match = value.match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (!match) {
      setDisplay(value);
      return;
    }

    const target = parseFloat(match[1]);
    const suffix = match[2] || '';
    const hasDecimal = match[1].includes('.');
    const durationMs = 950;
    const start = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      if (progress < 1) {
        setDisplay(
          `${hasDecimal ? current.toFixed(1) : Math.floor(current)}${suffix}`
        );
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [inView, shouldReduceMotion, value]);

  return <span ref={ref}>{display}</span>;
}
