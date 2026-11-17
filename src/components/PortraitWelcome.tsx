import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTheme } from '../theme/ThemeProvider';
import { EASE_OUT_EXPO } from './MotionPrimitives';

/** Welcome runtime on every page load (~2s) */
const WELCOME_MS = 2_000;
const FINALE_BURST_MS = 1_200;
const REVEAL_MS = 1_550;

export type PortraitWelcomePhase = 'checking' | 'welcome' | 'finale' | 'reveal' | 'live';

interface Spark {
  id: number;
  angle: number;
  distance: number;
  size: number;
  delay: number;
  color: string;
  rotate: number;
  isStar: boolean;
}

interface TwinkleStar {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

const GOLD = ['#fbbf24', '#f59e0b', '#fcd34d', '#fde68a', '#fff7ed', '#fef3c7'];
const CYAN = ['#67e8f9', '#38bdf8', '#e0f2fe', '#22d3ee'];

function buildBurstSparks(seed: number, count: number): Spark[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + seed * 17;
    const angle = (i / count) * Math.PI * 2 + (n % 5) * 0.12;
    const isStar = n % 3 !== 0;
    return {
      id: seed * 100 + i,
      angle,
      distance: 36 + (n % 6) * 12 + (n % 2) * 10,
      size: isStar ? 7 + (n % 4) * 2 : 2 + (n % 4),
      delay: (n % 9) * 0.03,
      color: isStar ? GOLD[n % GOLD.length] : CYAN[n % CYAN.length],
      rotate: (n * 41) % 360,
      isStar,
    };
  });
}

function buildTwinkles(): TwinkleStar[] {
  return Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: 12 + ((i * 37) % 76),
    y: 10 + ((i * 53) % 80),
    size: 6 + (i % 5) * 2,
    delay: (i % 8) * 0.35,
    duration: 1.6 + (i % 4) * 0.45,
    color: GOLD[i % GOLD.length],
  }));
}

function GoldStar({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      aria-hidden="true"
    >
      {/* 4-point sparkle + soft diamond core */}
      <path d="M12 1.5 L13.8 9.2 L21.5 12 L13.8 14.8 L12 22.5 L10.2 14.8 L2.5 12 L10.2 9.2 Z" />
      <circle cx="12" cy="12" r="1.6" fill="#fff7ed" opacity="0.9" />
    </svg>
  );
}

function BurstLayer({ sparks, flashColor }: { sparks: Spark[]; flashColor: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.35 }}
        animate={{ opacity: [0, 0.85, 0], scale: [0.35, 1.2, 1.45] }}
        transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
        className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
        style={{ backgroundColor: flashColor }}
      />

      {sparks.map((spark) => {
        const x = Math.cos(spark.angle) * spark.distance;
        const y = Math.sin(spark.angle) * spark.distance;
        return (
          <motion.span
            key={spark.id}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.25, rotate: spark.rotate }}
            animate={{
              opacity: [0, 1, 1, 0],
              x,
              y: y + (spark.isStar ? 8 : 0),
              scale: [0.25, 1.2, 1, 0.2],
              rotate: spark.rotate + (spark.isStar ? 90 : 35),
            }}
            transition={{
              duration: spark.isStar ? 1.35 : 0.95,
              delay: spark.delay,
              ease: EASE_OUT_EXPO,
            }}
            className="absolute left-1/2 top-1/2 flex items-center justify-center"
            style={{ marginLeft: -spark.size / 2, marginTop: -spark.size / 2 }}
          >
            {spark.isStar ? (
              <GoldStar size={spark.size} color={spark.color} />
            ) : (
              <span
                className="block rounded-[1px]"
                style={{
                  width: spark.size,
                  height: spark.size * 2.2,
                  backgroundColor: spark.color,
                  boxShadow: `0 0 6px ${spark.color}`,
                }}
              />
            )}
          </motion.span>
        );
      })}

      <motion.div
        initial={{ opacity: 0.75, scale: 0.5 }}
        animate={{ opacity: 0, scale: 1.2 }}
        transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
        className="absolute inset-3 rounded-full border border-amber-300/45"
      />
    </div>
  );
}

interface PortraitWelcomeProps {
  children: ReactNode;
  onPhaseChange?: (phase: PortraitWelcomePhase) => void;
}

/**
 * Welcome reveal inside the Hero portrait circle on every load (~2s):
 * Welcome + golden crackle → finale burst → photo flip-in.
 */
export default function PortraitWelcome({ children, onPhaseChange }: PortraitWelcomeProps) {
  const { isLight } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<PortraitWelcomePhase>('checking');
  const [crackleWave, setCrackleWave] = useState(0);
  const timersRef = useRef<number[]>([]);
  const twinkles = useMemo(() => buildTwinkles(), []);
  const finaleSparks = useMemo(() => buildBurstSparks(9, 36), []);
  const crackleSparks = useMemo(
    () => buildBurstSparks(crackleWave + 1, 22),
    [crackleWave]
  );

  const clearWelcomeTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    timersRef.current = [];
  }, []);

  const skipWelcome = useCallback(() => {
    clearWelcomeTimers();
    setPhase('live');
  }, [clearWelcomeTimers]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    if (shouldReduceMotion) {
      setPhase('live');
      return;
    }

    setPhase('welcome');

    // Crackle during the short welcome hold
    const tFirstCrackle = window.setTimeout(() => setCrackleWave(1), 250);
    const crackleTimer = window.setInterval(() => {
      setCrackleWave((w) => w + 1);
    }, 800);

    const tFinale = window.setTimeout(() => setPhase('finale'), FINALE_BURST_MS);
    const tReveal = window.setTimeout(() => setPhase('reveal'), REVEAL_MS);
    const tLive = window.setTimeout(() => setPhase('live'), WELCOME_MS);

    timersRef.current = [tFirstCrackle, crackleTimer, tFinale, tReveal, tLive];

    return () => clearWelcomeTimers();
  }, [shouldReduceMotion, clearWelcomeTimers]);

  const inWelcome = phase === 'welcome' || phase === 'finale';
  const showFinale = phase === 'finale' || phase === 'reveal';
  const showPhoto = phase === 'reveal' || phase === 'live';
  const isChecking = phase === 'checking';
  const showCrackle = phase === 'welcome';
  const showSkip = inWelcome || phase === 'reveal';

  return (
    <>
      <AnimatePresence mode="sync">
        {(showPhoto || isChecking) && (
          <motion.div
            key="portrait-photo"
            initial={
              phase === 'reveal'
                ? { opacity: 0, scale: 0.88, rotateY: -72 }
                : false
            }
            animate={{
              opacity: isChecking ? 0 : 1,
              scale: 1,
              rotateY: 0,
            }}
            transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
            style={{ transformPerspective: 900 }}
            className="absolute inset-0 z-10"
          >
            <div className="relative w-full h-full">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {inWelcome && (
          <motion.div
            key="welcome-copy"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08, filter: 'blur(8px)' }}
            transition={{ duration: 0.65, ease: EASE_OUT_EXPO }}
            className="portrait-welcome brand-on-color absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none print:hidden"
            style={{
              // Stable stage so light-theme remapping cannot wash the welcome plate
              background: isLight
                ? 'radial-gradient(circle at 50% 42%, #1e3a5f 0%, #0f172a 52%, #020617 100%)'
                : 'radial-gradient(circle at 50% 42%, rgba(20,35,59,0.55) 0%, rgba(6,8,13,0.2) 70%, transparent 100%)',
            }}
          >
            <motion.span
              initial={{ letterSpacing: '0.35em', opacity: 0.4 }}
              animate={{
                letterSpacing: '0.12em',
                opacity: 1,
                textShadow: isLight
                  ? [
                      '0 0 14px rgba(251,191,36,0.25)',
                      '0 0 26px rgba(56,189,248,0.35)',
                      '0 0 14px rgba(251,191,36,0.25)',
                    ]
                  : [
                      '0 0 12px rgba(251,191,36,0.15)',
                      '0 0 22px rgba(251,191,36,0.45)',
                      '0 0 12px rgba(251,191,36,0.15)',
                    ],
              }}
              transition={{
                letterSpacing: { duration: 0.9, ease: EASE_OUT_EXPO },
                opacity: { duration: 0.9, ease: EASE_OUT_EXPO },
                textShadow: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
              }}
              className="font-display font-bold text-white text-lg sm:text-xl lg:text-2xl tracking-wide"
              style={{ color: '#ffffff' }}
            >
              Welcome
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 0.95, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: EASE_OUT_EXPO }}
              className="mt-1.5 text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.22em]"
              style={{ color: isLight ? '#fde68a' : 'rgba(253, 230, 138, 0.92)' }}
            >
              Glad you&rsquo;re here
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {showSkip && (
        <button
          type="button"
          onClick={skipWelcome}
          className="portrait-welcome brand-on-color absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full border border-cyan-400/40 bg-slate-950/70 px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider text-cyan-200 hover:border-cyan-300 hover:text-white transition-colors print:hidden"
          style={{ color: '#e0f2fe' }}
          aria-label="Skip welcome animation"
        >
          Skip
        </button>
      )}

      {/* Ambient golden twinkle crackle while Welcome holds */}
      {inWelcome && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[25] pointer-events-none overflow-hidden rounded-full print:hidden"
        >
          {twinkles.map((star) => (
            <motion.span
              key={star.id}
              className="absolute"
              style={{ left: `${star.x}%`, top: `${star.y}%` }}
              initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
              animate={{
                opacity: [0, 1, 0.35, 1, 0],
                scale: [0.4, 1.15, 0.85, 1.2, 0.3],
                rotate: [0, 35, 70, 110],
              }}
              transition={{
                duration: star.duration,
                delay: star.delay,
                repeat: Infinity,
                repeatDelay: 0.4 + (star.id % 3) * 0.25,
                ease: 'easeInOut',
              }}
            >
              <GoldStar size={star.size} color={star.color} />
            </motion.span>
          ))}
        </div>
      )}

      {/* Periodic crackle bursts during the long Welcome hold */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-30 pointer-events-none print:hidden"
      >
        <AnimatePresence>
          {showCrackle && crackleWave > 0 && (
            <motion.div
              key={`crackle-${crackleWave}`}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <BurstLayer sparks={crackleSparks} flashColor="rgba(251, 191, 36, 0.35)" />
            </motion.div>
          )}
        </AnimatePresence>

        {showFinale && (
          <BurstLayer sparks={finaleSparks} flashColor="rgba(250, 204, 21, 0.45)" />
        )}
      </div>
    </>
  );
}
