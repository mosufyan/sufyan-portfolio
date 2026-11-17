import { Quote, Compass } from 'lucide-react';
import { motion } from 'motion/react';
import { PERSONAL_INFO } from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import HeaderSpotlight from './HeaderSpotlight';
import { Reveal, EASE_OUT_EXPO } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';

export default function Philosophy() {
  const { isLight } = useTheme();
  const pillars = [
    'ARCHITECTURAL LEADERSHIP',
    'CLOUD-NATIVE SERVICES & SCALE DEV',
    'HIGH CONCURRENCY RESILIENCE',
    'CITIZEN AI ARCHITECTS',
    'DEVOPS, SRE & DISTRIBUTED SYSTEMS'
  ];

  return (
    <section id="philosophy" className="py-16 lg:py-24 border-b border-slate-800/80 bg-[#06080d] relative overflow-hidden">
      <SectionScanLine />
      <div className="page-shell">
        {/* Section Heading */}
        <Reveal className="mb-10">
          <HeaderSpotlight>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
              <Compass className="w-3.5 h-3.5" />
              <span>ARCHITECTURAL PROFILE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-white tracking-tight">
              Personal Profile & Engineering Philosophy
            </h2>
          </HeaderSpotlight>
        </Reveal>

        {/* 2-Card Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 print:grid-cols-12 gap-8 items-stretch">
          {/* Left Card: Core Narrative & Pillars */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
            className="lg:col-span-7 print:col-span-7 rounded-2xl border border-slate-800 hover:border-slate-700/90 bg-[#0d121f]/80 p-6 sm:p-8 flex flex-col justify-between shadow-xl transition-colors print:break-inside-avoid"
          >
            <div className="space-y-5">
              <blockquote className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed italic border-l-2 border-cyan-400/80 pl-4">
                "{PERSONAL_INFO.philosophy.quote1}"
              </blockquote>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-light">
                {PERSONAL_INFO.philosophy.body}
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Over the course of 13+ years of production system engineering across Fortune 500 organizations, my leadership focus has centered on architecting self-healing, auditable multi-cloud foundations. By bridging developer velocity with rigorous Zero Trust boundaries and telemetry instrumentation, distributed pods achieve deterministic reliability and peak operational velocity.
              </p>
            </div>

            {/* Architecture Pillars */}
            <div className="pt-6 mt-6 border-t border-slate-800/80">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-3">
                Core Architectural Pillars & Disciplines
              </div>
              <div className="flex flex-wrap gap-2">
                {pillars.map((pillar, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2.5 py-1 rounded text-[11px] font-mono tracking-wide bg-[#090d16] border border-slate-700/80 text-cyan-300/90 hover:border-cyan-500/50 hover:-translate-y-0.5 transition-all"
                  >
                    {pillar}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Card: Poetic quote on glowing indigo/violet canvas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.55, delay: 0.1, ease: EASE_OUT_EXPO }}
            whileHover={{ y: -3 }}
            className={`lg:col-span-5 print:col-span-5 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group transition-colors print:break-inside-avoid ${
              isLight
                ? 'border border-indigo-200 hover:border-indigo-300 bg-gradient-to-br from-indigo-50 via-white to-slate-50'
                : 'border border-indigo-500/20 hover:border-indigo-400/40 bg-gradient-to-br from-[#121633] via-[#0d1226] to-[#080b18]'
            }`}
          >
            {/* Ambient decorative glow */}
            <div
              className={`absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-all duration-700 print:hidden ${
                isLight
                  ? 'bg-indigo-400/15 group-hover:bg-indigo-400/25'
                  : 'bg-indigo-500/10 group-hover:bg-indigo-500/20'
              }`}
            />

            <div className="relative z-10">
              <div className="flex items-center justify-between pb-6">
                <Quote
                  className={`w-8 h-8 group-hover:scale-105 transition-transform duration-300 ${
                    isLight ? 'text-indigo-600/80' : 'text-indigo-400/80'
                  }`}
                />
                <span
                  className={`text-[10px] font-mono uppercase tracking-widest ${
                    isLight ? 'text-indigo-600/70' : 'text-indigo-300/60'
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
                isLight ? 'border-t border-indigo-200' : 'border-t border-indigo-500/20'
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
                <div
                  className={`text-xs font-mono ${
                    isLight ? 'text-indigo-700' : 'text-indigo-300/80'
                  }`}
                >
                  Principal Cloud Solutions Architect
                </div>
              </div>

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl font-mono text-xs font-bold ${
                  isLight
                    ? 'bg-indigo-100 border border-indigo-200 text-indigo-700'
                    : 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
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
