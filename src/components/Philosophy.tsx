import { Quote, Compass } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { PERSONAL_INFO } from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import HeaderSpotlight from './HeaderSpotlight';
import { Reveal, EASE_OUT_EXPO } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';

export default function Philosophy() {
  const { isLight } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const pillars = [
    'SECURITY DATA PLATFORMS',
    'MULTI-CLOUD & ZERO TRUST',
    'RESILIENT SERVICES',
    'APPLIED AI / AGENTS',
    'DEVOPS & OBSERVABILITY',
  ];

  return (
    <section id="philosophy" className="py-16 lg:py-24 border-b border-slate-800/80 bg-[#06080d] relative overflow-hidden">
      <SectionScanLine />
      <div className="page-shell">
        <Reveal className="mb-10">
          <HeaderSpotlight>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
              <Compass className="w-3.5 h-3.5" />
              <span>ENGINEERING THESIS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-white tracking-tight">
              Philosophy
            </h2>
          </HeaderSpotlight>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 print:grid-cols-12 gap-8 items-stretch">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
            className="lg:col-span-7 print:col-span-7 rounded-2xl border border-slate-800 hover:border-slate-700/90 bg-[#0d121f]/80 p-6 sm:p-8 flex flex-col justify-between shadow-xl transition-colors print:break-inside-avoid"
          >
            <div className="space-y-5">
              <motion.blockquote
                initial={shouldReduceMotion ? false : { opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT_EXPO }}
                className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed italic border-l-2 border-cyan-400/80 pl-4"
              >
                &ldquo;{PERSONAL_INFO.philosophy.quote1}&rdquo;
              </motion.blockquote>

              <motion.p
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: 0.14, ease: EASE_OUT_EXPO }}
                className="text-slate-300 text-sm sm:text-base leading-relaxed font-light"
              >
                {PERSONAL_INFO.philosophy.body}
              </motion.p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800/80">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-3">
                Focus areas
              </div>
              <div className="flex flex-wrap gap-2">
                {pillars.map((pillar, idx) => (
                  <motion.span
                    key={pillar}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.05 + idx * 0.04, ease: EASE_OUT_EXPO }}
                    className="inline-flex items-center px-2.5 py-1 rounded text-[11px] font-mono tracking-wide bg-[#090d16] border border-slate-700/80 text-cyan-300/90 focus-within:ring-2 focus-within:ring-cyan-400/50"
                  >
                    {pillar}
                  </motion.span>
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
            className={`lg:col-span-5 print:col-span-5 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group transition-colors print:break-inside-avoid ${
              isLight
                ? 'border border-sky-200 hover:border-sky-300 bg-gradient-to-br from-sky-50 via-white to-slate-50'
                : 'border border-cyan-500/20 hover:border-cyan-400/35 bg-gradient-to-br from-[#0c1524] via-[#0d1226] to-[#080b18]'
            }`}
          >
            <div
              className={`absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-all duration-700 print:hidden ${
                isLight ? 'bg-sky-400/15' : 'bg-cyan-500/10'
              }`}
            />

            <div className="relative z-10">
              <div className="flex items-center justify-between pb-6">
                <Quote
                  className={`w-8 h-8 ${isLight ? 'text-sky-700/80' : 'text-cyan-400/80'}`}
                />
                <span
                  className={`text-[10px] font-mono uppercase tracking-widest ${
                    isLight ? 'text-sky-700/70' : 'text-cyan-300/60'
                  }`}
                >
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

            <div
              className={`relative z-10 pt-8 mt-8 flex items-center justify-between ${
                isLight ? 'border-t border-sky-200' : 'border-t border-cyan-500/20'
              }`}
            >
              <div>
                <div
                  className={`text-sm font-display font-semibold tracking-wide ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Mohammed Sufyan
                </div>
                <div className={`text-xs font-mono ${isLight ? 'text-sky-700' : 'text-cyan-300/80'}`}>
                  Software Engineer
                </div>
              </div>

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl font-mono text-xs font-bold ${
                  isLight
                    ? 'bg-sky-100 border border-sky-200 text-sky-700'
                    : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300'
                }`}
              >
                MS
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
