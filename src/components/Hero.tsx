import { MouseEvent as ReactMouseEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { Download, Mail, Share2, AtSign, Check, MonitorSmartphone, QrCode, Zap, Layers } from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { PERSONAL_INFO, STATS } from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import { AnimatedMetric, EASE_OUT_EXPO, SpotlightCard } from './MotionPrimitives';
import CiscoName from './CiscoName';
import HeroAtmosphere from './HeroAtmosphere';
import PortraitWelcome, { PortraitWelcomePhase } from './PortraitWelcome';
import type { PortfolioReadingMode } from './UnifiedScrollHud';

interface HeroProps {
  onOpenResume?: () => void;
  onOpenDigitalCard?: () => void;
  onApplySkills?: (skills: string[]) => void;
  readingMode?: PortfolioReadingMode;
  onChangeReadingMode?: (mode: PortfolioReadingMode) => void;
}

const CAPABILITY_MARQUEE_ITEMS = [
  { label: 'Zero Trust Architecture', skill: 'Zero Trust Architecture' },
  { label: 'Databricks Lakehouse', skill: 'Databricks' },
  { label: 'AWS · Azure · GCP', skill: 'AWS (S3, Redshift, DynamoDB)' },
  { label: 'Kubernetes (EKS/AKS/GKE)', skill: 'Kubernetes (EKS/AKS/GKE)' },
  { label: 'Python & PySpark', skill: 'Python (Programming Language)' },
  { label: 'CI/CD & DevSecOps', skill: 'CI/CD Pipelines' },
  { label: 'US · UK · India Delivery', skill: null },
] as const;

const ROLE_MOBILE = 'Software Engineer — Cisco STO CTO Ops';
const ROLE_DESKTOP =
  'Software Engineer — Cisco Systems Inc. Security & Trust Organization (STO) CTO Operations';

function StaggerLetters({
  text,
  active,
  className = '',
  delay = 0,
}: {
  text: string;
  active: boolean;
  className?: string;
  delay?: number;
}) {
  return (
    <span className="inline-block whitespace-nowrap">
      {text.split('').map((char, i) => (
        <motion.span
          key={`${text}-${i}-${char}`}
          initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
          animate={
            active
              ? { opacity: 1, y: 0, filter: 'blur(0px)' }
              : { opacity: 0, y: 14, filter: 'blur(4px)' }
          }
          transition={{
            duration: 0.38,
            delay: active ? delay + i * 0.045 : 0,
            ease: EASE_OUT_EXPO,
          }}
          className={`inline-block ${className}`}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}

function TypeInLine({
  text,
  active,
  className = '',
}: {
  text: string;
  active: boolean;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!active) {
      setShown(0);
      return;
    }
    if (shouldReduceMotion) {
      setShown(text.length);
      return;
    }

    setShown(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= text.length) window.clearInterval(id);
    }, 18);

    return () => window.clearInterval(id);
  }, [active, shouldReduceMotion, text]);

  return (
    <span className={className}>
      {text.slice(0, shown)}
      {active && shown < text.length && !shouldReduceMotion && (
        <span className="inline-block w-[0.55ch] ml-0.5 -mb-0.5 border-r-2 border-cyan-400/80 animate-pulse" />
      )}
    </span>
  );
}

function ShineCta({
  children,
  className = '',
  shineClassName = 'via-white/40',
}: {
  children: ReactNode;
  className?: string;
  shineClassName?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <span className={`relative inline-flex overflow-hidden rounded-lg max-w-full ${className}`}>
      {children}
      {!shouldReduceMotion && (
        <motion.span
          aria-hidden="true"
          animate={{ x: ['-130%', '230%'], opacity: [0, 0.85, 0] }}
          transition={{
            duration: 1.35,
            repeat: Infinity,
            repeatDelay: 4.8,
            ease: 'easeInOut',
          }}
          className={`pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent ${shineClassName} to-transparent skew-x-[-20deg] print:hidden`}
        />
      )}
    </span>
  );
}

export default function Hero({
  onOpenResume,
  onOpenDigitalCard,
  onApplySkills,
  readingMode = 'deep',
  onChangeReadingMode,
}: HeroProps) {
  const { isLight } = useTheme();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [marqueePaused, setMarqueePaused] = useState(false);
  const [portraitPhase, setPortraitPhase] = useState<PortraitWelcomePhase>('checking');
  const [roleActive, setRoleActive] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const handlePortraitPhase = useCallback((phase: PortraitWelcomePhase) => {
    setPortraitPhase(phase);
  }, []);

  const heroUnlocked =
    Boolean(shouldReduceMotion) ||
    portraitPhase === 'reveal' ||
    portraitPhase === 'live';
  const ringsHunting =
    !shouldReduceMotion &&
    (portraitPhase === 'welcome' || portraitPhase === 'finale' || portraitPhase === 'checking');
  const ringsLocked = heroUnlocked;

  useEffect(() => {
    if (!heroUnlocked) {
      setRoleActive(false);
      return;
    }
    if (shouldReduceMotion) {
      setRoleActive(true);
      return;
    }
    const t = window.setTimeout(() => setRoleActive(true), 1050);
    return () => window.clearTimeout(t);
  }, [heroUnlocked, shouldReduceMotion]);

  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const smoothTiltX = useSpring(tiltX, { stiffness: 200, damping: 24 });
  const smoothTiltY = useSpring(tiltY, { stiffness: 200, damping: 24 });

  const handlePortraitMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    tiltX.set(-py * 8);
    tiltY.set(px * 8);
  };

  const resetPortraitTilt = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  const copyEmail = () => {
    navigator.clipboard?.writeText(PERSONAL_INFO.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Mohammed Sufyan — Software Engineer',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <section id="overview" className="relative isolate pt-10 pb-14 lg:pt-16 lg:pb-20 overflow-hidden border-b border-slate-800/80 bg-[#07090e]">
      {/* Subtle interactive topographic dot-matrix / vector constellation strictly behind Hero */}
      <HeroAtmosphere />

      {/* Architectural blueprint dot/grid mask */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 pointer-events-none opacity-45 print:hidden"
        style={{
          backgroundImage:
            'radial-gradient(rgba(56, 189, 248, 0.16) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 100%)',
        }}
      />
      <motion.div
        aria-hidden="true"
        animate={{ x: ['-30%', '130%'], opacity: [0, 0.45, 0] }}
        transition={{ duration: 10, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
        className="absolute top-0 bottom-0 left-0 w-1/3 z-0 bg-gradient-to-r from-transparent via-cyan-400/[0.045] to-transparent skew-x-[-18deg] pointer-events-none print:hidden"
      />

      {/* Background glow atmosphere — CSS ambient drift scales cleanly on large TVs */}
      <div
        aria-hidden="true"
        className="ambient-orb absolute top-0 left-1/4 z-0 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-cyan-600/10 blur-3xl pointer-events-none print:hidden"
      />
      <div
        aria-hidden="true"
        className="ambient-orb ambient-orb-delayed absolute top-20 right-4 sm:right-10 z-0 h-64 w-64 sm:h-80 sm:w-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none print:hidden"
      />

      <div className="relative z-10 page-shell">
        {/* Main Hero Presentation */}
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-8 lg:gap-12">
          <div className="md:col-span-7 xl:col-span-8 flex flex-col space-y-4">
          {/* Main Headline — letter stagger unlocks with portrait reveal */}
          <h1 className="fluid-display font-display font-extrabold tracking-tight text-white text-balance">
            <span className="sr-only">Hello! I&apos;m Mohammed Sufyan</span>
            <span aria-hidden="true">
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={heroUnlocked ? { opacity: 1, y: 0 } : { opacity: 0.25, y: 6 }}
                transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                className="inline-block whitespace-nowrap"
              >
                Hello! I&apos;m
              </motion.span>{' '}
              <br className="hidden md:inline lg:hidden" />
              <StaggerLetters
                text="Mohammed"
                active={heroUnlocked}
                delay={0.08}
                className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
              />{' '}
              <br className="hidden lg:inline" />
              <StaggerLetters
                text="Sufyan"
                active={heroUnlocked}
                delay={0.08 + 'Mohammed'.length * 0.045}
                className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
              />
            </span>
          </h1>

          {/* Subtitle / Role — types in after name stagger */}
          <h2 className="text-sm sm:text-base 2xl:text-lg font-normal text-slate-300 leading-snug pt-1 max-w-3xl text-pretty min-h-[2.75rem] sm:min-h-[1.5rem]">
            <span className="sr-only">{ROLE_DESKTOP}</span>
            <span aria-hidden="true" className="sm:hidden">
              <TypeInLine text={ROLE_MOBILE} active={roleActive} />
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              <TypeInLine text={ROLE_DESKTOP} active={roleActive} />
            </span>
          </h2>

          {/* Lead Narrative */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24, ease: EASE_OUT_EXPO }}
            className="text-slate-400 text-xs sm:text-base leading-relaxed max-w-3xl font-light pt-1"
          >
            {readingMode === 'brief' ? (
              <>
                13+ years architecting security data platforms, multi-cloud vulnerability engines, and Zero Trust governance across <CiscoName />, HCLTech, and TCS (US · UK · India).
              </>
            ) : (
              <>
                Architecting high-velocity security data platforms, multi-cloud vulnerability engines, and enterprise compliance systems across {PERSONAL_INFO.experienceYears} years of engineering experience with <CiscoName />, HCL America Inc./HCLTech, and Tata Consultancy Services in the United States, United Kingdom, and India.
              </>
            )}
          </motion.p>

          {/* Action Bar */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT_EXPO }}
            className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-3 print:hidden"
          >
            {/* Button 1: View Architecture & Experience */}
            <ShineCta shineClassName="via-white/45">
              <motion.a
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                href="#experience"
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs sm:text-sm transition-colors shadow-md shadow-cyan-500/20 max-w-full"
              >
                <MonitorSmartphone className="w-4 h-4 shrink-0" />
                <span className="sm:hidden">View Experience</span>
                <span className="hidden sm:inline">View Architecture &amp; Experience</span>
              </motion.a>
            </ShineCta>

            {/* Button 2: Download Official CV */}
            <ShineCta shineClassName="via-cyan-200/25">
              <motion.button
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenResume}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-[#161c28] hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium transition-colors max-w-full"
              >
                <Download className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="sm:hidden">Download CV</span>
                <span className="hidden sm:inline">Download Official CV</span>
              </motion.button>
            </ShineCta>

            {/* Icon Buttons */}
            <div className="flex items-center gap-2">
              {/* Share Button */}
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleShare}
                className="p-2.5 rounded-lg border border-slate-800 bg-[#121722] text-slate-300 hover:text-white hover:border-slate-700 transition-colors relative"
                aria-label="Share"
                title="Share profile"
              >
                <Share2 className="w-4 h-4" />
                <AnimatePresence>
                  {shared && (
                    <motion.span
                      initial={{ opacity: 0, y: 4, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 2, scale: 0.94 }}
                      transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                      className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 border border-emerald-500/40 text-emerald-300 whitespace-nowrap shadow-md"
                    >
                      Link copied!
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Email Button */}
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={copyEmail}
                className="p-2.5 rounded-lg border border-slate-800 bg-[#121722] text-slate-300 hover:text-white hover:border-slate-700 transition-colors relative"
                aria-label="Email"
                title="Copy email address"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Mail className="w-4 h-4" />}
                <AnimatePresence>
                  {copied && (
                    <motion.span
                      initial={{ opacity: 0, y: 4, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 2, scale: 0.94 }}
                      transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                      className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 border border-emerald-500/40 text-emerald-300 whitespace-nowrap shadow-md"
                    >
                      Copied!
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Digital Business Card & QR Button */}
              {onOpenDigitalCard && (
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.94 }}
                  type="button"
                  onClick={onOpenDigitalCard}
                  className="p-2.5 rounded-lg border border-slate-800 bg-[#121722] text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer"
                  aria-label="Digital Business Card & QR"
                  title="Digital Business Card (.vcf & QR)"
                >
                  <QrCode className="w-4 h-4" />
                </motion.button>
              )}

              {/* Contact @ Button */}
              <motion.a
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  try {
                    if (window.location.hash !== '#contact') {
                      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#contact`);
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                className="p-2.5 rounded-lg border border-slate-800 bg-[#121722] text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                aria-label="Contact"
                title="Transmit message"
              >
                <AtSign className="w-4 h-4" />
              </motion.a>
            </div>
          </motion.div>

          {/* Recruiter 30-Second Brief vs Technical Deep-Dive Reading Mode */}
          {onChangeReadingMode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.36, ease: EASE_OUT_EXPO }}
              className="pt-2 flex flex-wrap items-center gap-3 print:hidden"
            >
              <div
                role="group"
                aria-label="Portfolio reading depth"
                className={`flex flex-wrap sm:inline-flex items-center gap-1 p-1 rounded-xl border w-fit max-w-full ${
                  isLight ? 'border-slate-200 bg-slate-100/90' : 'border-slate-800 bg-[#0d121f]/85'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChangeReadingMode('deep')}
                  aria-pressed={readingMode === 'deep'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    readingMode === 'deep'
                      ? isLight
                        ? 'bg-sky-600 text-white font-semibold shadow-sm'
                        : 'bg-cyan-500 text-slate-950 font-semibold'
                      : isLight
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Full Technical Deep-Dive</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeReadingMode('brief')}
                  aria-pressed={readingMode === 'brief'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    readingMode === 'brief'
                      ? isLight
                        ? 'bg-sky-600 text-white font-semibold shadow-sm'
                        : 'bg-cyan-500 text-slate-950 font-semibold'
                      : isLight
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  <span>Recruiter 30s Brief</span>
                </button>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {readingMode === 'brief'
                  ? 'Showing top impact bullets, proof metrics & pinned credentials'
                  : 'Complete architecture, role timeline & full 20-credential vault'}
              </span>
            </motion.div>
          )}
          </div>

          {/* Right Column: Animated Dark Architectural Portrait */}
          <div className="md:col-span-5 xl:col-span-4 order-first md:order-last flex justify-center md:justify-end">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.14, ease: EASE_OUT_EXPO }}
              onMouseMove={handlePortraitMove}
              onMouseLeave={resetPortraitTilt}
              style={
                shouldReduceMotion
                  ? undefined
                  : { rotateX: smoothTiltX, rotateY: smoothTiltY, transformPerspective: 900 }
              }
              className="relative flex items-center justify-center w-48 h-48 sm:w-60 sm:h-60 lg:w-72 lg:h-72 xl:w-[310px] xl:h-[310px] select-none"
            >
              {/* Breathing ambient dark-cyan aura behind portrait */}
              <motion.div
                aria-hidden="true"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : { scale: [0.95, 1.08, 0.95], opacity: [0.45, 0.8, 0.45] }
                }
                transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-2 rounded-full bg-gradient-to-tr from-cyan-500/25 via-sky-400/10 to-blue-600/25 blur-2xl pointer-events-none print:hidden"
              />

              {/* Outer dashed telemetry orbit ring — fast hunt, then lock-on */}
              <motion.div
                aria-hidden="true"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : ringsHunting
                      ? { rotate: 360, scale: 1 }
                      : { rotate: 360, scale: [1.06, 1] }
                }
                transition={
                  ringsHunting
                    ? { rotate: { duration: 12, repeat: Infinity, ease: 'linear' }, scale: { duration: 0.3 } }
                    : {
                        rotate: { duration: 42, repeat: Infinity, ease: 'linear', delay: 0.55 },
                        scale: { duration: 0.55, ease: EASE_OUT_EXPO },
                      }
                }
                className={`absolute inset-0 rounded-full border border-dashed pointer-events-none print:hidden ${
                  ringsLocked ? 'border-cyan-300/55' : 'border-cyan-400/35'
                }`}
              >
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-sky-400/80 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              </motion.div>

              {/* Inner counter-rotating arc ring */}
              <motion.div
                aria-hidden="true"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : ringsHunting
                      ? { rotate: -360 }
                      : { rotate: -360 }
                }
                transition={
                  ringsHunting
                    ? { duration: 9, repeat: Infinity, ease: 'linear' }
                    : { duration: 30, repeat: Infinity, ease: 'linear', delay: 0.55 }
                }
                className={`absolute inset-3 rounded-full border pointer-events-none print:hidden ${
                  ringsLocked
                    ? 'border-slate-600/70 border-t-cyan-300 border-r-sky-300/70'
                    : 'border-slate-700/60 border-t-cyan-400/70 border-r-sky-400/35'
                }`}
              />

              {/* Lock-on flash when portrait reveals */}
              <AnimatePresence>
                {ringsLocked && !shouldReduceMotion && (
                  <motion.div
                    key="orbit-lock-flash"
                    aria-hidden="true"
                    initial={{ opacity: 0.8, scale: 0.92 }}
                    animate={{ opacity: 0, scale: 1.12 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
                    className="absolute inset-1 rounded-full border border-cyan-300/60 shadow-[0_0_28px_rgba(34,211,238,0.35)] pointer-events-none print:hidden"
                  />
                )}
              </AnimatePresence>

              {/* Portrait dark glass frame (zero white background) */}
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { scale: 1.025 }}
                transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                className="relative w-[84%] h-[84%] rounded-full overflow-hidden border border-cyan-400/35 bg-[radial-gradient(circle_at_50%_32%,#14233b_0%,#0a101e_58%,#06080d_100%)] shadow-[0_0_45px_rgba(8,145,178,0.22)] ring-1 ring-inset ring-white/10"
              >
                {/* Subtle internal depth grid */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-25 pointer-events-none"
                  style={{
                    backgroundImage:
                      'radial-gradient(var(--accent-dot, rgba(56, 189, 248, 0.35)) 1px, transparent 1px)',
                    backgroundSize: '14px 14px',
                  }}
                />

                {/* Welcome → spark burst → photo (inside the circle only) */}
                <PortraitWelcome onPhaseChange={handlePortraitPhase}>
                  {/* Real full portrait cutout including shoulders, white shirt, and bow tie */}
                  <motion.img
                    src="/assets/aistudio/Sufyan_hero_portrait.png"
                    alt="Mohammed Sufyan — Software Engineer"
                    animate={shouldReduceMotion ? undefined : { y: [1, -1.5, 1] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative z-10 w-full h-full object-contain object-bottom scale-[1.01] drop-shadow-[0_10px_24px_rgba(0,0,0,0.65)]"
                  />

                  {/* Subtle bottom vignette keeping bow tie and shirt crisp */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-10 z-20 bg-gradient-to-t from-[#06080d]/45 via-[#06080d]/15 to-transparent"
                  />

                  {/* Subtle glass light sweep */}
                  <motion.div
                    aria-hidden="true"
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : { x: ['-130%', '230%'], opacity: [0, 0.5, 0] }
                    }
                    transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 5.5, ease: 'easeInOut' }}
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 z-30 bg-gradient-to-r from-transparent via-cyan-200/15 to-transparent skew-x-[-20deg] print:hidden"
                  />
                </PortraitWelcome>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* 4-Column Statistics Strip — count-up syncs with portrait reveal */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-4">
          {STATS.map((stat, idx) => (
            <SpotlightCard
              key={idx}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{
                opacity: {
                  duration: 0.45,
                  delay: (heroUnlocked ? 0.08 : 0.28) + idx * 0.07,
                  ease: EASE_OUT_EXPO,
                },
                y: {
                  duration: 0.45,
                  delay: (heroUnlocked ? 0.08 : 0.28) + idx * 0.07,
                  ease: EASE_OUT_EXPO,
                },
              }}
              className="rounded-xl border border-slate-800/80 bg-[#0d121f]/70 p-5 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-950/25 transition-colors group"
            >
              <div className="flex items-baseline gap-1 font-display font-extrabold text-3xl sm:text-4xl text-white tabular-nums tracking-tight group-hover:text-cyan-100 transition-colors">
                <AnimatedMetric value={stat.value} active={heroUnlocked} />
                {stat.fraction && (
                  <span className="text-lg text-slate-400 font-normal">{stat.fraction}</span>
                )}
              </div>
              <div className="mt-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
                {stat.label}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {stat.sublabel.includes('Cisco Systems Inc.') ? (
                  <>
                    <span className="sm:hidden">{stat.sublabel.replace('Cisco Systems Inc.', 'Cisco')}</span>
                    <span className="hidden sm:inline">{stat.sublabel}</span>
                  </>
                ) : (
                  stat.sublabel
                )}
              </div>
            </SpotlightCard>
          ))}
        </div>

        {/* Capability Marquee Strip */}
        <div
          onMouseEnter={() => setMarqueePaused(true)}
          onMouseLeave={() => setMarqueePaused(false)}
          className={`mt-6 overflow-hidden rounded-xl border py-2.5 px-3 print:hidden ${
            isLight
              ? 'border-slate-200 bg-white shadow-sm'
              : 'border-slate-800/80 bg-[#090d16]/75'
          }`}
          aria-label="Core engineering capabilities"
        >
          {shouldReduceMotion ? (
            <div
              className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-mono ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              {CAPABILITY_MARQUEE_ITEMS.map((item) =>
                item.skill && onApplySkills ? (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      onApplySkills([item.skill!]);
                      document.getElementById('experience')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`transition-colors ${
                      isLight ? 'hover:text-sky-700' : 'hover:text-cyan-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span key={item.label}>{item.label}</span>
                )
              )}
            </div>
          ) : (
            <div className="relative flex overflow-hidden">
              <motion.div
                animate={marqueePaused ? undefined : { x: ['0%', '-50%'] }}
                transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
                className={`flex shrink-0 items-center gap-6 pr-6 text-xs font-mono ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {[...CAPABILITY_MARQUEE_ITEMS, ...CAPABILITY_MARQUEE_ITEMS].map((item, idx) => (
                  <div key={`${item.label}-${idx}`} className="flex items-center gap-6 shrink-0">
                    {item.skill && onApplySkills ? (
                      <button
                        type="button"
                        onClick={() => {
                          onApplySkills([item.skill!]);
                          document.getElementById('experience')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`transition-colors whitespace-nowrap ${
                          isLight ? 'hover:text-sky-700' : 'hover:text-cyan-400'
                        }`}
                        title={`Filter portfolio by ${item.skill}`}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <span className="whitespace-nowrap">{item.label}</span>
                    )}
                    <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-slate-600'}>
                      /
                    </span>
                  </div>
                ))}
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
