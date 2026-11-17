import { Cpu, Layers, Server, Shield, Terminal, Activity, Sparkles, CheckCircle2, X, ArrowUpRight, Share2, Check } from 'lucide-react';
import { MouseEvent as ReactMouseEvent, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { CERTIFICATIONS, TECHNICAL_DISCIPLINES, WORK_EXPERIENCE } from '../data/portfolioData';
import { doesCertMatchSkill, doesRoleMatchSkill } from '../utils/skillMatcher';
import HeaderSpotlight from './HeaderSpotlight';
import { Reveal, StaggerContainer, StaggerItem, EASE_OUT_EXPO, SpotlightCard } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';

interface SkillsProps {
  selectedSkill: string | null;
  onSelectSkill: (skill: string | null) => void;
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
      className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
        highlighted
          ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm shadow-cyan-500/30'
          : 'bg-[#090d16] border border-slate-800/80 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200'
      }`}
    >
      {label}
    </motion.button>
  );
}

export default function Skills({ selectedSkill, onSelectSkill }: SkillsProps) {
  const [linkCopied, setLinkCopied] = useState(false);

  const copySkillLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    }).catch(() => {});
  };

  const matchingRolesCount = selectedSkill
    ? WORK_EXPERIENCE.reduce(
        (acc, comp) => acc + comp.roles.filter((r) => doesRoleMatchSkill(r, selectedSkill)).length,
        0
      )
    : 0;
  const matchingCertsCount = selectedSkill
    ? CERTIFICATIONS.filter((c) => doesCertMatchSkill(c, selectedSkill)).length
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
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-white tracking-tight">
            Technical Skills &amp; Architecture Disciplines
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl">
            Enterprise expertise across multi-cloud infrastructure, autonomous agentic AI systems, Zero Trust security governance, and high-throughput telemetry pipelines.
          </p>
          {!selectedSkill && (
            <p className="mt-3 text-[11px] sm:text-xs font-mono text-cyan-400/90 tracking-wide print:hidden">
              Tip: click a technology tag to cross-filter Experience &amp; Certifications
            </p>
          )}
          </HeaderSpotlight>

          <AnimatePresence>
            {selectedSkill && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="mt-4 flex flex-wrap items-center gap-2.5 px-3.5 py-2 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-xs font-mono text-cyan-200 w-fit print:hidden"
              >
                <span>
                  Cross-filtering by <strong className="text-cyan-300">{selectedSkill}</strong>
                </span>
                <span className="text-slate-500">·</span>
                <a
                  href="#experience"
                  className="inline-flex items-center gap-1 text-cyan-300 hover:text-white underline underline-offset-2 whitespace-nowrap shrink-0"
                >
                  <span>{matchingRolesCount} matching {matchingRolesCount === 1 ? 'role' : 'roles'}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
                <span className="text-slate-500">·</span>
                <a
                  href="#certifications"
                  className="inline-flex items-center gap-1 text-cyan-300 hover:text-white underline underline-offset-2 whitespace-nowrap shrink-0"
                >
                  <span>{matchingCertsCount} matching {matchingCertsCount === 1 ? 'cert' : 'certs'}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
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
                  onClick={() => onSelectSkill(null)}
                  className="ml-0.5 p-1 rounded hover:bg-cyan-500/20 text-cyan-300 hover:text-white transition-colors"
                  aria-label="Clear selected skill"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </Reveal>

        {/* 6-Card Grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 gap-6">
          {TECHNICAL_DISCIPLINES.map((discipline) => {
            return (
              <StaggerItem key={discipline.id} className="h-full">
                <SpotlightCard
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                  className="h-full rounded-2xl border border-slate-800 bg-[#0d121f]/70 p-6 flex flex-col justify-between hover:border-cyan-500/40 transition-colors hover:shadow-lg hover:shadow-cyan-950/25 group print:break-inside-avoid"
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
                    <p className="text-xs sm:text-sm text-slate-300 mt-4 leading-relaxed font-light">
                      {discipline.description}
                    </p>

                    {/* Skills tags — magnetic hover pull */}
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {discipline.technologies.map((tech, idx) => {
                        const isHighlighted = selectedSkill === tech;

                        return (
                          <MagneticSkillTag
                            key={idx}
                            label={tech}
                            highlighted={isHighlighted}
                            onToggle={() => onSelectSkill(isHighlighted ? null : tech)}
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
      </div>
    </section>
  );
}
