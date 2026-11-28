import { motion, useReducedMotion } from 'motion/react';
import { BRAND_MARK_PNG_SRC } from '../brand/brandMark';
import { useTheme } from '../theme/ThemeProvider';
import { EASE_OUT_EXPO } from './MotionPrimitives';

const SIZE_PX = {
  sm: 32,
  md: 36,
  lg: 40,
} as const;

/** Cyan (#22d3ee ≈ 187°) → amber (#fbbf24 ≈ 43°) */
const AMBER_MARK_FILTER = 'hue-rotate(-144deg) saturate(1.2) brightness(1.05)';

export type BrandMarkSize = keyof typeof SIZE_PX | number;

interface BrandMarkProps {
  size?: BrandMarkSize;
  className?: string;
  /** Hover scale + 360° rotate (default on). Honors reduced-motion. */
  animate?: boolean;
}

/**
 * Exact approved hexagon+MS logo (concept B / PWA PNG).
 * Always the same artwork — amber is a hue shift so shape never drifts.
 */
export default function BrandMark({
  size = 'md',
  className = '',
  animate = true,
}: BrandMarkProps) {
  const reduceMotion = useReducedMotion();
  const { accent } = useTheme();
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const isAmber = accent === 'amber';

  const mark = (
    <img
      src={BRAND_MARK_PNG_SRC}
      alt=""
      width={px}
      height={px}
      draggable={false}
      decoding="async"
      className="block h-full w-full rounded-lg object-cover"
      style={{
        transform: 'translateZ(0)',
        filter: isAmber ? AMBER_MARK_FILTER : undefined,
      }}
    />
  );

  if (!animate) {
    return (
      <span
        className={`inline-flex shrink-0 rounded-lg isolate ${className}`}
        style={{ width: px, height: px }}
        aria-hidden
      >
        {mark}
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
      className={`inline-flex shrink-0 rounded-lg isolate ${className}`}
      style={{ width: px, height: px }}
      aria-hidden
    >
      {mark}
    </motion.span>
  );
}
