import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface ThemeSymbolProps {
  isLight: boolean;
  boxClassName?: string;
  iconClassName?: string;
  sunColorClass?: string;
  moonColorClass?: string;
  keyPrefix?: string;
}

/**
 * Shared animated Sun/Moon theme indicator used across Navbar, CV Export modal,
 * and Social Share Card Studio so Dark/Light theme toggles share one visual symbol.
 */
export default function ThemeSymbol({
  isLight,
  boxClassName = 'h-3.5 w-3.5',
  iconClassName = 'w-3.5 h-3.5',
  sunColorClass = 'text-amber-500',
  moonColorClass = 'text-cyan-400',
  keyPrefix = 'theme',
}: ThemeSymbolProps) {
  return (
    <span className={`relative inline-flex items-center justify-center shrink-0 ${boxClassName}`}>
      <AnimatePresence mode="wait" initial={false}>
        {isLight ? (
          <motion.span
            key={`${keyPrefix}-sun`}
            initial={{ opacity: 0, rotate: -60, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 60, scale: 0.5 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sun className={`${iconClassName} ${sunColorClass}`} />
          </motion.span>
        ) : (
          <motion.span
            key={`${keyPrefix}-moon`}
            initial={{ opacity: 0, rotate: 60, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -60, scale: 0.5 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Moon className={`${iconClassName} ${moonColorClass}`} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
