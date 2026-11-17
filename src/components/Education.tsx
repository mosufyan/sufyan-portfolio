import { GraduationCap, Award, Calendar, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { EDUCATION } from '../data/portfolioData';
import HeaderSpotlight from './HeaderSpotlight';
import { Reveal, StaggerContainer, StaggerItem, EASE_OUT_EXPO } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';

export default function Education() {
  return (
    <section id="education" className="relative py-16 lg:py-24 border-b border-slate-800/80 bg-[#07090e]">
      <SectionScanLine />
      <div className="page-shell">
        {/* Section Header */}
        <Reveal className="mb-10">
          <HeaderSpotlight>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>ACADEMIC FOUNDATION</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-white tracking-tight">
              Education &amp; Scholastic Honors
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl">
              Formal engineering pedagogy grounded in computer science, distributed algorithms, discrete mathematics, and applied sciences.
            </p>
          </HeaderSpotlight>
        </Reveal>

        {/* 2-Card Grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-6" staggerDelay={0.09}>
          {EDUCATION.map((edu, idx) => (
            <StaggerItem key={idx} className="h-full">
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                className="h-full rounded-2xl border border-slate-800 bg-[#0d121f]/70 p-6 sm:p-8 flex flex-col justify-between hover:border-cyan-500/40 transition-colors hover:shadow-xl hover:shadow-cyan-950/25 print:break-inside-avoid"
              >
                <div>
                  {/* Header row with period & grade badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
                    <span className="flex items-center gap-1.5 text-xs font-mono text-cyan-400">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{edu.period}</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide bg-emerald-950/50 border border-emerald-500/40 text-emerald-300">
                      {edu.grade}
                    </span>
                  </div>

                  {/* Degree Title */}
                  <h3 className="text-xl font-display font-bold text-white mt-4 leading-snug">
                    {edu.degree}
                  </h3>
                  <div className="text-sm font-medium text-cyan-400 mt-1">
                    {edu.field}
                  </div>

                  {/* Institution & Location */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-400">
                    <span>{edu.institution}</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{edu.location}</span>
                    </span>
                  </div>

                  {/* Details */}
                  <p className="text-xs sm:text-sm text-slate-300 mt-4 leading-relaxed font-light">
                    {edu.details}
                  </p>
                </div>

                {/* Bottom verification tag */}
                <div className="pt-4 mt-6 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Award className="w-3.5 h-3.5 text-cyan-400" />
                    Accredited University Degree
                  </span>
                  <span className="text-slate-500">Graduated</span>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
