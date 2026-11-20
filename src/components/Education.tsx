import { GraduationCap, Award, Calendar, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { EDUCATION } from '../data/portfolioData';
import HeaderSpotlight from './HeaderSpotlight';
import { Reveal, StaggerContainer, StaggerItem, EASE_OUT_EXPO } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';
import type { PortfolioReadingMode } from './UnifiedScrollHud';

interface EducationProps {
  readingMode?: PortfolioReadingMode;
}

export default function Education({ readingMode = 'deep' }: EducationProps) {
  return (
    <section id="education" className="relative py-16 lg:py-24 border-b border-slate-800/80 bg-[#07090e]">
      <SectionScanLine />
      <div className="page-shell">
        {/* Section Header */}
        <Reveal className="mb-10 lg:mb-12">
          <HeaderSpotlight>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>ACADEMIC FOUNDATION</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-white tracking-tight">
              Education &amp; Scholastic Honors
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl">
              Formal training in computer science, distributed algorithms, discrete mathematics, and applied sciences underpinning 13+ years of systems architecture.
            </p>
          </HeaderSpotlight>
        </Reveal>

        {/* Architectural Hairline-Ruled Columns — clean contrast after card-heavy sections */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-8 lg:gap-12" staggerDelay={0.09}>
          {EDUCATION.map((edu, idx) => (
            <StaggerItem key={idx} className="h-full">
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                className="h-full border-t-2 border-cyan-500/45 pt-6 pb-4 flex flex-col justify-between print:break-inside-avoid"
              >
                <div>
                  {/* Unboxed Typographic Metadata Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80 text-xs font-mono">
                    <span className="inline-flex items-center gap-1.5 text-cyan-400">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{edu.period}</span>
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      {edu.grade}
                    </span>
                  </div>

                  {/* Degree Title */}
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-white mt-5 leading-snug">
                    {edu.degree}
                  </h3>
                  <div className="text-sm font-medium text-cyan-400 mt-1">
                    {edu.field}
                  </div>

                  {/* Institution & Location */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-slate-400">
                    <span>{edu.institution}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{edu.location}</span>
                    </span>
                  </div>

                  {readingMode === 'deep' && (
                    <p className="text-xs sm:text-sm text-slate-300 mt-4 leading-relaxed font-light">
                      {edu.details}
                    </p>
                  )}
                </div>

                {/* Bottom verification footer */}
                <div className="pt-4 mt-6 border-t border-slate-800/70 flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <Award className="w-3.5 h-3.5 text-cyan-400" />
                    Accredited University Degree
                  </span>
                  <span className="text-slate-500">Conferred</span>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
