import { useEffect, useState } from 'react';
import { Award, Check, CheckCircle, ChevronDown, ChevronsUpDown, ExternalLink, LayoutGrid, Radar, Search, Share2, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { CERTIFICATION_CATEGORIES, CERTIFICATIONS, Certification } from '../data/portfolioData';
import { doesCertMatchSkill, doesTechTagMatchSkill, formatSkillFilterSummary } from '../utils/skillMatcher';
import { useTheme } from '../theme/ThemeProvider';
import CloudConstellation from './CloudConstellation';
import { CollapseTimeline, CollapseTimelineNode } from './CollapseTimeline';
import HeaderSpotlight from './HeaderSpotlight';
import IssuerMark from './IssuerMark';
import { Reveal, EASE_OUT_EXPO, SpotlightCard } from './MotionPrimitives';
import SectionScanLine from './SectionScanLine';
import type { PortfolioReadingMode } from './UnifiedScrollHud';

interface CertificationsProps {
  selectedSkills: string[];
  onSelectSkill: (skill: string | null) => void;
  onSelectCertification: (cert: Certification) => void;
  readingMode?: PortfolioReadingMode;
}

const FEATURED_CERT_IDS = [
  'cert-aws-devops-pro',
  'cert-ms-devops-expert',
  'cert-db-ai-agent',
] as const;

export default function Certifications({
  selectedSkills,
  onSelectSkill,
  onSelectCertification,
  readingMode = 'deep',
}: CertificationsProps) {
  const { theme, isLight, accent } = useTheme();
  const isAmber = accent === 'amber';
  const [activeTab, setActiveTab] = useState<'all' | 'ai' | 'cloud' | 'data'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'radar'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showAllInBrief, setShowAllInBrief] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CERTIFICATION_CATEGORIES.map((cat) => [cat.id, false]))
  );
  const skillFilter = formatSkillFilterSummary(selectedSkills);
  const hasSkillFilter = skillFilter.count > 0;

  useEffect(() => {
    if (readingMode === 'brief') {
      setShowAllInBrief(false);
    }
  }, [readingMode]);

  const copySkillLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    }).catch(() => {});
  };

  useEffect(() => {
    if (hasSkillFilter) {
      setActiveTab('all');
    }
  }, [hasSkillFilter, selectedSkills]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredCategories = CERTIFICATION_CATEGORIES.map((category) => {
    const matchingCerts = category.certs.filter((cert) => {
      const matchesSearch =
        normalizedSearch === '' ||
        cert.title.toLowerCase().includes(normalizedSearch) ||
        cert.issuer.toLowerCase().includes(normalizedSearch) ||
        cert.skills.some((s) => s.toLowerCase().includes(normalizedSearch));

      const matchesSkill = doesCertMatchSkill(cert, selectedSkills);
      const matchesTab = activeTab === 'all' || activeTab === category.id;
      return matchesSearch && matchesSkill && matchesTab;
    });

    return {
      ...category,
      certs: matchingCerts
    };
  }).filter((category) => category.certs.length > 0);

  // Auto-expand categories that match an active search query or cross-filter skill
  useEffect(() => {
    if (!hasSkillFilter && !normalizedSearch) return;
    setExpandedCategories((prev) => {
      const next = { ...prev };
      for (const cat of CERTIFICATION_CATEGORIES) {
        const hasMatch = cat.certs.some((cert) => {
          const matchesSearch =
            normalizedSearch === '' ||
            cert.title.toLowerCase().includes(normalizedSearch) ||
            cert.issuer.toLowerCase().includes(normalizedSearch) ||
            cert.skills.some((s) => s.toLowerCase().includes(normalizedSearch));
          return matchesSearch && doesCertMatchSkill(cert, selectedSkills);
        });
        if (hasMatch) {
          next[cat.id] = true;
        }
      }
      return next;
    });
  }, [hasSkillFilter, selectedSkills, normalizedSearch]);
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const allExpanded =
    filteredCategories.length > 0 &&
    filteredCategories.every((cat) => Boolean(expandedCategories[cat.id]));

  const toggleExpandAll = () => {
    const targetState = !allExpanded;
    setExpandedCategories((prev) => {
      const next = { ...prev };
      for (const cat of filteredCategories) {
        next[cat.id] = targetState;
      }
      return next;
    });
  };

  const visibleCertCount = filteredCategories.reduce((acc, c) => acc + c.certs.length, 0);

  const featuredCerts = FEATURED_CERT_IDS.map((id) => CERTIFICATIONS.find((c) => c.id === id)).filter(
    (c): c is Certification => Boolean(c)
  ).filter((cert) => {
    if (hasSkillFilter && !doesCertMatchSkill(cert, selectedSkills)) return false;
    if (!normalizedSearch) return true;
    return (
      cert.title.toLowerCase().includes(normalizedSearch) ||
      cert.issuer.toLowerCase().includes(normalizedSearch) ||
      cert.skills.some((s) => s.toLowerCase().includes(normalizedSearch))
    );
  });

  const renderCertCards = (certs: Certification[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 print:grid-cols-2 gap-5">
      {certs.map((cert, cIdx) => (
        <SpotlightCard
          key={cert.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4 }}
          transition={{
            opacity: { duration: 0.3, delay: Math.min(cIdx * 0.03, 0.2), ease: EASE_OUT_EXPO },
            y: { duration: 0.3, delay: Math.min(cIdx * 0.03, 0.2), ease: EASE_OUT_EXPO },
          }}
          className="rounded-2xl border border-slate-800 bg-[#090d16]/90 p-5 flex flex-col justify-between hover:border-cyan-500/40 transition-colors hover:shadow-xl hover:shadow-cyan-950/25 group print:break-inside-avoid"
        >
          <div>
            {/* Top row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80 text-[11px] font-mono">
              <span className="text-slate-400">
                {cert.issueDate}
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium shrink-0">
                <CheckCircle className="w-3 h-3" />
                Verified
              </span>
            </div>

            {/* Issuer with crisp brand mark */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
              className="mt-3 flex items-center gap-2"
            >
              <IssuerMark issuer={cert.issuer} size="sm" theme={theme} />
              <span className="text-[11px] font-mono font-medium text-cyan-400 tracking-wide uppercase truncate">
                {cert.issuer}
              </span>
            </motion.div>

            {/* Title */}
            <h4 className="text-base font-display font-bold text-white mt-1.5 group-hover:text-cyan-300 transition-colors leading-snug">
              {cert.title}
            </h4>

            {/* Credential ID or Status */}
            <div className="mt-3 text-[11px] font-mono text-slate-400 truncate">
              {cert.credentialId ? (
                <>ID: <span className="text-slate-300">{cert.credentialId}</span></>
              ) : (
                <span className="text-slate-400">Official Accreditation Record</span>
              )}
            </div>

            {/* Key Skills */}
            <div className="mt-4 flex flex-wrap gap-1">
              {cert.skills.map((skill, sIdx) => {
                const isMatch = doesTechTagMatchSkill(skill, selectedSkills);
                return (
                  <span
                    key={sIdx}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      isMatch
                        ? 'skill-chip-active bg-cyan-500 border border-cyan-500 text-slate-950 font-semibold'
                        : 'bg-[#07090e] border border-slate-800 text-slate-400'
                    }`}
                  >
                    {skill}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 mt-5 border-t border-slate-800/80 flex items-center gap-2 print:hidden">
            <a
              href={cert.credentialUrl || 'https://www.linkedin.com/in/mohammed-sufyan/details/certifications/'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cyan-950/50 border border-cyan-500/40 hover:bg-cyan-900/60 text-xs font-semibold text-cyan-300 transition-all group/link"
            >
              <span>Show Credential</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
            </a>
            <button
              onClick={() => onSelectCertification(cert)}
              className="py-2 px-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-all"
              title="View details & copy ID"
              aria-label="View details"
            >
              <ShieldCheck className="w-4 h-4 text-slate-400 hover:text-cyan-400" />
            </button>
          </div>
        </SpotlightCard>
      ))}
    </div>
  );

  return (
    <section id="certifications" className="relative py-16 lg:py-24 border-b border-slate-800/80 bg-[#07090e]">
      <SectionScanLine />
      <div className="page-shell">
        {/* Section Header */}
        <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <HeaderSpotlight className="min-w-0">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-400 tracking-wider uppercase mb-2">
              <Award className="w-3.5 h-3.5" />
              <span>LICENSES &amp; OFFICIAL CERTIFICATIONS</span>
            </div>
            <h2 className="fluid-title font-display font-bold text-white tracking-tight">
              Licenses &amp; Official Certifications
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-3xl">
              Official verified credentials across enterprise cloud providers, architecture certifications, and AI disciplines. {CERTIFICATIONS.length} verified credentials with public verification.
            </p>
            <div className="mt-3">
              <a
                href="https://www.linkedin.com/in/mohammed-sufyan/details/certifications/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 text-xs font-mono text-cyan-300 transition-colors max-w-full"
              >
                <span className="break-all">linkedin.com/in/mohammed-sufyan/details/certifications</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          </div>
          </HeaderSpotlight>

          {/* Search Box */}
          <div className="relative w-full md:w-72 shrink-0 print:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cert or skill..."
              aria-label="Search certifications or skills"
              className="w-full pl-9 pr-14 py-2 rounded-xl bg-[#0d121f] border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear certification search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </Reveal>

        {/* Featured credentials strip */}
        {featuredCerts.length > 0 && (
          <div className="mb-10 print:hidden">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div
                className={`text-[11px] font-mono uppercase tracking-wider ${
                  isAmber
                    ? isLight
                      ? 'text-amber-800'
                      : 'text-amber-400'
                    : 'text-cyan-400'
                }`}
              >
                Featured Credentials
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                {featuredCerts.length} highlighted
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {featuredCerts.map((cert, idx) => (
                <motion.button
                  key={cert.id}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: idx * 0.04, ease: EASE_OUT_EXPO }}
                  whileHover={{ y: -3 }}
                  onClick={() => onSelectCertification(cert)}
                  className={`featured-cred-card w-full rounded-xl border p-3.5 text-left transition-colors ${
                    isLight
                      ? 'border-slate-200 bg-white shadow-sm'
                      : 'border-slate-800 bg-[#0d121f]/80'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <IssuerMark issuer={cert.issuer} size="sm" theme={theme} />
                    <span
                      className={`text-[10px] font-mono uppercase truncate ${
                        isAmber
                          ? isLight
                            ? 'text-amber-800'
                            : 'text-amber-400'
                          : isLight
                            ? 'text-sky-700'
                            : 'text-cyan-400'
                      }`}
                    >
                      {cert.issuer}
                    </span>
                  </div>
                  <div className={`text-xs font-display font-bold leading-snug line-clamp-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {cert.title}
                  </div>
                  <div className={`mt-2 text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {cert.issueDate}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Filter Tabs + Expand/Collapse All */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-10 print:hidden">
          <div className="scroll-chips p-1.5 rounded-xl bg-[#0d121f]/70 border border-slate-800 w-full sm:w-fit sm:flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'all'
                  ? 'text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {activeTab === 'all' && (
                <motion.span
                  layoutId="cert-filter-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-cyan-500 shadow-sm"
                />
              )}
              <span className="relative z-10">
                <span className="sm:hidden">All</span>
                <span className="hidden sm:inline">All Disciplines</span>
                {' '}({CERTIFICATION_CATEGORIES.reduce((acc, c) => acc + c.certs.length, 0)})
              </span>
            </button>
            {CERTIFICATION_CATEGORIES.map((cat) => {
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id as 'ai' | 'cloud' | 'data')}
                  className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="cert-filter-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-cyan-500 shadow-sm"
                    />
                  )}
                  <span className="relative z-10">
                    {cat.name} ({cat.certs.length})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* Grid / Cloud Radar Toggle */}
            <div
              className={`inline-flex items-center gap-1 p-1 rounded-xl border ${
                isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-800 bg-[#0d121f]'
              }`}
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'grid'
                    ? isLight
                      ? 'bg-sky-600 text-white font-semibold shadow-sm'
                      : 'bg-cyan-500 text-slate-950 font-semibold'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-white'
                      : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('radar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'radar'
                    ? isLight
                      ? 'bg-sky-600 text-white font-semibold shadow-sm'
                      : 'bg-cyan-500 text-slate-950 font-semibold'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-white'
                      : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radar className="w-3.5 h-3.5" />
                <span>Cloud Radar</span>
              </button>
            </div>

            {viewMode === 'grid' && filteredCategories.length > 0 && (
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
        </div>

        <AnimatePresence>
          {hasSkillFilter && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="skill-filter-banner mb-8 sticky top-16 z-20 flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-cyan-950/90 border border-cyan-500/40 text-xs font-mono text-cyan-200 w-full sm:w-fit shadow-lg shadow-cyan-950/20 backdrop-blur-md print:hidden"
              >
              <span className="min-w-0">
                {skillFilter.label}:{' '}
                <strong className="text-cyan-300 break-words">{skillFilter.names}</strong>
                {' '}({visibleCertCount} {visibleCertCount === 1 ? 'credential' : 'credentials'})
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

        {/* Cloud Constellation Radar View or Collapsible Categories Stack */}
        {viewMode === 'radar' ? (
          <div className="mb-10 print:hidden">
            <CloudConstellation
              onSelectCertification={onSelectCertification}
              onFilterGridByProvider={(providerToken) => {
                setActiveTab('all');
                setSearchQuery(providerToken);
                setViewMode('grid');
              }}
            />
          </div>
        ) : readingMode === 'brief' && !showAllInBrief && !hasSkillFilter && !normalizedSearch && activeTab === 'all' ? (
          <div className="rounded-2xl border border-slate-800/80 bg-[#0d121f]/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
            <div>
              <div className="text-xs font-mono text-cyan-400">
                30s Brief · 3 Pinned Signature Credentials Highlighted Above
              </div>
              <div className="text-sm text-slate-300 mt-1">
                {CERTIFICATIONS.length} total verified credentials across AI &amp; Agentic Systems, Cloud Architecture, and Data Engineering.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAllInBrief(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-[#090d16] hover:border-cyan-500/40 text-xs font-mono text-cyan-300 transition-colors shrink-0 cursor-pointer"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              <span>View All {CERTIFICATIONS.length} Credentials</span>
            </button>
          </div>
        ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
          >
            <CollapseTimeline>
            {filteredCategories.map((category) => {
              const isExpanded = expandedCategories[category.id] ?? false;

              return (
                <CollapseTimelineNode key={category.id} pulse={isExpanded}>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                  className="rounded-2xl border border-slate-800 hover:border-slate-700/80 bg-[#0d121f]/70 overflow-hidden shadow-xl transition-colors"
                >
                  {/* Collapsible Category Banner */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggleCategory(category.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCategory(category.id);
                      }
                    }}
                    className={`pdf-keep-next print:break-inside-avoid flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 bg-[#0a0e1a] ${
                      isExpanded ? 'border-b border-slate-800/80' : ''
                    } cursor-pointer hover:bg-[#0c1120] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 transition-colors gap-3`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">
                            {category.name}
                          </h3>
                          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-0.5 rounded shrink-0">
                            {category.certs.length} {category.certs.length === 1 ? 'Credential' : 'Credentials'}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-1 truncate">
                          {category.certs.slice(0, 3).map((c) => c.issuer).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}
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

                  {/* Expanded Credentials Grid */}
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
                          {renderCertCards(category.certs)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Print-only expanded fallback when collapsed on screen */}
                  {!isExpanded && (
                    <div className="hidden print:block p-5 sm:p-6">
                      {renderCertCards(category.certs)}
                    </div>
                  )}
                </motion.div>
                </CollapseTimelineNode>
              );
            })}
            </CollapseTimeline>
          </motion.div>
        </AnimatePresence>
        )}

        {viewMode === 'grid' && filteredCategories.length === 0 && (
          <div className="text-center py-12 space-y-3 text-slate-400 text-sm">
            <div>
              No certifications found
              {searchQuery ? ` matching "${searchQuery}"` : ''}
              {hasSkillFilter ? ` for ${skillFilter.count > 1 ? 'skills' : 'skill'} "${skillFilter.names}"` : ''}.
            </div>
            {(searchQuery || hasSkillFilter || activeTab !== 'all') && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {hasSkillFilter && (
                  <button
                    type="button"
                    onClick={() => onSelectSkill(null)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors"
                  >
                    {skillFilter.count > 1 ? 'Clear Skill Filters' : 'Clear Skill Filter'}
                  </button>
                )}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
