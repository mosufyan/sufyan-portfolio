import { MouseEvent as ReactMouseEvent, useState } from 'react';
import { Download, Mail, Share2, AtSign, Check, MonitorSmartphone, QrCode } from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { PERSONAL_INFO, STATS } from '../data/portfolioData';
import { AnimatedMetric, EASE_OUT_EXPO, SpotlightCard } from './MotionPrimitives';

interface HeroProps {
  onOpenResume?: () => void;
  onOpenDigitalCard?: () => void;
}

export default function Hero({ onOpenResume, onOpenDigitalCard }: HeroProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const shouldReduceMotion = useReducedMotion();

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
        title: 'Mohammed Sufyan — Cloud Solutions Architect',
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
      {/* Architectural blueprint dot/grid mask */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 pointer-events-none opacity-65 print:hidden"
        style={{
          backgroundImage:
            'radial-gradient(rgba(56, 189, 248, 0.18) 1px, transparent 1px)',
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

      {/* Background glow atmosphere */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-0 left-1/4 z-0 h-96 w-96 rounded-full bg-cyan-600/10 blur-3xl pointer-events-none print:hidden"
      />
      <motion.div
        animate={{ scale: [1.05, 0.95, 1.05], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-20 right-10 z-0 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none print:hidden"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Hero Presentation */}
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-8 lg:gap-12">
          <div className="md:col-span-7 xl:col-span-8 flex flex-col space-y-4">
          {/* Kicker subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.04, ease: EASE_OUT_EXPO }}
            className="text-[11px] sm:text-xs font-mono tracking-wider text-slate-400 uppercase pt-1"
          >
            GLOBAL CLOUD INFRASTRUCTURE • SECOPS • MULTI-CLOUD ARCHITECTURE
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: EASE_OUT_EXPO }}
            className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-white leading-[1.08] text-balance"
          >
            Hello! I&apos;m <span className="bg-gradient-to-r from-[#38bdf8] via-cyan-300 to-sky-400 bg-clip-text text-transparent">Mohammed</span>
            <br />
            <span className="bg-gradient-to-r from-[#38bdf8] via-cyan-300 to-sky-400 bg-clip-text text-transparent">Sufyan</span>
          </motion.h1>

          {/* Subtitle / Role */}
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18, ease: EASE_OUT_EXPO }}
            className="text-sm sm:text-base font-normal text-slate-300 leading-snug pt-1"
          >
            Software Engineer — Cisco Security &amp; Trust Organization (STO) CTO Operations | Cloud Solutions Architect
          </motion.h2>

          {/* Lead Narrative */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24, ease: EASE_OUT_EXPO }}
            className="text-slate-400 text-xs sm:text-base leading-relaxed max-w-3xl font-light pt-1"
          >
            Architecting high-velocity security data platforms, multi-cloud vulnerability engines, and enterprise compliance systems across {PERSONAL_INFO.experienceYears} years of engineering experience with Cisco, HCL America Inc., and Tata Consultancy Services in the United States, United Kingdom, and India.
          </motion.p>

          {/* Action Bar */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT_EXPO }}
            className="flex flex-wrap items-center gap-3 pt-3 print:hidden"
          >
            {/* Button 1: View Architecture & Experience */}
            <motion.a
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              href="#experience"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#38bdf8] hover:bg-sky-300 text-slate-950 font-semibold text-xs sm:text-sm transition-colors shadow-md shadow-sky-500/20"
            >
              <MonitorSmartphone className="w-4 h-4" />
              <span>View Architecture &amp; Experience</span>
            </motion.a>

            {/* Button 2: Download Official CV */}
            <motion.button
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={onOpenResume}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-[#161c28] hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span>Download Official CV</span>
            </motion.button>

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
                className="p-2.5 rounded-lg border border-slate-800 bg-[#121722] text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                aria-label="Contact"
                title="Transmit message"
              >
                <AtSign className="w-4 h-4" />
              </motion.a>
            </div>
          </motion.div>
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

              {/* Outer dashed telemetry orbit ring */}
              <motion.div
                aria-hidden="true"
                animate={shouldReduceMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-dashed border-cyan-400/30 pointer-events-none print:hidden"
              >
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-sky-400/80 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              </motion.div>

              {/* Inner counter-rotating arc ring */}
              <motion.div
                aria-hidden="true"
                animate={shouldReduceMotion ? undefined : { rotate: -360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-3 rounded-full border border-slate-700/60 border-t-cyan-400/70 border-r-sky-400/35 pointer-events-none print:hidden"
              />

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
                      'radial-gradient(rgba(56, 189, 248, 0.35) 1px, transparent 1px)',
                    backgroundSize: '14px 14px',
                  }}
                />

                {/* Real full portrait cutout including shoulders, white shirt, and bow tie */}
                <motion.img
                  src="/assets/aistudio/Sufyan_hero_portrait.png"
                  alt="Mohammed Sufyan — Software Engineer & Cloud Solutions Architect"
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
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* 4-Column Statistics Strip */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-4">
          {STATS.map((stat, idx) => (
            <SpotlightCard
              key={idx}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              transition={{
                opacity: { duration: 0.45, delay: 0.28 + idx * 0.07, ease: EASE_OUT_EXPO },
                y: { duration: 0.45, delay: 0.28 + idx * 0.07, ease: EASE_OUT_EXPO },
              }}
              className="rounded-xl border border-slate-800/80 bg-[#0d121f]/70 p-5 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-950/25 transition-colors group"
            >
              <div className="flex items-baseline gap-1 font-display font-extrabold text-3xl sm:text-4xl text-white tabular-nums tracking-tight group-hover:text-cyan-100 transition-colors">
                <AnimatedMetric value={stat.value} />
                {stat.fraction && (
                  <span className="text-lg text-slate-400 font-normal">{stat.fraction}</span>
                )}
              </div>
              <div className="mt-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
                {stat.label}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {stat.sublabel}
              </div>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}
