import { useMemo, useState } from 'react';
import { ArrowRight, Award as AwardIcon, Building2, Medal, Quote, Radar, Star } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AWARDS,
  AWARDS_BY_ORGANIZATION,
  Award,
  LINKEDIN_RECOMMENDATIONS,
  Recommendation,
} from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import { Linkedin } from './icons/Linkedin';
import { EASE_OUT_EXPO } from './MotionPrimitives';

type OrgFilterId = 'all' | 'Cisco' | 'HCL' | 'TCS';
type RecFilterId = 'featured' | 'all' | 'manager' | 'direct_report' | 'peer';

interface RecognitionRadarProps {
  onOpenCitationsView: (orgFilter: OrgFilterId, searchKeyword?: string) => void;
  onJumpToEndorsements: (recFilter: RecFilterId) => void;
}

interface RecognitionPillar {
  id:
    | 'platform-security'
    | 'architecture-ai'
    | 'knowledge-mentorship'
    | 'execution-impact'
    | 'tenure-consistency';
  label: string;
  shortLabel: string;
  description: string;
  accentDark: string;
  accentLight: string;
  orgFilter: OrgFilterId;
  searchKeyword?: string;
  recFilter: RecFilterId;
  awards: Award[];
  recommendations: Recommendation[];
}

const PILLAR_CONFIG: Array<{
  id: RecognitionPillar['id'];
  label: string;
  shortLabel: string;
  description: string;
  accentDark: string;
  accentLight: string;
  orgFilter: OrgFilterId;
  searchKeyword?: string;
  recFilter: RecFilterId;
  awardIds: string[];
  recIds: string[];
}> = [
  {
    id: 'platform-security',
    label: 'Platform & Security Delivery',
    shortLabel: 'Platform',
    description:
      'Executive recognition for launching Cisco STO Project Atlas, vulnerability orchestration & JupiterOne graph analytics.',
    accentDark: '#22d3ee',
    accentLight: '#0284c7',
    orgFilter: 'all',
    searchKeyword: 'Platform',
    recFilter: 'manager',
    awardIds: [
      'award-cisco-ptw-sep2026',
      'award-hcl-star-mar2025',
      'award-hcl-star-dec2024',
      'award-hcl-achieve-o4',
      'award-hcl-achieve-o3',
      'award-hcl-deliv-sep2021',
    ],
    recIds: [
      'rec-justin-tang',
      'rec-abhishek-ghimire',
      'rec-omar-khalid',
      'rec-shijia-hu',
      'rec-rakesh-chandrappa',
    ],
  },
  {
    id: 'architecture-ai',
    label: 'Architecture & Technical Innovation',
    shortLabel: 'Architecture',
    description:
      'HCL Technical Excellence, Shining Star & Achievers League honors for resilient microservices and compliance pipelines.',
    accentDark: '#38bdf8',
    accentLight: '#0369a1',
    orgFilter: 'HCL',
    searchKeyword: 'Technical',
    recFilter: 'peer',
    awardIds: [
      'award-hcl-tech-mar2022',
      'award-hcl-achieve-o2',
      'award-hcl-shining-mar2023',
      'award-hcl-shining-dec2022',
    ],
    recIds: [
      'rec-shanjeev-rajendran',
      'rec-ganesh-chandan',
      'rec-rakshith-kumar',
      'rec-laxmi-prasad-sahu',
      'rec-saifullah-kazi',
    ],
  },
  {
    id: 'knowledge-mentorship',
    label: 'Knowledge & Team Mentorship',
    shortLabel: 'Mentorship',
    description:
      '4× ERS Knowledge Champion streak backed by direct-report and cross-team mentoring testimonials.',
    accentDark: '#a78bfa',
    accentLight: '#7c3aed',
    orgFilter: 'HCL',
    searchKeyword: 'Knowledge',
    recFilter: 'direct_report',
    awardIds: [
      'award-hcl-kc-mar2026',
      'award-hcl-kc-dec2025',
      'award-hcl-kc-aug2022',
      'award-hcl-kc-sep2020',
    ],
    recIds: [
      'rec-manje-gowda',
      'rec-neha-gupta',
      'rec-gowtham-r',
      'rec-arpitha-patil',
      'rec-pradnya-patil',
    ],
  },
  {
    id: 'execution-impact',
    label: 'Execution & Collaboration',
    shortLabel: 'Execution',
    description:
      'Cisco Play to Win Together, Champion awards, and Spark recognition for rapid delivery under pressure.',
    accentDark: '#f59e0b',
    accentLight: '#d97706',
    orgFilter: 'all',
    searchKeyword: 'Champion',
    recFilter: 'manager',
    awardIds: [
      'award-cisco-ptw-aug2026',
      'award-hcl-champ-feb2025',
      'award-hcl-champ-jan2025',
      'award-hcl-spark-apr2021',
    ],
    recIds: [
      'rec-alex-medovar',
      'rec-sharukh-ainan',
      'rec-lathish-naidu',
      'rec-ravikiran-shetty',
    ],
  },
  {
    id: 'tenure-consistency',
    label: 'Sustained Tenure & Reliability',
    shortLabel: 'Consistency',
    description:
      '5+ years Tata Consultancy Services Service Commitment, On-the-Spot distinction & Apple/TCS peer praise.',
    accentDark: '#34d399',
    accentLight: '#059669',
    orgFilter: 'TCS',
    recFilter: 'peer',
    awardIds: ['award-tcs-service-2019', 'award-tcs-spot-2017'],
    recIds: [
      'rec-shashikiran-shetty',
      'rec-asthik-hebbar',
      'rec-sudarshana-ms',
      'rec-sahil-ahmed',
    ],
  },
];

export default function RecognitionRadar({
  onOpenCitationsView,
  onJumpToEndorsements,
}: RecognitionRadarProps) {
  const { isLight } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  const pillars = useMemo<RecognitionPillar[]>(() => {
    const awardsMap = new Map(AWARDS.map((a) => [a.id, a]));
    const recsMap = new Map(LINKEDIN_RECOMMENDATIONS.map((r) => [r.id, r]));

    return PILLAR_CONFIG.map((cfg) => ({
      id: cfg.id,
      label: cfg.label,
      shortLabel: cfg.shortLabel,
      description: cfg.description,
      accentDark: cfg.accentDark,
      accentLight: cfg.accentLight,
      orgFilter: cfg.orgFilter,
      searchKeyword: cfg.searchKeyword,
      recFilter: cfg.recFilter,
      awards: cfg.awardIds
        .map((id) => awardsMap.get(id))
        .filter((a): a is Award => Boolean(a)),
      recommendations: cfg.recIds
        .map((id) => recsMap.get(id))
        .filter((r): r is Recommendation => Boolean(r)),
    }));
  }, []);

  const [selectedPillarId, setSelectedPillarId] =
    useState<RecognitionPillar['id']>('platform-security');
  const [inspectorTab, setInspectorTab] = useState<'awards' | 'quotes'>('awards');

  const activePillar =
    pillars.find((p) => p.id === selectedPillarId) ?? pillars[0];

  const totalProofs = AWARDS.length + LINKEDIN_RECOMMENDATIONS.length;
  const maxProofs = Math.max(
    ...pillars.map((p) => p.awards.length + p.recommendations.length),
    1
  );

  const cx = 210;
  const cy = 200;
  const maxRadius = 126;

  const vertices = pillars.map((pillar, idx) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / pillars.length;
    const total = pillar.awards.length + pillar.recommendations.length;
    const normalized = 0.44 + (total / maxProofs) * 0.56;
    const r = maxRadius * normalized;
    const labelR = maxRadius + 40;
    return {
      pillar,
      total,
      angle,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      outerX: cx + maxRadius * Math.cos(angle),
      outerY: cy + maxRadius * Math.sin(angle),
      labelX: cx + labelR * Math.cos(angle),
      labelY: cy + labelR * Math.sin(angle),
    };
  });

  const polygonPoints = vertices
    .map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`)
    .join(' ');

  const orgBreakdown = useMemo(
    () =>
      AWARDS_BY_ORGANIZATION.map((g) => ({
        name: g.organization.includes('Cisco')
          ? 'Cisco'
          : g.organization.includes('HCL')
            ? 'HCL'
            : 'TCS',
        filter: (g.organization.includes('Cisco')
          ? 'Cisco'
          : g.organization.includes('HCL')
            ? 'HCL'
            : 'TCS') as OrgFilterId,
        count: g.awards.length,
      })),
    []
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left: Interactive 5-Axis Impact & 360° Proof Radar */}
      <div
        className={`lg:col-span-6 rounded-2xl border p-5 sm:p-6 flex flex-col justify-between ${
          isLight
            ? 'border-slate-200 bg-white shadow-lg shadow-slate-200/50'
            : 'border-slate-800 bg-[#0a0f1c]/90 shadow-xl'
        }`}
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${
            isLight ? 'border-slate-200' : 'border-slate-800/80'
          }`}
        >
          <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400">
            <Radar className="w-4 h-4" />
            <span>Impact &amp; 360° Endorsement Radar</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
            {AWARDS.length} Awards · {LINKEDIN_RECOMMENDATIONS.length} Quotes
          </div>
        </div>

        <div className="my-4 flex items-center justify-center">
          <svg
            viewBox="0 0 420 400"
            className="w-full max-w-[400px] h-auto select-none"
            role="img"
            aria-label="5-pillar corporate recognitions and 360-degree LinkedIn endorsement radar chart"
          >
            {/* Concentric radar rings */}
            {[0.25, 0.5, 0.75, 1].map((step) => (
              <circle
                key={step}
                cx={cx}
                cy={cy}
                r={maxRadius * step}
                fill="none"
                stroke={isLight ? '#cbd5e1' : '#1e293b'}
                strokeWidth="1"
                strokeDasharray={step === 1 ? undefined : '4 4'}
              />
            ))}

            {/* Radial spokes */}
            {vertices.map((v) => (
              <line
                key={`spoke-${v.pillar.id}`}
                x1={cx}
                y1={cy}
                x2={v.outerX}
                y2={v.outerY}
                stroke={isLight ? '#e2e8f0' : '#1e293b'}
                strokeWidth="1"
              />
            ))}

            {/* Mastery polygon */}
            <motion.polygon
              points={polygonPoints}
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              fill={
                isLight
                  ? 'rgba(14, 165, 233, 0.16)'
                  : 'rgba(34, 211, 238, 0.16)'
              }
              stroke={isLight ? '#0284c7' : '#22d3ee'}
              strokeWidth="2.2"
            />

            {/* Interactive Pillar Nodes */}
            {vertices.map((v) => {
              const isSelected = v.pillar.id === selectedPillarId;
              const accent = isLight ? v.pillar.accentLight : v.pillar.accentDark;
              return (
                <g
                  key={v.pillar.id}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${v.pillar.label} (${v.pillar.awards.length} awards, ${v.pillar.recommendations.length} quotes)`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedPillarId(v.pillar.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPillarId(v.pillar.id);
                    }
                  }}
                >
                  <circle cx={v.x} cy={v.y} r="22" fill="transparent" />
                  {isSelected && (
                    <circle
                      cx={v.x}
                      cy={v.y}
                      r="12"
                      fill="none"
                      stroke={accent}
                      strokeWidth="1.5"
                      strokeOpacity="0.65"
                    />
                  )}
                  <circle
                    cx={v.x}
                    cy={v.y}
                    r={isSelected ? 7.5 : 5.5}
                    fill={accent}
                    stroke={isLight ? '#ffffff' : '#07090e'}
                    strokeWidth="2"
                  />
                  <text
                    x={v.labelX}
                    y={v.labelY - 4}
                    textAnchor="middle"
                    className="font-display text-[12px] font-bold"
                    fill={
                      isSelected
                        ? isLight
                          ? '#0c4a6e'
                          : '#ffffff'
                        : isLight
                          ? '#334155'
                          : '#cbd5e1'
                    }
                  >
                    {v.pillar.shortLabel}
                  </text>
                  <text
                    x={v.labelX}
                    y={v.labelY + 11}
                    textAnchor="middle"
                    className="font-mono text-[10px] tabular-nums"
                    fill={isLight ? '#0369a1' : '#38bdf8'}
                  >
                    {v.pillar.awards.length}a · {v.pillar.recommendations.length}q
                  </text>
                </g>
              );
            })}

            {/* Center Badge */}
            <circle
              cx={cx}
              cy={cy}
              r="27"
              fill={isLight ? '#f0f9ff' : '#0d121f'}
              stroke={isLight ? '#7dd3fc' : '#1e293b'}
              strokeWidth="1.5"
            />
            <text
              x={cx}
              y={cy + 1}
              textAnchor="middle"
              className="font-display text-[14px] font-extrabold tabular-nums"
              fill={isLight ? '#0369a1' : '#38bdf8'}
            >
              {totalProofs}x
            </text>
            <text
              x={cx}
              y={cy + 13}
              textAnchor="middle"
              className="font-mono text-[8px] tracking-wider uppercase"
              fill={isLight ? '#475569' : '#94a3b8'}
            >
              proofs
            </text>
          </svg>
        </div>

        {/* 360 Organization Strip + Bottom Pillar Quick Tabs */}
        <div className="space-y-3">
          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border text-[11px] font-mono ${
              isLight
                ? 'border-slate-200 bg-slate-50 text-slate-600'
                : 'border-slate-800/90 bg-[#090d16] text-slate-400'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>By Organization:</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {orgBreakdown.map((org) => (
                <button
                  key={org.name}
                  type="button"
                  onClick={() => onOpenCitationsView(org.filter)}
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    isLight
                      ? 'border-slate-200 bg-white hover:border-sky-400 text-slate-700'
                      : 'border-slate-800 bg-[#0d121f] hover:border-cyan-500/40 text-slate-300'
                  }`}
                >
                  {org.name}: <strong className="text-cyan-400">{org.count}</strong>
                </button>
              ))}
            </div>
          </div>

          <div
            className={`flex flex-wrap gap-1.5 pt-3 border-t ${
              isLight ? 'border-slate-200' : 'border-slate-800/80'
            }`}
          >
            {pillars.map((p) => {
              const active = p.id === selectedPillarId;
              const count = p.awards.length + p.recommendations.length;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPillarId(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                    active
                      ? isLight
                        ? 'bg-sky-600 text-white font-semibold'
                        : 'bg-cyan-500 text-slate-950 font-semibold'
                      : isLight
                        ? 'bg-slate-100 border border-slate-200 text-slate-700 hover:border-sky-400'
                        : 'bg-[#090d16] border border-slate-800 text-slate-300 hover:border-cyan-500/40'
                  }`}
                >
                  {p.shortLabel} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Selected Pillar Citations & 360° Endorsements Inspector */}
      <div
        className={`lg:col-span-6 rounded-2xl border p-5 sm:p-6 flex flex-col justify-between ${
          isLight
            ? 'border-slate-200 bg-white shadow-lg shadow-slate-200/50'
            : 'border-slate-800 bg-[#0d121f]/80 shadow-xl'
        }`}
      >
        <div>
          <div
            className={`flex flex-wrap items-start justify-between gap-2 pb-3 border-b ${
              isLight ? 'border-slate-200' : 'border-slate-800/80'
            }`}
          >
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                {activePillar.label}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {activePillar.description}
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400 tabular-nums shrink-0">
              {activePillar.awards.length}a · {activePillar.recommendations.length}q
            </span>
          </div>

          {/* Inspector Switcher: Citations vs LinkedIn 360 Quotes */}
          <div
            className={`mt-4 inline-flex items-center gap-1 p-1 rounded-xl border ${
              isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-800 bg-[#090d16]'
            }`}
          >
            <button
              type="button"
              onClick={() => setInspectorTab('awards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                inspectorTab === 'awards'
                  ? isLight
                    ? 'bg-sky-600 text-white font-semibold shadow-sm'
                    : 'bg-cyan-500 text-slate-950 font-semibold'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    : 'text-slate-400 hover:text-white'
              }`}
            >
              <AwardIcon className="w-3.5 h-3.5" />
              <span>Corporate Citations ({activePillar.awards.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab('quotes')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                inspectorTab === 'quotes'
                  ? isLight
                    ? 'bg-sky-600 text-white font-semibold shadow-sm'
                    : 'bg-cyan-500 text-slate-950 font-semibold'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    : 'text-slate-400 hover:text-white'
              }`}
            >
              <Linkedin className="w-3.5 h-3.5" />
              <span>360° Quotes ({activePillar.recommendations.length})</span>
            </button>
          </div>

          {/* Scrollable Evidence Cards */}
          <div className="mt-4 space-y-2.5 max-h-[370px] overflow-y-auto pr-1">
            {inspectorTab === 'awards'
              ? activePillar.awards.map((award) => (
                  <div
                    key={award.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isLight
                        ? 'border-slate-200 bg-slate-50/70 hover:border-sky-300'
                        : 'border-slate-800/90 bg-[#090d16] hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-cyan-400 font-semibold">{award.date}</span>
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Star className="w-3 h-3 fill-amber-400/40" />
                        <span>{award.organization}</span>
                      </span>
                    </div>
                    <div className="text-sm font-display font-semibold text-white mt-1 leading-snug">
                      {award.title}
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400/90 mt-0.5">
                      {award.category}
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      {award.description}
                    </p>
                  </div>
                ))
              : activePillar.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isLight
                        ? 'border-slate-200 bg-slate-50/70 hover:border-sky-300'
                        : 'border-slate-800/90 bg-[#090d16] hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-cyan-400 font-semibold">{rec.date}</span>
                      <span className="text-emerald-400 uppercase tracking-wider text-[10px]">
                        {rec.relationshipType === 'manager'
                          ? 'Direct Manager'
                          : rec.relationshipType === 'direct_report'
                            ? 'Direct Report'
                            : 'Peer / Lead'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <Quote className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed">
                        &ldquo;{rec.quote}&rdquo;
                      </p>
                    </div>
                    <div
                      className={`mt-2.5 pt-2 border-t flex items-center justify-between gap-2 ${
                        isLight ? 'border-slate-200' : 'border-slate-800/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-display font-bold text-white truncate">
                          {rec.author}
                        </div>
                        <div className="text-[10px] font-mono text-cyan-400/90 truncate">
                          {rec.role}
                        </div>
                      </div>
                      <Medal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`pt-4 mt-5 border-t flex flex-wrap items-center justify-between gap-2.5 ${
            isLight ? 'border-slate-200' : 'border-slate-800/80'
          }`}
        >
          <button
            type="button"
            onClick={() => onJumpToEndorsements(activePillar.recFilter)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
              isLight
                ? 'border-slate-200 bg-slate-50 hover:border-sky-400 text-slate-700'
                : 'border-slate-800 bg-[#090d16] hover:border-cyan-500/40 text-cyan-300'
            }`}
          >
            <Linkedin className="w-3.5 h-3.5" />
            <span>View Endorsements</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onOpenCitationsView(activePillar.orgFilter, activePillar.searchKeyword)
            }
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold text-xs transition-colors ${
              isLight
                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
          >
            <span>Open {activePillar.shortLabel} in Citations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
