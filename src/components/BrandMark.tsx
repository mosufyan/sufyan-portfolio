import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { brandMarkDataUrl, BRAND_MARK_PNG_SRC } from '../brand/brandMark';
import { useTheme } from '../theme/ThemeProvider';
import { EASE_OUT_EXPO } from './MotionPrimitives';

const SIZE_PX = {
  sm: 32,
  md: 36,
  lg: 40,
} as const;

/** Pre-rendered amber tile — same geometry as cyan PWA PNG, no hue-rotate. */
const BRAND_MARK_AMBER_PNG_SRC = '/pwa-192x192-amber.png';

export type BrandMarkSize = keyof typeof SIZE_PX | number;

interface BrandMarkProps {
  size?: BrandMarkSize;
  className?: string;
  /** Hover scale + 360° rotate (default on). Honors reduced-motion. */
  animate?: boolean;
}

/**
 * Exact approved hexagon+MS logo.
 * Cyan → shipped PWA PNG. Amber → matching amber PNG (never CSS hue-rotate).
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

  const src = useMemo(() => {
    if (!isAmber) return BRAND_MARK_PNG_SRC;
    // Light amber: generate SVG so the mark can use the darker amber ink.
    if (isLight) {
      return brandMarkDataUrl('#b45309', { background: '#06080d' });
    }
    return BRAND_MARK_AMBER_PNG_SRC;
  }, [isAmber, isLight]);

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
