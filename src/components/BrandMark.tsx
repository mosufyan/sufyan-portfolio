import { motion, useReducedMotion } from 'motion/react';
import { BRAND_MARK_SRC } from '../brand/brandMark';
import { EASE_OUT_EXPO } from './MotionPrimitives';

const SIZE_PX = {
  sm: 32,
  md: 36,
  lg: 40,
} as const;

export type BrandMarkSize = keyof typeof SIZE_PX | number;

interface BrandMarkProps {
  size?: BrandMarkSize;
  className?: string;
  /** Hover scale + 360° rotate (default on). Honors reduced-motion. */
  animate?: boolean;
}

/**
 * Site-wide brand mark: full cyan hexagon + MS tile with consistent hover spin.
 */
export default function BrandMark({
  size = 'md',
  className = '',
  animate = true,
}: BrandMarkProps) {
  const reduceMotion = useReducedMotion();
  const px = typeof size === 'number' ? size : SIZE_PX[size];

  const img = (
    <img
      src={BRAND_MARK_SRC}
      alt=""
      width={px}
      height={px}
      draggable={false}
      className="block h-full w-full rounded-lg object-cover"
    />
  );

  if (!animate) {
    return (
      <span
        className={`inline-flex shrink-0 overflow-hidden rounded-lg ${className}`}
        style={{ width: px, height: px }}
        aria-hidden
      >
        {img}
      </span>
    );
  }

  return (
    <motion.span
      whileHover={
        reduceMotion ? { scale: 1.06 } : { scale: 1.08, rotate: 360 }
      }
      transition={{
        scale: { type: 'spring', stiffness: 400, damping: 20 },
        rotate: { duration: 0.65, ease: EASE_OUT_EXPO },
      }}
      className={`inline-flex shrink-0 overflow-hidden rounded-lg ${className}`}
      style={{ width: px, height: px }}
      aria-hidden
    >
      {img}
    </motion.span>
  );
}
