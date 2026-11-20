import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Building2, QrCode, Radar, Trophy } from 'lucide-react';
import {
  AWARDS,
  AWARDS_BY_ORGANIZATION,
  CERTIFICATIONS,
  LINKEDIN_RECOMMENDATIONS,
} from '../data/portfolioData';
import { PORTFOLIO_CANONICAL_URL } from '../utils/vcard';
import type { CvAccentId } from '../utils/cvShareConfig';

interface ThemeProps {
  isLight: boolean;
  accent?: CvAccentId;
}

function getInfographicAccent(isLight: boolean, accent: CvAccentId = 'cyan') {
  switch (accent) {
    case 'cobalt':
      return {
        text: isLight ? 'text-blue-700' : 'text-blue-400',
        barPrimary: isLight ? 'bg-blue-600' : 'bg-blue-500',
        barSecondary: isLight ? 'bg-indigo-600' : 'bg-indigo-400',
        polyFill: isLight ? 'rgba(37, 99, 235, 0.15)' : 'rgba(96, 165, 250, 0.19)',
        polyStroke: isLight ? '#2563eb' : '#60a5fa',
        hubFill: isLight ? '#eff6ff' : '#0b152a',
        hubStroke: isLight ? '#93c5fd' : '#1e3a8a',
        hubText: isLight ? '#1d4ed8' : '#93c5fd',
        iconBox: isLight
          ? 'bg-blue-50 border-blue-200 text-blue-700'
          : 'bg-blue-950/50 border-blue-500/35 text-blue-400',
        badge: isLight
          ? 'border-blue-200 bg-blue-50 text-blue-800'
          : 'border-blue-500/30 bg-blue-950/40 text-blue-300',
      };
    case 'copper':
      return {
        text: isLight ? 'text-orange-700' : 'text-orange-400',
        barPrimary: isLight ? 'bg-orange-600' : 'bg-orange-500',
        barSecondary: isLight ? 'bg-amber-600' : 'bg-amber-400',
        polyFill: isLight ? 'rgba(234, 88, 12, 0.14)' : 'rgba(251, 146, 60, 0.18)',
        polyStroke: isLight ? '#ea580c' : '#fb923c',
        hubFill: isLight ? '#fff7ed' : '#241208',
        hubStroke: isLight ? '#fdba74' : '#7c2d12',
        hubText: isLight ? '#c2410c' : '#fdba74',
        iconBox: isLight
          ? 'bg-orange-50 border-orange-200 text-orange-700'
          : 'bg-orange-950/50 border-orange-500/35 text-orange-400',
        badge: isLight
          ? 'border-orange-200 bg-orange-50 text-orange-800'
          : 'border-orange-500/30 bg-orange-950/40 text-orange-300',
      };
    case 'emerald':
      return {
        text: isLight ? 'text-emerald-700' : 'text-emerald-400',
        barPrimary: isLight ? 'bg-emerald-600' : 'bg-emerald-500',
        barSecondary: isLight ? 'bg-teal-600' : 'bg-teal-400',
        polyFill: isLight ? 'rgba(5, 150, 105, 0.16)' : 'rgba(52, 211, 153, 0.18)',
        polyStroke: isLight ? '#059669' : '#34d399',
        hubFill: isLight ? '#ecfdf5' : '#071a15',
        hubStroke: isLight ? '#6ee7b7' : '#065f46',
        hubText: isLight ? '#047857' : '#6ee7b7',
        iconBox: isLight
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-emerald-950/50 border-emerald-500/35 text-emerald-400',
        badge: isLight
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300',
      };
    case 'indigo':
      return {
        text: isLight ? 'text-indigo-700' : 'text-indigo-400',
        barPrimary: isLight ? 'bg-indigo-600' : 'bg-indigo-500',
        barSecondary: isLight ? 'bg-violet-600' : 'bg-violet-400',
        polyFill: isLight ? 'rgba(79, 70, 229, 0.15)' : 'rgba(129, 140, 248, 0.19)',
        polyStroke: isLight ? '#4f46e5' : '#818cf8',
        hubFill: isLight ? '#eef2ff' : '#0f1229',
        hubStroke: isLight ? '#a5b4fc' : '#312e81',
        hubText: isLight ? '#4338ca' : '#a5b4fc',
        iconBox: isLight
          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
          : 'bg-indigo-950/50 border-indigo-500/35 text-indigo-400',
        badge: isLight
          ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
          : 'border-indigo-500/30 bg-indigo-950/40 text-indigo-300',
      };
    case 'violet':
      return {
        text: isLight ? 'text-violet-700' : 'text-violet-400',
        barPrimary: isLight ? 'bg-violet-600' : 'bg-violet-500',
        barSecondary: isLight ? 'bg-fuchsia-600' : 'bg-fuchsia-400',
        polyFill: isLight ? 'rgba(124, 58, 237, 0.15)' : 'rgba(167, 139, 250, 0.19)',
        polyStroke: isLight ? '#7c3aed' : '#a78bfa',
        hubFill: isLight ? '#f5f3ff' : '#140f29',
        hubStroke: isLight ? '#c4b5fd' : '#4c1d95',
        hubText: isLight ? '#6d28d9' : '#c4b5fd',
        iconBox: isLight
          ? 'bg-violet-50 border-violet-200 text-violet-700'
          : 'bg-violet-950/50 border-violet-500/35 text-violet-400',
        badge: isLight
          ? 'border-violet-200 bg-violet-50 text-violet-800'
          : 'border-violet-500/30 bg-violet-950/40 text-violet-300',
      };
    case 'amber':
      return {
        text: isLight ? 'text-amber-700' : 'text-amber-400',
        barPrimary: isLight ? 'bg-amber-600' : 'bg-amber-500',
        barSecondary: isLight ? 'bg-orange-600' : 'bg-orange-400',
        polyFill: isLight ? 'rgba(217, 119, 6, 0.15)' : 'rgba(251, 191, 36, 0.18)',
        polyStroke: isLight ? '#d97706' : '#fbbf24',
        hubFill: isLight ? '#fffbeb' : '#1f1608',
        hubStroke: isLight ? '#fcd34d' : '#78350f',
        hubText: isLight ? '#b45309' : '#fcd34d',
        iconBox: isLight
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-amber-950/50 border-amber-500/35 text-amber-400',
        badge: isLight
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-amber-500/30 bg-amber-950/40 text-amber-300',
      };
    case 'teal':
      return {
        text: isLight ? 'text-teal-700' : 'text-teal-400',
        barPrimary: isLight ? 'bg-teal-600' : 'bg-teal-500',
        barSecondary: isLight ? 'bg-cyan-600' : 'bg-cyan-400',
        polyFill: isLight ? 'rgba(13, 148, 136, 0.15)' : 'rgba(45, 212, 191, 0.18)',
        polyStroke: isLight ? '#0d9488' : '#2dd4bf',
        hubFill: isLight ? '#f0fdfa' : '#081a1a',
        hubStroke: isLight ? '#99f6e4' : '#115e59',
        hubText: isLight ? '#0f766e' : '#5eead4',
        iconBox: isLight
          ? 'bg-teal-50 border-teal-200 text-teal-700'
          : 'bg-teal-950/50 border-teal-500/35 text-teal-400',
        badge: isLight
          ? 'border-teal-200 bg-teal-50 text-teal-800'
          : 'border-teal-500/30 bg-teal-950/40 text-teal-300',
      };
    case 'rose':
      return {
        text: isLight ? 'text-rose-700' : 'text-rose-400',
        barPrimary: isLight ? 'bg-rose-600' : 'bg-rose-500',
        barSecondary: isLight ? 'bg-pink-600' : 'bg-pink-400',
        polyFill: isLight ? 'rgba(225, 29, 72, 0.14)' : 'rgba(251, 113, 133, 0.18)',
        polyStroke: isLight ? '#e11d48' : '#fb7185',
        hubFill: isLight ? '#fff1f2' : '#220b12',
        hubStroke: isLight ? '#fda4af' : '#881337',
        hubText: isLight ? '#be123c' : '#fda4af',
        iconBox: isLight
          ? 'bg-rose-50 border-rose-200 text-rose-700'
          : 'bg-rose-950/50 border-rose-500/35 text-rose-400',
        badge: isLight
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-rose-500/30 bg-rose-950/40 text-rose-300',
      };
    case 'slate':
      return {
        text: isLight ? 'text-slate-800' : 'text-slate-200',
        barPrimary: isLight ? 'bg-slate-700' : 'bg-slate-400',
        barSecondary: isLight ? 'bg-slate-900' : 'bg-slate-200',
        polyFill: isLight ? 'rgba(51, 65, 85, 0.15)' : 'rgba(148, 163, 184, 0.18)',
        polyStroke: isLight ? '#334155' : '#cbd5e1',
        hubFill: isLight ? '#f8fafc' : '#0f172a',
        hubStroke: isLight ? '#cbd5e1' : '#334155',
        hubText: isLight ? '#1e293b' : '#e2e8f0',
        iconBox: isLight
          ? 'bg-slate-100 border-slate-300 text-slate-800'
          : 'bg-slate-900 border-slate-700 text-slate-200',
        badge: isLight
          ? 'border-slate-300 bg-slate-100 text-slate-800'
          : 'border-slate-700 bg-slate-900 text-slate-200',
      };
    default:
      return {
        text: isLight ? 'text-sky-700' : 'text-cyan-400',
        barPrimary: isLight ? 'bg-sky-600' : 'bg-cyan-500',
        barSecondary: isLight ? 'bg-emerald-600' : 'bg-emerald-400',
        polyFill: isLight ? 'rgba(14, 165, 233, 0.16)' : 'rgba(34, 211, 238, 0.18)',
        polyStroke: isLight ? '#0284c7' : '#22d3ee',
        hubFill: isLight ? '#f0f9ff' : '#0d121f',
        hubStroke: isLight ? '#7dd3fc' : '#1e293b',
        hubText: isLight ? '#0369a1' : '#38bdf8',
        iconBox: isLight
          ? 'bg-sky-50 border-sky-200 text-sky-700'
          : 'bg-cyan-950/50 border-cyan-500/35 text-cyan-400',
        badge: isLight
          ? 'border-sky-200 bg-sky-50 text-sky-800'
          : 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300',
      };
  }
}

/**
 * Compact 13+ year Career Trajectory Bar + 5-Axis Multi-Cloud & AI Mini-Radar.
 * Designed with pure SVG + explicit hex/theme classes so both Dark Theme and
 * Light Paper PDF exports render crisply via html2canvas-pro.
 */
export function CvTrajectoryAndCloudStrip({ isLight, accent = 'cyan' }: ThemeProps) {
  const palette = getInfographicAccent(isLight, accent);
  const pillars = useMemo(() => {
    const aws = CERTIFICATIONS.filter((c) => c.issuer.includes('Amazon Web Services')).length;
    const azure = CERTIFICATIONS.filter((c) => c.issuer === 'Microsoft').length;
    const gcp = CERTIFICATIONS.filter((c) => c.issuer === 'Google').length;
    const databricks = CERTIFICATIONS.filter((c) => c.issuer === 'Databricks').length;
    const appliedAi = CERTIFICATIONS.filter(
      (c) =>
        !c.issuer.includes('Amazon Web Services') &&
        c.issuer !== 'Microsoft' &&
        c.issuer !== 'Google' &&
        c.issuer !== 'Databricks'
    ).length;

    return [
      { id: 'aws', label: 'AWS', count: aws, color: isLight ? '#d97706' : '#f59e0b' },
      { id: 'azure', label: 'Azure', count: azure, color: isLight ? '#0284c7' : '#38bdf8' },
      { id: 'gcp', label: 'GCP', count: gcp, color: isLight ? '#059669' : '#34d399' },
      { id: 'db', label: 'Databricks', count: databricks, color: isLight ? '#e11d48' : '#fb7185' },
      { id: 'ai', label: 'Applied AI', count: appliedAi, color: isLight ? '#7c3aed' : '#a78bfa' },
    ];
  }, [isLight]);

  const maxCount = Math.max(...pillars.map((p) => p.count), 1);
  const cx = 120;
  const cy = 98;
  const maxR = 58;

  const vertices = pillars.map((p, idx) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / pillars.length;
    const norm = 0.42 + (p.count / maxCount) * 0.58;
    const r = maxR * norm;
    const labelR = maxR + 22;
    return {
      ...p,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      outerX: cx + maxR * Math.cos(angle),
      outerY: cy + maxR * Math.sin(angle),
      labelX: cx + labelR * Math.cos(angle),
      labelY: cy + labelR * Math.sin(angle),
    };
  });

  const polygonPoints = vertices.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');

  const timelineSegments = [
    {
      org: 'Tata Consultancy Services',
      short: 'TCS',
      years: '2012 — 2019',
      span: '7 yrs',
      pct: 49,
      role: 'Systems Eng. → IT Analyst',
      barColor: isLight ? 'bg-slate-400' : 'bg-slate-600',
    },
    {
      org: 'HCL America Inc. / HCLTech',
      short: 'HCL',
      years: '2020 — Present',
      span: '6+ yrs',
      pct: 36,
      role: 'Tech Lead → Lead Architect',
      barColor: palette.barPrimary,
    },
    {
      org: 'Cisco Systems Inc. STO',
      short: 'Cisco STO',
      years: 'Project Atlas',
      span: 'Flagship',
      pct: 15,
      role: 'Security Data Platform',
      barColor: palette.barSecondary,
    },
  ];

  const cardCls = isLight
    ? 'border-slate-200 bg-slate-50/70'
    : 'border-slate-800 bg-[#0a0f1c]/90';
  const headingCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-600' : 'text-slate-400';
  const accentCls = palette.text;
  const dividerCls = isLight ? 'border-slate-200' : 'border-slate-800/80';

  return (
    <div
      data-pdf-block
      className="pdf-keep-together grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 pdf-cols-12 gap-4"
    >
      {/* Left: 13+ Year Career Trajectory Bar */}
      <div
        data-pdf-subblock
        className={`md:col-span-7 print:col-span-7 pdf-span-7 rounded-xl border p-4 flex flex-col justify-between ${cardCls}`}
      >
        <div>
          <div className={`flex items-center justify-between gap-2 pb-2.5 border-b ${dividerCls}`}>
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider ${accentCls}`}>
              <Building2 className="w-3.5 h-3.5" />
              <span>13+ Year Career Trajectory · US · UK · India</span>
            </span>
            <span className={`text-[10px] font-mono ${mutedCls}`}>2012 → 2026</span>
          </div>

          {/* Stacked proportional progression bar */}
          <div
            className={`mt-3.5 h-3 w-full rounded-full overflow-hidden flex gap-0.5 p-0.5 border ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#06080d] border-slate-800'
            }`}
          >
            {timelineSegments.map((seg) => (
              <div
                key={seg.short}
                style={{ width: `${seg.pct}%` }}
                className={`h-full rounded-full ${seg.barColor}`}
                title={`${seg.org} (${seg.years})`}
              />
            ))}
          </div>

          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {timelineSegments.map((seg) => (
              <div
                key={seg.short}
                className={`rounded-lg border p-2.5 ${
                  isLight ? 'border-slate-200 bg-white' : 'border-slate-800/90 bg-[#090d16]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-display font-bold ${headingCls}`}>
                    {seg.short}
                  </span>
                  <span className={`text-[10px] font-mono ${accentCls}`}>{seg.span}</span>
                </div>
                <div className={`text-[10px] font-mono mt-0.5 ${mutedCls}`}>{seg.years}</div>
                <div className={`text-[10px] mt-1 leading-snug ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  {seg.role}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`mt-3 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono ${dividerCls} ${mutedCls}`}>
          <span>3 Global Delivery Regions</span>
          <span className={accentCls}>Continuous Progression · Zero Gaps</span>
        </div>
      </div>

      {/* Right: Compact 5-Axis Multi-Cloud & AI Balance Mini-Radar */}
      <div
        data-pdf-subblock
        className={`md:col-span-5 print:col-span-5 pdf-span-5 rounded-xl border p-4 flex flex-col justify-between ${cardCls}`}
      >
        <div className={`flex items-center justify-between gap-2 pb-2 border-b ${dividerCls}`}>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider ${accentCls}`}>
            <Radar className="w-3.5 h-3.5" />
            <span>Cloud &amp; AI Radar</span>
          </span>
          <span className={`text-[10px] font-mono tabular-nums ${mutedCls}`}>
            {CERTIFICATIONS.length} Verified
          </span>
        </div>

        <div className="flex items-center justify-center my-1">
          <svg
            viewBox="0 0 240 198"
            className="w-full max-w-[235px] h-auto"
            role="img"
            aria-label="Multi-cloud and AI certification distribution radar"
          >
            {[0.33, 0.66, 1].map((step) => (
              <circle
                key={step}
                cx={cx}
                cy={cy}
                r={maxR * step}
                fill="none"
                stroke={isLight ? '#cbd5e1' : '#1e293b'}
                strokeWidth="1"
                strokeDasharray={step === 1 ? undefined : '3 3'}
              />
            ))}
            {vertices.map((v) => (
              <line
                key={v.id}
                x1={cx}
                y1={cy}
                x2={v.outerX}
                y2={v.outerY}
                stroke={isLight ? '#e2e8f0' : '#1e293b'}
                strokeWidth="1"
              />
            ))}
            <polygon
              points={polygonPoints}
              fill={palette.polyFill}
              stroke={palette.polyStroke}
              strokeWidth="1.8"
            />
            {vertices.map((v) => (
              <g key={`node-${v.id}`}>
                <circle
                  cx={v.x}
                  cy={v.y}
                  r="4"
                  fill={v.color}
                  stroke={isLight ? '#ffffff' : '#06080d'}
                  strokeWidth="1.5"
                />
                <text
                  x={v.labelX}
                  y={v.labelY - 1}
                  textAnchor="middle"
                  className="font-display text-[9px] font-bold"
                  fill={isLight ? '#0f172a' : '#e2e8f0'}
                >
                  {v.label} ({v.count})
                </text>
              </g>
            ))}
            <circle
              cx={cx}
              cy={cy}
              r="16"
              fill={palette.hubFill}
              stroke={palette.hubStroke}
              strokeWidth="1.2"
            />
            <text
              x={cx}
              y={cy + 3.5}
              textAnchor="middle"
              className="font-display text-[10px] font-extrabold tabular-nums"
              fill={palette.hubText}
            >
              {CERTIFICATIONS.length}x
            </text>
          </svg>
        </div>

        <div className={`text-[10px] font-mono text-center ${mutedCls}`}>
          AWS · Azure · GCP · Databricks · Applied AI
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Honors & 360 Endorsement Distribution Strip embedded in Awards section.
 */
export function CvImpactProofStrip({ isLight, accent = 'cyan' }: ThemeProps) {
  const palette = getInfographicAccent(isLight, accent);
  const totalProofs = AWARDS.length + LINKEDIN_RECOMMENDATIONS.length;
  const orgCounts = AWARDS_BY_ORGANIZATION.map((g) => ({
    label: g.organization.includes('Cisco')
      ? 'Cisco'
      : g.organization.includes('HCL')
        ? 'HCL'
        : 'TCS',
    count: g.awards.length,
  }));

  const managerCount = LINKEDIN_RECOMMENDATIONS.filter((r) => r.relationshipType === 'manager').length;
  const reportCount = LINKEDIN_RECOMMENDATIONS.filter((r) => r.relationshipType === 'direct_report').length;
  const peerCount = LINKEDIN_RECOMMENDATIONS.filter((r) => r.relationshipType === 'peer').length;

  return (
    <div
      data-pdf-block
      className={`pdf-keep-together rounded-xl border p-4 flex flex-col sm:flex-row pdf-row-sm sm:items-center justify-between gap-4 ${
        isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0d121f]/80'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${palette.iconBox}`}
        >
          <Trophy className="w-4 h-4" />
        </div>
        <div>
          <div className={`text-xs font-display font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {totalProofs} Verified Recognition Proof Points
          </div>
          <div className={`text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {AWARDS.length} Corporate Citations + {LINKEDIN_RECOMMENDATIONS.length} Signed LinkedIn Endorsements
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
        {orgCounts.map((o) => (
          <span
            key={o.label}
            className={`px-2 py-0.5 rounded border ${
              isLight
                ? 'border-slate-200 bg-slate-50 text-slate-700'
                : 'border-slate-800 bg-[#090d16] text-slate-300'
            }`}
          >
            {o.label}: <strong className={palette.text}>{o.count}</strong>
          </span>
        ))}
        <span
          className={`px-2 py-0.5 rounded border ${
            isLight
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
          }`}
        >
          Managers {managerCount} · Peers {peerCount} · Reports {reportCount}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact Verification QR Code Badge rendered inside the CV Footer (screen & exported PDF).
 */
export function CvVerificationQrBadge({ isLight, accent = 'cyan' }: ThemeProps) {
  const palette = getInfographicAccent(isLight, accent);
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(PORTFOLIO_CANONICAL_URL, {
      width: 144,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#06080d',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl('');
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className={`mt-4 pt-4 border-t flex flex-wrap items-center justify-between gap-3 ${
        isLight ? 'border-slate-200' : 'border-slate-800/80'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {qrUrl ? (
          <div className="p-1 rounded-lg bg-white border border-slate-200 shrink-0 shadow-xs">
            <img
              src={qrUrl}
              alt="QR code to Mohammed Sufyan live interactive portfolio"
              className="w-11 h-11 block"
            />
          </div>
        ) : (
          <div
            className={`w-12 h-12 rounded-lg border flex items-center justify-center shrink-0 ${
              isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-slate-800 bg-[#0d121f] text-cyan-400'
            }`}
          >
            <QrCode className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${palette.text}`}>
            Scan to Verify Credentials &amp; Live Portfolio
          </div>
          <div className={`text-[11px] font-mono truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {PORTFOLIO_CANONICAL_URL.replace('https://', '')} · Interactive Radar, Verified Certs &amp; 23 Signed Quotes
          </div>
        </div>
      </div>

      <span
        className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${palette.badge}`}
      >
        Verified Interactive Edition
      </span>
    </div>
  );
}
