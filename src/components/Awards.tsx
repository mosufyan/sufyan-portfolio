import { useEffect, useState } from 'react';
import { Medal, Star, Trophy, Building2, Search, ChevronDown, ChevronsUpDown, ExternalLink, Linkedin, Quote } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Award, AWARDS_BY_ORGANIZATION, LINKEDIN_RECOMMENDATIONS } from '../data/portfolioData';
import { CollapseTimeline, CollapseTimelineNode } from './CollapseTimeline';
import HeaderSpotlight from './HeaderSpotlight';
import CiscoName from './CiscoName';
import { Reveal, EASE_OUT_EXPO, SpotlightCard } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';

export default function Awards() {
  const [filterOrg, setFilterOrg] = useState<'all' | 'Cisco' | 'HCL' | 'TCS'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recFilter, setRecFilter] = useState<'featured' | 'all' | 'manager' | 'direct_report' | 'peer'>('featured');
  const [recsExpanded, setRecsExpanded] = useState(false);
  const [expandedOrgs, setExpandedOrgs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AWARDS_BY_ORGANIZATION.map((group) => [group.organization, false]))
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredGroups = AWARDS_BY_ORGANIZATION.filter((group) => {
    if (filterOrg === 'all') return true;
    if (filterOrg === 'Cisco') return group.organization.includes('Cisco');
    if (filterOrg === 'HCL') return group.organization.includes('HCL');
    if (filterOrg === 'TCS') return group.organization.includes('Tata');
    return true;
  })
    .map((group) => {
      if (!normalizedQuery) return group;
      const matchingAwards = group.awards.filter(
        (award) =>
          award.title.toLowerCase().includes(normalizedQuery) ||
          award.category.toLowerCase().includes(normalizedQuery) ||
          award.description.toLowerCase().includes(normalizedQuery) ||
          award.organization.toLowerCase().includes(normalizedQuery) ||
          award.date.toLowerCase().includes(normalizedQuery) ||
          (award.associatedWith && award.associatedWith.toLowerCase().includes(normalizedQuery))
      );
      return {
        ...group,
        awards: matchingAwards
      };
    })
    .filter((group) => group.awards.length > 0);

  // Auto-expand organization groups & recommendations that match an active search query
  useEffect(() => {
    if (!normalizedQuery) return;
    setExpandedOrgs((prev) => {
      const next = { ...prev };
      for (const group of AWARDS_BY_ORGANIZATION) {
        const hasMatch = group.awards.some(
          (award) =>
            award.title.toLowerCase().includes(normalizedQuery) ||
            award.category.toLowerCase().includes(normalizedQuery) ||
            award.description.toLowerCase().includes(normalizedQuery) ||
            award.organization.toLowerCase().includes(normalizedQuery) ||
            award.date.toLowerCase().includes(normalizedQuery) ||
            (award.associatedWith && award.associatedWith.toLowerCase().includes(normalizedQuery))
        );
        if (hasMatch) {
          next[group.organization] = true;
        }
      }
      return next;
    });

    const matchesRec = LINKEDIN_RECOMMENDATIONS.some(
      (rec) =>
        rec.author.toLowerCase().includes(normalizedQuery) ||
        rec.role.toLowerCase().includes(normalizedQuery) ||
        rec.quote.toLowerCase().includes(normalizedQuery)
    );
    if (matchesRec) {
      setRecsExpanded(true);
      setRecFilter('all');
    }
  }, [normalizedQuery]);

  const toggleExpandOrg = (orgName: string) => {
    setExpandedOrgs((prev) => ({
      ...prev,
      [orgName]: !prev[orgName]
    }));
  };

  const allExpanded =
    filteredGroups.length > 0 &&
    filteredGroups.every((group) => Boolean(expandedOrgs[group.organization]));

  const toggleExpandAll = () => {
    const targetState = !allExpanded;
    setExpandedOrgs((prev) => {
      const next = { ...prev };
      for (const group of filteredGroups) {
        next[group.organization] = targetState;
      }
      return next;
    });
  };

  const totalAwardsCount = AWARDS_BY_ORGANIZATION.reduce((acc, curr) => acc + curr.awards.length, 0);

  const renderAwardsGrid = (awards: Award[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-3 gap-5">
      {awards.map((award, aIdx) => (
        <SpotlightCard
          key={award.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4 }}
          transition={{
            opacity: { duration: 0.3, delay: Math.min(aIdx * 0.025, 0.2), ease: EASE_OUT_EXPO },
            y: { duration: 0.3, delay: Math.min(aIdx * 0.025, 0.2), ease: EASE_OUT_EXPO },
          }}
          className="rounded-2xl border border-slate-800 bg-[#090d16]/90 p-5 flex flex-col justify-between hover:border-cyan-500/40 transition-colors hover:shadow-xl hover:shadow-cyan-950/25 group print:break-inside-avoid"
        >
          <div>
            {/* Top Bar with date and star */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <span className="text-[11px] font-mono font-semibold text-cyan-400 tracking-wider">
                {award.date}
              </span>
              <span className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 group-hover:rotate-12 transition-transform duration-300">
                <Star className="w-3.5 h-3.5 fill-amber-400/40" />
              </span>
            </div>

            {/* Title */}
            <h4 className="text-base font-display font-bold text-white mt-3 group-hover:text-cyan-300 transition-colors leading-snug">
              {award.title}
            </h4>

            {/* Category tag */}
            <div className="mt-1.5 text-xs font-mono text-cyan-400/90 truncate">
              {award.category}
            </div>

            {/* Description */}
            <p className="text-xs text-slate-300 mt-2.5 leading-relaxed font-light">
              {award.description}
            </p>
          </div>

          {/* Bottom Indicator */}
          <div className="pt-3 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-400 truncate">
              <Medal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{award.associatedWith ? `Associated with ${award.associatedWith}` : 'Official Citation'}</span>
            </span>
            <span className="text-emerald-400 shrink-0 ml-2">Awarded</span>
          </div>
        </SpotlightCard>
      ))}
    </div>
  );

  return (
    <section id="honors" className="relative py-16 lg:py-24 border-b border-slate-800/80 bg-[#06080d]">
      <SectionScanLine />
      <div className="page-shell">
        {/* Section Header */}
        <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <HeaderSpotlight className="min-w-0">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
              <Trophy className="w-3.5 h-3.5" />
              <span>OFFICIAL RECOGNITIONS &amp; HONORS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-white tracking-tight">
              Official Recognitions &amp; Honors
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl">
              Peer endorsements, corporate excellence citations, and leadership awards across <CiscoName />, HCL America Inc./HCLTech, and Tata Consultancy Services.
            </p>
          </div>
          </HeaderSpotlight>

          {/* Search Box (targeted slot) */}
          <div className="relative w-full md:w-72 shrink-0 print:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recognition or honor..."
              aria-label="Search recognitions and honors"
              className="w-full pl-9 pr-14 py-2 rounded-xl bg-[#0d121f] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear recognition search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </Reveal>

        {/* Featured recognition story */}
        <Reveal className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
            className="featured-story-card rounded-2xl border border-cyan-500/35 bg-gradient-to-br from-cyan-950/40 via-[#0d121f]/90 to-[#0a0e1a] p-5 sm:p-6"
          >
            <div className="featured-story-eyebrow text-[10px] font-mono uppercase tracking-wider text-cyan-400 mb-2">
              Featured story · Oct 2026
            </div>
            <h3 className="featured-story-title text-lg sm:text-xl font-display font-bold text-white tracking-tight">
              Cisco Systems Inc. STO Data Platform Launch
            </h3>
            <p className="featured-story-body mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">
              Awarded Cisco Play to Win Connected Recognition for shipping the security data platform at the
              core of Project Atlas — unifying shared services and governed data so STO teams can build,
              automate, and innovate with confidence.
            </p>
          </motion.div>
        </Reveal>

        {/* Org Filter Pills + Expand/Collapse All */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-10 print:hidden">
          <div className="scroll-chips p-1.5 rounded-xl bg-[#0d121f]/70 border border-slate-800 w-full sm:w-fit sm:flex-wrap">
            {(
              [
                { id: 'all', short: `All (${totalAwardsCount})`, label: `All Citations (${totalAwardsCount})` },
                { id: 'Cisco', short: 'Cisco', label: 'Cisco Systems Inc.' },
                { id: 'HCL', short: 'HCL', label: 'HCL America Inc./HCLTech' },
                { id: 'TCS', short: 'TCS', label: 'Tata Consultancy Services' },
              ] as const
            ).map((tab) => {
              const isActive = filterOrg === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterOrg(tab.id)}
                  className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="awards-filter-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-cyan-500 shadow-sm"
                    />
                  )}
                  <span className="relative z-10 sm:hidden">{tab.short}</span>
                  <span className="relative z-10 hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {filteredGroups.length > 0 && (
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

        {/* Corporate Collapsible Grouped Lists + LinkedIn recommendations timeline */}
        <CollapseTimeline gapClassName="space-y-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={filterOrg}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            className="space-y-6"
          >
            {filteredGroups.map((group) => {
              const isExpanded = expandedOrgs[group.organization] ?? false;

              return (
                <CollapseTimelineNode key={group.organization} pulse={isExpanded}>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                  className="rounded-2xl border border-slate-800 hover:border-slate-700/80 bg-[#0d121f]/70 overflow-hidden shadow-xl transition-colors"
                >
                  {/* Collapsible Organization Header */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpandOrg(group.organization)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpandOrg(group.organization);
                      }
                    }}
                    className={`pdf-keep-next print:break-inside-avoid flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 bg-[#0a0e1a] ${
                      isExpanded ? 'border-b border-slate-800/80' : ''
                    } cursor-pointer hover:bg-[#0c1120] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 transition-colors gap-3`}
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">
                            {group.organization.includes('Cisco') ? <CiscoName /> : group.organization}
                          </h3>
                          <span className="text-xs font-mono text-cyan-400 px-2.5 py-0.5 rounded bg-cyan-950/30 border border-cyan-500/30 shrink-0">
                            {group.awards.length} {group.awards.length === 1 ? 'Honor Conferred' : 'Honors Conferred'}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-1">
                          {group.tagline}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-400 font-mono print:hidden shrink-0">
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

                  {/* Expanded Awards Grid */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                        className="overflow-hidden print:!block print:!h-auto print:!opacity-100"
                      >
                        <div className="p-5 sm:p-6">
                          {renderAwardsGrid(group.awards)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Print-only expanded fallback when collapsed on screen */}
                  {!isExpanded && (
                    <div className="hidden print:block p-5 sm:p-6">
                      {renderAwardsGrid(group.awards)}
                    </div>
                  )}
                </motion.div>
                </CollapseTimelineNode>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {filteredGroups.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            No recognitions or honors found matching &ldquo;{searchQuery}&rdquo;.
          </div>
        )}

        {/* LinkedIn Peer Recommendations & Endorsements (All 23 Verified) */}
        <CollapseTimelineNode className="mt-10" pulse={recsExpanded}>
        <div
          id="linkedin-recommendations"
          className="rounded-2xl border border-slate-800 bg-[#0d121f]/70 overflow-hidden shadow-xl"
        >
          {/* Collapsible Recommendations Header */}
          <div
            role="button"
            tabIndex={0}
            aria-expanded={recsExpanded}
            onClick={() => setRecsExpanded((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setRecsExpanded((prev) => !prev);
              }
            }}
            className={`pdf-keep-next print:break-inside-avoid flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 bg-[#0a0e1a] ${
              recsExpanded ? 'border-b border-slate-800/80' : ''
            } cursor-pointer hover:bg-[#0c1120] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 transition-colors`}
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-400">
                <Linkedin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">
                    Verified LinkedIn Recommendations
                  </h3>
                  <span className="text-xs font-mono text-cyan-400 px-2.5 py-0.5 rounded bg-cyan-950/30 border border-cyan-500/30 shrink-0">
                    {LINKEDIN_RECOMMENDATIONS.length} Endorsements
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1">
                  DIRECT MANAGERS · CISCO, RUBRIK &amp; APPLE PEERS · DIRECT REPORTS
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-end md:self-auto shrink-0">
              <a
                href="https://www.linkedin.com/in/mohammed-sufyan/details/recommendations/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/35 hover:border-cyan-400 text-xs font-mono text-cyan-300 transition-colors print:hidden"
              >
                <span>Verify on LinkedIn</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono print:hidden">
                <span className="hidden sm:inline">
                  {recsExpanded ? 'Collapse' : 'Expand'}
                </span>
                <motion.span
                  animate={{ rotate: recsExpanded ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                  className="inline-flex"
                >
                  <ChevronDown className={`w-4 h-4 ${recsExpanded ? 'text-cyan-400' : 'text-slate-400'}`} />
                </motion.span>
              </div>
            </div>
          </div>

          {/* Expanded Recommendations Grid */}
          <AnimatePresence initial={false}>
            {recsExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                className="overflow-hidden print:!block print:!h-auto print:!opacity-100"
              >
                <div className="p-5 sm:p-6 space-y-5">
                  {/* Relationship Filter Tabs */}
                  <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#090d16] border border-slate-800">
                      {(
                        [
                          { id: 'featured', label: `Featured (${LINKEDIN_RECOMMENDATIONS.filter((r) => r.featured).length})` },
                          { id: 'all', label: `All (${LINKEDIN_RECOMMENDATIONS.length})` },
                          { id: 'manager', label: `Managers (${LINKEDIN_RECOMMENDATIONS.filter((r) => r.relationshipType === 'manager').length})` },
                          { id: 'direct_report', label: `Direct Reports (${LINKEDIN_RECOMMENDATIONS.filter((r) => r.relationshipType === 'direct_report').length})` },
                          { id: 'peer', label: `Peers & Leads (${LINKEDIN_RECOMMENDATIONS.filter((r) => r.relationshipType === 'peer').length})` },
                        ] as const
                      ).map((tab) => {
                        const active = recFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setRecFilter(tab.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              active
                                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(() => {
                    const matchingRecs = LINKEDIN_RECOMMENDATIONS.filter((rec) => {
                      const matchesFilter =
                        recFilter === 'all'
                          ? true
                          : recFilter === 'featured'
                            ? Boolean(rec.featured)
                            : rec.relationshipType === recFilter;
                      const matchesSearch =
                        !normalizedQuery ||
                        rec.author.toLowerCase().includes(normalizedQuery) ||
                        rec.role.toLowerCase().includes(normalizedQuery) ||
                        rec.quote.toLowerCase().includes(normalizedQuery);
                      return matchesFilter && matchesSearch;
                    });

                    if (matchingRecs.length === 0) {
                      return (
                        <div className="py-8 text-center text-xs font-mono text-slate-400">
                          No recommendations matching current filter.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {matchingRecs.map((rec, idx) => (
                          <SpotlightCard
                            key={rec.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              opacity: { duration: 0.28, delay: Math.min(idx * 0.025, 0.2), ease: EASE_OUT_EXPO },
                              y: { duration: 0.28, delay: Math.min(idx * 0.025, 0.2), ease: EASE_OUT_EXPO },
                            }}
                            className="rounded-2xl border border-slate-800 bg-[#090d16]/95 p-5 flex flex-col justify-between hover:border-cyan-500/40 transition-colors print:break-inside-avoid"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                                <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                                  {rec.date}
                                </span>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                                  {rec.relationshipType === 'manager'
                                    ? 'Direct Manager'
                                    : rec.relationshipType === 'direct_report'
                                      ? 'Direct Report'
                                      : 'Peer / Lead'}
                                </span>
                              </div>

                              <div className="mt-3 flex items-start gap-2">
                                <Quote className="w-4 h-4 text-cyan-500/50 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-300 leading-relaxed font-light">
                                  &ldquo;{rec.quote}&rdquo;
                                </p>
                              </div>
                            </div>

                            <div className="pt-3.5 mt-4 border-t border-slate-800/80">
                              <div className="text-sm font-display font-bold text-white">
                                {rec.author}
                              </div>
                              <div className="text-[11px] font-mono text-cyan-400/90 mt-0.5 line-clamp-2">
                                {rec.role}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 mt-1">
                                {rec.relationship}
                              </div>
                            </div>
                          </SpotlightCard>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Print-only featured endorsements fallback when collapsed on screen */}
          {!recsExpanded && (
            <div className="hidden print:block p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {LINKEDIN_RECOMMENDATIONS.filter((r) => r.featured).map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-slate-800 bg-[#090d16]/95 p-4 flex flex-col justify-between print:break-inside-avoid"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono pb-2 border-b border-slate-800/80">
                        <span className="text-cyan-400 font-semibold">{rec.date}</span>
                        <span className="text-emerald-400">{rec.relationship}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed mt-2.5 font-light">
                        &ldquo;{rec.quote}&rdquo;
                      </p>
                    </div>
                    <div className="pt-2.5 mt-3 border-t border-slate-800/80">
                      <div className="text-xs font-display font-bold text-white">{rec.author}</div>
                      <div className="text-[10px] font-mono text-cyan-400/90 mt-0.5">{rec.role}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs font-mono text-cyan-300">
                Full 23 Verified Recommendations: linkedin.com/in/mohammed-sufyan/details/recommendations
              </div>
            </div>
          )}
        </div>
        </CollapseTimelineNode>
        </CollapseTimeline>
      </div>
    </section>
  );
}
