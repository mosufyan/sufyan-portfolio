import { Quote, Compass } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { PERSONAL_INFO } from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import HeaderSpotlight from './HeaderSpotlight';
import { Reveal, EASE_OUT_EXPO } from './MotionPrimitives';
import BrandMark from './BrandMark';
import SectionScanLine from './SectionScanLine';
import type { PortfolioReadingMode } from './UnifiedScrollHud';

interface PhilosophyProps {
  readingMode?: PortfolioReadingMode;
}

export default function Philosophy({ readingMode = 'deep' }: PhilosophyProps) {
  const { isLight, accent } = useTheme();
  const isAmber = accent === 'amber';
  const shouldReduceMotion = useReducedMotion();
  const pillars = [
    'Security Data Platforms',
    'Multi-Cloud & Zero Trust',
    'Resilient Services',
    'Applied AI / Agents',
    'DevOps & Observability',
  ];

  // Explicit accent classes — remaps miss Lucide SVG + some sky utilities in this card.
  const labelAccent = isAmber
    ? isLight
      ? 'text-amber-800'
      : 'text-amber-300'
    : isLight
      ? 'text-sky-700'
      : 'text-cyan-300';
  const iconAccent = isAmber
    ? isLight
      ? 'text-amber-700'
      : 'text-amber-400'
    : isLight
      ? 'text-sky-700'
      : 'text-cyan-400';
  const indexAccent = isAmber
    ? isLight
      ? 'text-amber-700'
      : 'text-amber-400'
    : 'text-cyan-400';
  const creedCardShell = isAmber
    ? isLight
      ? 'border border-amber-300 hover:border-amber-400 bg-gradient-to-br from-amber-50 via-white to-slate-50'
      : 'border border-amber-500/30 hover:border-amber-400/40 bg-gradient-to-br from-[#1a140c] via-[#16100a] to-[#0c0a08]'
    : isLight
      ? 'border border-sky-200 hover:border-sky-300 bg-gradient-to-br from-sky-50 via-white to-slate-50'
      : 'border border-cyan-500/30 hover:border-cyan-400/40 bg-gradient-to-br from-[#0c1524] via-[#0d1226] to-[#080b18]';
  const creedGlow = isAmber
    ? isLight
      ? 'bg-amber-400/15'
      : 'bg-amber-500/10'
    : isLight
      ? 'bg-sky-400/15'
      : 'bg-cyan-500/10';
  const creedDivider = isAmber
    ? isLight
      ? 'border-t border-amber-200'
      : 'border-t border-amber-500/30'
    : isLight
      ? 'border-t border-sky-200'
      : 'border-t border-cyan-500/30';
  const ambientOrb = isAmber ? 'bg-amber-500/8' : 'bg-cyan-500/8';
  const eyebrow = isAmber
    ? isLight
      ? 'text-amber-700'
      : 'text-amber-400'
    : 'text-cyan-400';

  return (
    <section id="philosophy" className="py-16 lg:py-24 2xl:py-28 border-b border-slate-800/80 bg-[#06080d] relative overflow-hidden">
      <SectionScanLine />
      <div
        aria-hidden="true"
        className={`ambient-orb pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full blur-3xl print:hidden ${ambientOrb}`}
      />
      <div className="page-shell">
        <Reveal className="mb-10 lg:mb-12">
          <HeaderSpotlight>
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium tracking-wider uppercase mb-2 ${eyebrow}`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="text-shimmer">ENGINEERING THESIS</span>
            </div>
            <h2 className="fluid-title font-display font-bold text-white tracking-tight">
              Philosophy
            </h2>
          </HeaderSpotlight>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 print:grid-cols-12 gap-10 lg:gap-14 items-stretch">
          {/* Open editorial left column — breathes cleanly without nested dark box */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
            className="lg:col-span-7 print:col-span-7 flex flex-col justify-between py-2 print:break-inside-avoid"
          >
            <div className="space-y-6">
              <motion.blockquote
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT_EXPO }}
                className={`fluid-lead font-serif font-normal tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                &ldquo;{PERSONAL_INFO.philosophy.quote1}&rdquo;
              </motion.blockquote>

              {readingMode === 'deep' && (
                <motion.p
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.45, delay: 0.14, ease: EASE_OUT_EXPO }}
                  className="text-slate-300 text-sm sm:text-base leading-relaxed font-light max-w-2xl"
                >
                  {PERSONAL_INFO.philosophy.body}
                </motion.p>
              )}
            </div>

            <div className="pt-8 mt-8 border-t border-slate-800/80">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-3.5">
                Core Architectural Focus
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                {pillars.map((pillar, idx) => (
                  <motion.div
                    key={pillar}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.05 + idx * 0.04, ease: EASE_OUT_EXPO }}
                    className="flex items-baseline gap-2.5 text-xs sm:text-sm font-mono py-1 border-b border-slate-800/50"
                  >
                    <span className={`text-[11px] tabular-nums ${indexAccent}`}>0{idx + 1}.</span>
                    <span className={isLight ? 'text-slate-800 font-medium' : 'text-slate-200'}>
                      {pillar}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.55, delay: 0.1, ease: EASE_OUT_EXPO }}
            whileHover={shouldReduceMotion ? undefined : { y: -3 }}
            className={`lg:col-span-5 print:col-span-5 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group transition-colors print:break-inside-avoid ${creedCardShell}`}
          >
            <div
              className={`absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-all duration-700 print:hidden ${creedGlow}`}
            />

            <div className="relative z-10">
              <div className="flex items-center justify-between pb-6">
                <Quote className={`w-8 h-8 ${iconAccent}`} />
                <span className={`text-[10px] font-mono uppercase tracking-widest ${labelAccent}`}>
                  GUIDING CREED
                </span>
              </div>

              <blockquote
                className={`text-lg sm:text-xl md:text-2xl font-serif font-normal leading-relaxed tracking-wide mt-2 ${
                  isLight ? 'text-slate-800' : 'text-slate-100'
                }`}
              >
                &ldquo;Knowledge is my companion,
                <br />
                it boasts me wherever I go.
                <br />
                My heart is its container, and
                <br />
                not the bookshelf.&rdquo;
              </blockquote>
            </div>

            <div className={`relative z-10 pt-8 mt-8 flex items-center justify-between ${creedDivider}`}>
              <div>
                <div
                  className={`text-sm font-display font-semibold tracking-wide ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Mohammed Sufyan
                </div>
                <div className={`text-xs font-mono ${labelAccent}`}>Software Engineer</div>
              </div>

              <BrandMark size="lg" className="rounded-xl" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
