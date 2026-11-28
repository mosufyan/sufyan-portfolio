import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import {
  brandMarkDataUrl,
  BRAND_ACCENT_HEX,
  BRAND_MARK_PNG_SRC,
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
 * Exact approved hexagon+MS logo (concept B / PWA mark).
 * Cyan uses the shipped PNG so pixels match the suggested logo;
 * amber uses the same SVG paths recolored.
 */
export default function BrandMark({
  size = 'md',
  className = '',
  animate = true,
}: BrandMarkProps) {
  const reduceMotion = useReducedMotion();
  const { accent, isLight } = useTheme();
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const isAmber = accent === 'amber';
  const markColor = isAmber
    ? isLight
      ? '#b45309'
      : BRAND_ACCENT_HEX.amber
    : BRAND_ACCENT_HEX.cyan;

  const src = useMemo(
    () => (isAmber ? brandMarkDataUrl(markColor) : BRAND_MARK_PNG_SRC),
    [isAmber, markColor]
  );

  const mark = (
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      draggable={false}
      decoding="async"
      className="block h-full w-full rounded-lg object-cover"
      style={{ transform: 'translateZ(0)' }}
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
