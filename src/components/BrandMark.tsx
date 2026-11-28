import { motion, useReducedMotion } from 'motion/react';
import {
  BRAND_ACCENT_HEX,
  BRAND_MARK_HEX_PATH,
  BRAND_MARK_INSET_SCALE,
  BRAND_MARK_MS_PATH,
} from '../brand/brandMark';
import { useTheme } from '../theme/ThemeProvider';
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
 * Site-wide brand mark: hexagon + MS tile.
 * Stroke/fill follow the active accent (cyan / amber).
 */
export default function BrandMark({
  size = 'md',
  className = '',
  animate = true,
}: BrandMarkProps) {
  const reduceMotion = useReducedMotion();
  const { accent, isLight } = useTheme();
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const inset = ((1 - BRAND_MARK_INSET_SCALE) / 2) * 512;
  const markColor =
    accent === 'amber'
      ? isLight
        ? '#b45309'
        : BRAND_ACCENT_HEX.amber
      : isLight
        ? '#0284c7'
        : BRAND_ACCENT_HEX.cyan;

  const mark = (
    <svg
      viewBox="0 0 512 512"
      width={px}
      height={px}
      className="block h-full w-full rounded-lg"
      aria-hidden
    >
      <rect width="512" height="512" fill="#06080d" />
      <g transform={`translate(${inset} ${inset}) scale(${BRAND_MARK_INSET_SCALE})`}>
        <path
          fill="none"
          stroke={markColor}
          strokeWidth={26}
          strokeLinejoin="round"
          d={BRAND_MARK_HEX_PATH}
        />
        <path fill={markColor} d={BRAND_MARK_MS_PATH} />
      </g>
    </svg>
  );

  if (!animate) {
    return (
      <span
        className={`inline-flex shrink-0 rounded-lg ${className}`}
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
      className={`inline-flex shrink-0 rounded-lg ${className}`}
      style={{ width: px, height: px }}
      aria-hidden
    >
      {mark}
    </motion.span>
  );
}
