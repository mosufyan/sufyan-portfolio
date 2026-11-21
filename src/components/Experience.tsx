import { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Globe,
  MapPin,
  Award,
  Share2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { SKILL_FILTER_PRESETS, WORK_EXPERIENCE } from '../data/portfolioData';
import { doesRoleMatchSkill, doesTechTagMatchSkill, formatSkillFilterSummary } from '../utils/skillMatcher';
import { CollapseTimeline, CollapseTimelineNode } from './CollapseTimeline';
import HeaderSpotlight from './HeaderSpotlight';
import CiscoName from './CiscoName';
import { Reveal, EASE_OUT_EXPO } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';
import type { PortfolioReadingMode } from './UnifiedScrollHud';

interface ExperienceProps {
  selectedSkills: string[];
  onSelectSkill: (skill: string | null) => void;
  onApplySkills: (skills: string[]) => void;
  focusedCompany?: { name: string; seq: number } | null;
  readingMode?: PortfolioReadingMode;
}

const GLOBAL_FOOTPRINT = [
  {
    company: 'Tata Consultancy Services',
    shortName: 'TCS (India & UK)',
    filterKey: 'tcs' as const,
    period: '2013 — 2019',
    durationLabel: '6.3 Yrs · 5 Roles',
    spanWeight: 46,
    focusDomain: 'Enterprise Automation & Web Engineering',
    regions: 'Bengaluru, India · Greater London, UK',
    summary: '5 Enterprise Delivery Roles · Client Operations & Consulting',
  },
  {
    company: 'HCL America Inc./HCLTech',
    shortName: 'HCL America (Actian & Cisco)',
    filterKey: 'hcl' as const,
    period: '2019 — 2026',
    durationLabel: '6.5 Yrs · 4 Roles',
    spanWeight: 47,
    focusDomain: 'Multi-Cloud Security & DevSecOps Architecture',
    regions: 'Bengaluru, India · San Francisco Bay Area, US',
    summary: '4 Technical Leadership Roles · Cisco Systems Inc. Cloud Security Account',
  },
  {
    company: 'Cisco Systems Inc.',
    shortName: 'Cisco STO',
    filterKey: 'cisco' as const,
    period: '2026 — Present',
    durationLabel: 'Current',
    spanWeight: 7,
    focusDomain: 'STO CTO Ops · Security & AI Data Platforms',
    regions: 'San Jose, California, US · Hybrid',
    summary: 'Software Engineer · STO CTO Operations · Project Atlas',
  },
];

const JOURNEY_MILESTONES = [
  {
    step: '01',
    years: '2013–16',
    hub: 'Bengaluru, IN',
    org: 'TCS · Systems Engineering',
    company: 'Tata Consultancy Services',
    filterKey: 'tcs' as const,
  },
  {
    step: '02',
    years: '2016–19',
    hub: 'London, UK',
    org: 'TCS · Enterprise Consulting',
    company: 'Tata Consultancy Services',
    filterKey: 'tcs' as const,
  },
  {
    step: '03',
    years: '2019–26',
    hub: 'Bay Area & India',
    org: 'HCL America · Cloud Security',
    company: 'HCL America Inc./HCLTech',
    filterKey: 'hcl' as const,
  },
  {
    step: '04',
    years: '2026–Now',
    hub: 'San Jose, US',
    org: 'Cisco Systems · STO CTO Ops',
    company: 'Cisco Systems Inc.',
    filterKey: 'cisco' as const,
  },
] as const;

export default function Experience({
  selectedSkills,
  onSelectSkill,
  onApplySkills,
  focusedCompany,
  readingMode = 'deep',
}: ExperienceProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 78%', 'end 58%'],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 150,
    damping: 26,
    restDelta: 0.001,
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'cisco' | 'hcl' | 'tcs'>('all');
  const [linkCopied, setLinkCopied] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({
    'Cisco Systems Inc.': false,
    'HCL America Inc./HCLTech': false,
    'Tata Consultancy Services': false,
  });
  const skillFilter = formatSkillFilterSummary(selectedSkills);
  const hasSkillFilter = skillFilter.count > 0;

  useEffect(() => {
    if (!hasSkillFilter) return;
    setActiveFilter('all');
    setExpandedCompanies((prev) => {
      const next = { ...prev };
      for (const comp of WORK_EXPERIENCE) {
        if (comp.roles.some((r) => doesRoleMatchSkill(r, selectedSkills))) {
          next[comp.company] = true;
        }
      }
      return next;
    });
  }, [hasSkillFilter, selectedSkills]);

  // In 30-second recruiter brief mode, auto-open the two most recent companies for instant impact scan
  useEffect(() => {
    if (readingMode !== 'brief' || hasSkillFilter) return;
    setExpandedCompanies((prev) => ({
      ...prev,
      'Cisco Systems Inc.': true,
      'HCL America Inc./HCLTech': true,
    }));
  }, [readingMode, hasSkillFilter]);

  useEffect(() => {
    if (!focusedCompany) return;
    setActiveFilter('all');
    setExpandedCompanies((prev) => ({
      ...prev,
      [focusedCompany.name]: true,
    }));
  }, [focusedCompany]);

  const copySkillLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    }).catch(() => {});
  };

  const handleFootprintSelect = (companyName: string, filterKey: 'cisco' | 'hcl' | 'tcs') => {
    setActiveFilter(filterKey);
    setExpandedCompanies((prev) => ({
      ...prev,
      [companyName]: true,
    }));
  };

  const toggleExpand = (companyName: string) => {
    setExpandedCompanies((prev) => ({
      ...prev,
      [companyName]: !prev[companyName],
    }));
  };

  const filteredExperience = WORK_EXPERIENCE.filter((comp) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'cisco') return comp.company.includes('Cisco');
    if (activeFilter === 'hcl') return comp.company.includes('HCL');
    if (activeFilter === 'tcs') return comp.company.includes('Tata') || comp.company.includes('TCS');
    return true;
  })
    .map((comp) => {
      if (!hasSkillFilter) return comp;
      return {
        ...comp,
        roles: comp.roles.filter((role) => doesRoleMatchSkill(role, selectedSkills)),
      };
    })
    .filter((comp) => comp.roles.length > 0);

  const allExpanded =
    filteredExperience.length > 0 &&
    filteredExperience.every((comp) => Boolean(expandedCompanies[comp.company]));

  const toggleExpandAll = () => {
    const targetState = !allExpanded;
    setExpandedCompanies((prev) => {
      const next = { ...prev };
      for (const comp of filteredExperience) {
        next[comp.company] = targetState;
      }
      return next;
    });
  };

  const totalMatchingRoles = filteredExperience.reduce((acc, comp) => acc + comp.roles.length, 0);

  return (
    <section
      ref={sectionRef}
      id="experience"
      className="relative py-16 lg:py-24 border-b border-slate-800/80 bg-[#07090e]"
    >
      <SectionScanLine />
      <div className="page-shell">
        {/* Section Header */}
        <Reveal className="flex flex-col gap-6 mb-10">
          <HeaderSpotlight>
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
                <Briefcase className="w-3.5 h-3.5" />
                <span>PROFESSIONAL TIMELINE</span>
              </div>
              <h2 className="fluid-title font-display font-bold text-white tracking-tight">
                Professional Experience &amp; Leadership
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl">
                Comprehensive timeline spanning enterprise systems engineering, cloud architecture, SRE, and consulting engagements across <CiscoName />, HCL America Inc./HCLTech, and Tata Consultancy Services — spanning the US, UK, and India.
              </p>
            </div>
          </HeaderSpotlight>

          {/* Global Career & Delivery Footprint Strip + Scroll-Linked Journey Track */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0a0f1c]/90 p-4 sm:p-6 print:break-inside-avoid">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-5 border-b border-slate-800/80">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-400">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span>Career Trajectory Matrix (2013 → 2026) · US · UK · India</span>
              </div>
              <div className="flex items-center gap-3">
                {activeFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
                  >
                    Show All 3 Eras
                  </button>
                )}
                <span className="text-[11px] font-mono text-slate-400">
                  Scroll-linked · Select any stop to filter
                </span>
              </div>
            </div>

            {/* Animated Scroll-Linked 4-Stop Career Journey Track */}
            <div className="mb-6 print:hidden">
              <div className="relative mb-3">
                <div className="h-1.5 w-full rounded-full bg-[#060911] border border-slate-800 overflow-hidden">
                  <motion.div
                    aria-hidden="true"
                    style={
                      shouldReduceMotion
                        ? { scaleX: 1, transformOrigin: '0% 50%' }
                        : { scaleX: smoothProgress, transformOrigin: '0% 50%' }
                    }
                    className="h-full w-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {JOURNEY_MILESTONES.map((stop) => {
                  const isActiveStop = activeFilter === stop.filterKey;
                  return (
                    <button
                      key={`${stop.step}-${stop.hub}`}
                      type="button"
                      onClick={() => handleFootprintSelect(stop.company, stop.filterKey)}
                      aria-pressed={isActiveStop}
                      className={`text-left rounded-xl border px-3 py-2.5 transition-colors cursor-pointer ${
                        isActiveStop
                          ? 'border-cyan-500/60 bg-cyan-950/35'
                          : 'border-slate-800/80 bg-[#070b14]/75 hover:border-cyan-500/35'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                        <span className="text-cyan-400 font-semibold tabular-nums">
                          {stop.step} · {stop.years}
                        </span>
                        <span className="text-slate-400 truncate">{stop.hub}</span>
                      </div>
                      <div className="mt-1 text-xs font-display font-semibold text-white truncate">
                        {stop.org}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Proportional 13+ Year Era Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-3">
              {GLOBAL_FOOTPRINT.map((stage, idx) => {
                const isSelected = activeFilter === stage.filterKey;
                return (
                  <button
                    key={stage.company}
                    type="button"
                    onClick={() => handleFootprintSelect(stage.company, stage.filterKey)}
                    className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500/60 bg-cyan-950/35 shadow-md shadow-cyan-950/30'
                        : 'border-slate-800/90 bg-[#0d1322]/70 hover:border-cyan-500/35 hover:bg-[#0e1526]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-cyan-400">
                      <span>0{idx + 1}. {stage.period}</span>
                      <span className="text-slate-400">{stage.durationLabel}</span>
                    </div>
                    <div className="mt-1 font-display font-bold text-sm sm:text-base text-white">
                      {stage.company.includes('Cisco') ? <CiscoName /> : stage.company}
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-cyan-300/90">
                      {stage.focusDomain}
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-slate-300">
                      {stage.regions}
                    </div>
                    {readingMode === 'deep' && (
                      <div className="mt-1 text-[11px] text-slate-400 leading-snug">
                        {stage.summary}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Filter Pills + Expand/Collapse All */}
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="scroll-chips p-1 rounded-xl bg-[#0d121f] border border-slate-800 w-full sm:w-fit sm:flex-wrap">
              {(
                [
                  { id: 'all', label: 'All Roles', labelSm: 'All Roles (Current & Prior)' },
                  { id: 'cisco', label: 'Cisco', labelSm: 'Cisco Systems Inc. (Current)' },
                  { id: 'hcl', label: 'HCL', labelSm: 'HCL America Inc./HCLTech' },
                  { id: 'tcs', label: 'TCS', labelSm: 'Tata Consultancy Services' },
                ] as const
              ).map((tab) => {
                const isActive = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="experience-filter-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-cyan-500 shadow-sm"
                      />
                    )}
                    <span className="relative z-10 sm:hidden">{tab.label}</span>
                    <span className="relative z-10 hidden sm:inline">{tab.labelSm}</span>
                  </button>
                );
              })}
            </div>

            {filteredExperience.length > 0 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-800 bg-[#0d121f] hover:border-cyan-500/40 hover:text-cyan-300 text-xs font-mono text-slate-300 transition-colors whitespace-nowrap shrink-0"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 print:hidden">
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

          <AnimatePresence>
            {hasSkillFilter && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="skill-filter-banner sticky top-16 z-20 flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-cyan-950/90 border border-cyan-500/40 text-xs font-mono text-cyan-200 w-full sm:w-fit shadow-lg shadow-cyan-950/20 backdrop-blur-md print:hidden"
              >
                <span className="min-w-0">
                  {skillFilter.label}:{' '}
                  <strong className="text-cyan-300 break-words">{skillFilter.names}</strong>
                  {' '}({totalMatchingRoles} {totalMatchingRoles === 1 ? 'role' : 'roles'})
                </span>
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
                  aria-label={skillFilter.count > 1 ? 'Clear all skill filters' : `Clear skill filter for ${skillFilter.names}`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{skillFilter.count > 1 ? 'Clear filters' : 'Clear filter'}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </Reveal>

        {/* Timeline Stack */}
        <CollapseTimeline gapClassName="space-y-8">
          {filteredExperience.map((comp) => {
            const isExpanded = expandedCompanies[comp.company] ?? false;

            return (
              <CollapseTimelineNode key={comp.company} pulse={isExpanded}>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                  className="rounded-2xl border border-slate-800 hover:border-slate-700/80 bg-[#0d121f]/70 overflow-hidden shadow-xl transition-colors"
                >
                  {/* Company Header Banner */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpand(comp.company)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpand(comp.company);
                      }
                    }}
                    className="pdf-keep-next print:break-inside-avoid flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 bg-[#0a0e1a] border-b border-slate-800/80 cursor-pointer hover:bg-[#0c1120] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 transition-colors gap-3"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-700/80 text-cyan-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                            {comp.company.includes('Cisco') ? <CiscoName /> : comp.company}
                          </h3>
                          <span className="text-[11px] font-mono font-semibold tracking-wider text-cyan-400">
                            · {comp.companyTag}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{comp.location}</span>
                          </span>
                          <span className="hidden sm:inline">·</span>
                          <span className="flex items-center gap-1 text-slate-300">
                            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>{comp.tenure}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-400 font-mono print:hidden">
                      <span className="hidden sm:inline">
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </span>
                      <motion.span
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                        className="inline-flex"
                      >
                        <ChevronDown className={`w-4 h-4 ${isExpanded ? 'text-cyan-400' : 'text-slate-400'}`} />
                      </motion.span>
                    </div>
                  </div>

                  {/* Sub-Roles Content — clean horizontal divide-y hairlines (no left accent stripe) */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
                        className="overflow-hidden print:!block print:!h-auto print:!opacity-100"
                      >
                        <div className="p-5 sm:p-7 space-y-8 divide-y divide-slate-800/80">
                          {comp.roles.map((role, rIdx) => {
                            const visibleHighlights =
                              readingMode === 'brief' ? role.highlights.slice(0, 2) : role.highlights;
                            const visibleTechs =
                              readingMode === 'brief' ? role.technologies.slice(0, 5) : role.technologies;

                            return (
                              <motion.div
                                key={rIdx}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.28, delay: rIdx * 0.04, ease: EASE_OUT_EXPO }}
                                className={`${rIdx > 0 ? 'pt-8' : ''} print:break-inside-avoid`}
                              >
                                {/* Role Title and Meta */}
                                <div className="mb-2 space-y-1.5">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <h4 className="min-w-0 text-base sm:text-lg font-display font-semibold text-white text-balance">
                                      {role.role}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-400 sm:justify-end sm:max-w-[min(100%,22rem)]">
                                      <span className="text-slate-300 whitespace-nowrap">
                                        {role.period}
                                      </span>
                                      <span className="text-slate-600">·</span>
                                      <span className="min-w-0 leading-snug">{role.location}</span>
                                    </div>
                                  </div>
                                  {role.domain && (
                                    <div className="text-xs font-mono text-cyan-400/90 leading-relaxed max-w-prose sm:max-w-none">
                                      {role.domain}
                                    </div>
                                  )}
                                  {role.proofMetric && (
                                    <div className="pt-1 text-[11px] font-mono text-cyan-300 leading-snug">
                                      <span className="uppercase tracking-wider text-cyan-400/80">Proof · </span>
                                      {role.proofMetric}
                                    </div>
                                  )}
                                </div>

                                {/* Bullet Highlights */}
                                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300 pl-1 my-4">
                                  {visibleHighlights.map((bullet, bIdx) => (
                                    <li key={bIdx} className="flex items-start gap-2.5 leading-relaxed">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0"></span>
                                      <span>{bullet}</span>
                                    </li>
                                  ))}
                                </ul>

                                {readingMode === 'brief' && role.highlights.length > 2 && (
                                  <div className="text-[11px] font-mono text-slate-400 mb-3 print:hidden">
                                    30s Brief · Top 2 of {role.highlights.length} impact highlights shown
                                  </div>
                                )}

                                {/* In-role recognition citation */}
                                {role.recognitionBadge && (
                                  <div className="my-3 inline-flex items-start sm:items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-xs font-mono text-cyan-300 max-w-full">
                                    <Award className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
                                    <span>Honor: {role.recognitionBadge}</span>
                                  </div>
                                )}

                                {/* Tech tags (clickable interactive filter controls) */}
                                {visibleTechs.length > 0 && (
                                  <div className="pt-2 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mr-1">
                                      Stack:
                                    </span>
                                    {visibleTechs.map((tech, tIdx) => {
                                      const isMatch = doesTechTagMatchSkill(tech, selectedSkills);
                                      return (
                                        <motion.button
                                          key={tIdx}
                                          type="button"
                                          initial={{ opacity: 0, y: 4 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{
                                            duration: 0.22,
                                            delay: 0.08 + tIdx * 0.02,
                                            ease: EASE_OUT_EXPO,
                                          }}
                                          onClick={() => onSelectSkill(tech)}
                                          title={
                                            isMatch
                                              ? `Remove ${tech} from skill filters`
                                              : `Add ${tech} to skill filters`
                                          }
                                          aria-pressed={isMatch}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                                            isMatch
                                              ? 'skill-chip-active bg-cyan-500 border border-cyan-500 text-slate-950 font-semibold'
                                              : 'bg-[#090d16] border border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200'
                                          }`}
                                        >
                                          {tech}
                                          {isMatch && <X className="w-3 h-3 shrink-0 opacity-80" aria-hidden="true" />}
                                        </motion.button>
                                      );
                                    })}
                                    {readingMode === 'brief' && role.technologies.length > visibleTechs.length && (
                                      <span className="text-[10px] font-mono text-slate-500 pl-1">
                                        +{role.technologies.length - visibleTechs.length} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Print-only expanded fallback when collapsed on screen */}
                  {!isExpanded && (
                    <div className="hidden print:block p-5 sm:p-6 space-y-6 divide-y divide-slate-800/80">
                      {comp.roles.map((role, rIdx) => (
                        <div key={rIdx} className={`${rIdx > 0 ? 'pt-6' : ''} print:break-inside-avoid`}>
                          <div className="mb-2 space-y-1.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <h4 className="min-w-0 text-base font-display font-semibold text-white">
                                {role.role}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-400">
                                <span className="text-slate-300 whitespace-nowrap">{role.period}</span>
                                <span className="text-slate-500">·</span>
                                <span>{role.location}</span>
                              </div>
                            </div>
                            {role.domain && (
                              <div className="text-xs font-mono text-cyan-400/90 leading-relaxed">
                                {role.domain}
                              </div>
                            )}
                          </div>

                          <ul className="space-y-2 text-xs text-slate-300 pl-1 my-3">
                            {role.highlights.map((bullet, bIdx) => (
                              <li key={bIdx} className="flex items-start gap-2 leading-relaxed">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0"></span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>

                          {role.recognitionBadge && (
                            <div className="my-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-xs font-mono text-cyan-300">
                              <Award className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span>Honor: {role.recognitionBadge}</span>
                            </div>
                          )}

                          {role.technologies.length > 0 && (
                            <div className="pt-2 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mr-1">
                                Stack:
                              </span>
                              {role.technologies.map((tech, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#090d16] border border-slate-800 text-slate-300"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </CollapseTimelineNode>
            );
          })}

          {filteredExperience.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0d121f]/60 p-8 text-center space-y-3">
              <p className="text-sm text-slate-400">
                No roles found in this company filter matching{' '}
                <strong className="text-cyan-300">{skillFilter.names || 'selected skills'}</strong>.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {activeFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors"
                  >
                    Show All Companies
                  </button>
                )}
                {hasSkillFilter && (
                  <button
                    type="button"
                    onClick={() => onSelectSkill(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    {skillFilter.count > 1 ? 'Clear Skill Filters' : 'Clear Skill Filter'}
                  </button>
                )}
              </div>
            </div>
          )}
        </CollapseTimeline>
      </div>
    </section>
  );
}
