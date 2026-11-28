import { Cpu, Layers, Server, Shield, Terminal, Activity, Sparkles, CheckCircle2, X, ArrowUpRight, Share2, Check } from 'lucide-react';
import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { SKILL_FILTER_PRESETS } from '../data/portfolioData';
import { usePortfolioContent } from '../contexts/PortfolioContentContext';
import {
  doesCertMatchSkill,
  doesRoleMatchSkill,
  doesTechTagMatchSkill,
  formatSkillFilterSummary,
} from '../utils/skillMatcher';
import HeaderSpotlight from './HeaderSpotlight';
import { Reveal, SoftRise, StaggerContainer, StaggerItem, EASE_OUT_EXPO, SpotlightCard } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';
import type { PortfolioReadingMode } from './UnifiedScrollHud';

interface SkillsProps {
  selectedSkills: string[];
  onSelectSkill: (skill: string | null) => void;
  onApplySkills: (skills: string[]) => void;
  readingMode?: PortfolioReadingMode;
}

function MagneticSkillTag({
  label,
  highlighted,
  onToggle,
}: {
  label: string;
  highlighted: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });

  const handleMove = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (shouldReduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    x.set(dx * 0.32);
    y.set(dy * 0.32);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      style={shouldReduceMotion ? undefined : { x: springX, y: springY }}
      whileTap={{ scale: 0.94 }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onToggle}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
        highlighted
          ? 'skill-chip-active bg-cyan-500 border border-cyan-500 text-slate-950 font-semibold shadow-sm shadow-cyan-500/30'
          : 'bg-[#090d16] border border-slate-800/80 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200'
      }`}
      title={highlighted ? `Remove ${label} from skill filters` : `Add ${label} to skill filters`}
      aria-pressed={highlighted}
    >
      {label}
      {highlighted && <X className="w-3 h-3 shrink-0 opacity-80" aria-hidden="true" />}
    </motion.button>
  );
}

export default function Skills({ selectedSkills, onSelectSkill, onApplySkills, readingMode = 'deep' }: SkillsProps) {
  const {
    certifications: CERTIFICATIONS,
    disciplines: TECHNICAL_DISCIPLINES,
    workExperience: WORK_EXPERIENCE,
  } = usePortfolioContent();
  const [linkCopied, setLinkCopied] = useState(false);
  const [countPulse, setCountPulse] = useState(0);
  const skillFilter = formatSkillFilterSummary(selectedSkills);
  const hasSkillFilter = skillFilter.count > 0;

  useEffect(() => {
    if (!hasSkillFilter) return;
    setCountPulse((n) => n + 1);
  }, [hasSkillFilter, selectedSkills]);

  const copySkillLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    }).catch(() => {});
  };

  const matchingRolesCount = hasSkillFilter
    ? WORK_EXPERIENCE.reduce(
        (acc, comp) => acc + comp.roles.filter((r) => doesRoleMatchSkill(r, selectedSkills)).length,
        0
      )
    : 0;
  const matchingCertsCount = hasSkillFilter
    ? CERTIFICATIONS.filter((c) => doesCertMatchSkill(c, selectedSkills)).length
    : 0;

  const getIcon = (id: string) => {
    switch (id) {
      case 'ai-genai':
        return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'python-scripting':
        return <Terminal className="w-5 h-5 text-yellow-400" />;
      case 'cloud-platforms':
        return <Server className="w-5 h-5 text-sky-400" />;
      case 'devops-containers':
        return <Layers className="w-5 h-5 text-blue-400" />;
      case 'security-governance':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case 'observability-telemetry':
        return <Activity className="w-5 h-5 text-cyan-400" />;
      default:
        return <Cpu className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <section id="skills" className="relative py-16 lg:py-24 border-b border-slate-800/80 bg-[#06080d]">
      <SectionScanLine />
      <div className="page-shell">
        {/* Section Header */}
        <Reveal className="mb-10">
          <HeaderSpotlight>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>DISCIPLINE TAXONOMY</span>
          </div>
          <h2 className="fluid-title font-display font-bold text-white tracking-tight">
            Technical Skills &amp; Architecture Disciplines
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl">
            Enterprise expertise across multi-cloud infrastructure, autonomous agentic AI systems, Zero Trust security governance, and high-throughput telemetry pipelines.
          </p>
          <div className="mt-3 flex flex-col gap-2 print:hidden">
            {!hasSkillFilter && (
              <p className="text-[11px] sm:text-xs font-mono text-cyan-400/90 tracking-wide">
                Tip: click technology tags to cross-filter Experience &amp; Certifications — select multiple skills to refine
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mr-0.5">
                Saved views
              </span>
              {SKILL_FILTER_PRESETS.map((preset) => {
                const active =
                  preset.skills.length === selectedSkills.length &&
                  preset.skills.every((skill) =>
                    selectedSkills.some((s) => s.toLowerCase() === skill.toLowerCase())
                  );
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onApplySkills([...preset.skills])}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      active
                        ? 'skill-chip-active bg-cyan-500 border-cyan-500 text-slate-950 font-semibold'
                        : 'bg-[#090d16] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-cyan-500/40'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
          </HeaderSpotlight>

          <AnimatePresence>
            {hasSkillFilter && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="skill-filter-banner mt-4 sticky top-16 z-20 flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-cyan-950/90 border border-cyan-500/40 text-xs font-mono text-cyan-200 w-full sm:w-fit shadow-lg shadow-cyan-950/20 backdrop-blur-md print:hidden"
              >
                <span className="min-w-0">
                  {skillFilter.label}:{' '}
                  <strong className="text-cyan-300 break-words">{skillFilter.names}</strong>
                </span>
                <span className="text-slate-500">·</span>
                <motion.a
                  key={`roles-${countPulse}`}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                  href="#experience"
                  className="inline-flex items-center gap-1 text-cyan-300 hover:text-white underline underline-offset-2 whitespace-nowrap shrink-0"
                >
                  <span>{matchingRolesCount} matching {matchingRolesCount === 1 ? 'role' : 'roles'}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </motion.a>
                <span className="text-slate-500">·</span>
                <motion.a
                  key={`certs-${countPulse}`}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                  href="#certifications"
                  className="inline-flex items-center gap-1 text-cyan-300 hover:text-white underline underline-offset-2 whitespace-nowrap shrink-0"
                >
                  <span>{matchingCertsCount} matching {matchingCertsCount === 1 ? 'cert' : 'certs'}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </motion.a>
                <button
                  type="button"
                  onClick={copySkillLink}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white transition-colors"
                  title="Copy shareable link with this skill filter"
                >
                  {linkCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
                  <span>{linkCopied ? 'Copied!' : 'Share Filter'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSkill(null)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors"
                  aria-label={skillFilter.count > 1 ? 'Clear all skill filters' : 'Clear selected skill'}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{skillFilter.count > 1 ? 'Clear filters' : 'Clear filter'}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </Reveal>

        {/* Discipline grid — fluid columns from phone → tablet → desktop → ultra-wide */}
        <SoftRise>
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 min-[2560px]:grid-cols-3 print:grid-cols-2 gap-4 sm:gap-6 min-[2560px]:gap-8">
          {TECHNICAL_DISCIPLINES.map((discipline) => {
            return (
              <StaggerItem key={discipline.id} className="h-full">
                <SpotlightCard
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                  className="h-full rounded-2xl border border-slate-800 bg-[#0d121f]/70 p-5 sm:p-6 min-[2560px]:p-8 flex flex-col justify-between hover:border-cyan-500/40 transition-colors hover:shadow-lg hover:shadow-cyan-950/25 group print:break-inside-avoid"
                >
                  <div>
                    {/* Top card banner */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-[#090d16] border border-slate-800 group-hover:border-cyan-500/30 transition-colors shrink-0">
                          {getIcon(discipline.id)}
                        </div>
                        <span className="font-display font-bold text-base text-white group-hover:text-cyan-300 transition-colors leading-snug">
                          {discipline.title}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono font-semibold tracking-wider px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 whitespace-nowrap shrink-0">
                        {discipline.status}
                      </span>
                    </div>

                    {/* Description */}
                    {readingMode === 'deep' && (
                      <p className="text-xs sm:text-sm text-slate-300 mt-4 leading-relaxed font-light">
                        {discipline.description}
                      </p>
                    )}

                    {/* Skills tags — magnetic hover pull */}
                    <div className={`${readingMode === 'brief' ? 'mt-4' : 'mt-5'} flex flex-wrap gap-1.5`}>
                      {(readingMode === 'brief'
                        ? discipline.technologies.slice(0, 4)
                        : discipline.technologies
                      ).map((tech, idx) => {
                        const isHighlighted = doesTechTagMatchSkill(tech, selectedSkills);

                        return (
                          <MagneticSkillTag
                            key={idx}
                            label={tech}
                            highlighted={isHighlighted}
                            onToggle={() => onSelectSkill(tech)}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom proficiency meter */}
                  <div className="pt-6 mt-6 border-t border-slate-800/80">
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                        Production Maturity
                      </span>
                      <span className="text-cyan-300 font-semibold">{discipline.level}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${discipline.level}%` }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.9, delay: 0.15, ease: EASE_OUT_EXPO }}
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400"
                      />
                    </div>
                  </div>
                </SpotlightCard>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
        </SoftRise>
      </div>
    </section>
  );
}
