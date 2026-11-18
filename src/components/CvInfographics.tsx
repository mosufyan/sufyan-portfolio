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

interface ThemeProps {
  isLight: boolean;
}

/**
 * Compact 13+ year Career Trajectory Bar + 5-Axis Multi-Cloud & AI Mini-Radar.
 * Designed with pure SVG + explicit hex/theme classes so both Dark Theme and
 * Light Paper PDF exports render crisply via html2canvas-pro.
 */
export function CvTrajectoryAndCloudStrip({ isLight }: ThemeProps) {
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
      barColor: isLight ? 'bg-sky-600' : 'bg-cyan-500',
    },
    {
      org: 'Cisco Systems Inc. STO',
      short: 'Cisco STO',
      years: 'Project Atlas',
      span: 'Flagship',
      pct: 15,
      role: 'Security Data Platform',
      barColor: isLight ? 'bg-emerald-600' : 'bg-emerald-400',
    },
  ];

  const cardCls = isLight
    ? 'border-slate-200 bg-slate-50/70'
    : 'border-slate-800 bg-[#0a0f1c]/90';
  const headingCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-600' : 'text-slate-400';
  const accentCls = isLight ? 'text-sky-700' : 'text-cyan-400';
  const dividerCls = isLight ? 'border-slate-200' : 'border-slate-800/80';

  return (
    <div
      data-pdf-block
      className="pdf-keep-together grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 pdf-cols-12 gap-4"
    >
      {/* Left: 13+ Year Career Trajectory Bar */}
      <div
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
              fill={isLight ? 'rgba(14, 165, 233, 0.16)' : 'rgba(34, 211, 238, 0.18)'}
              stroke={isLight ? '#0284c7' : '#22d3ee'}
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
              fill={isLight ? '#f0f9ff' : '#0d121f'}
              stroke={isLight ? '#7dd3fc' : '#1e293b'}
              strokeWidth="1.2"
            />
            <text
              x={cx}
              y={cy + 3.5}
              textAnchor="middle"
              className="font-display text-[10px] font-extrabold tabular-nums"
              fill={isLight ? '#0369a1' : '#38bdf8'}
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
export function CvImpactProofStrip({ isLight }: ThemeProps) {
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
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
            isLight
              ? 'bg-sky-50 border-sky-200 text-sky-700'
              : 'bg-cyan-950/50 border-cyan-500/35 text-cyan-400'
          }`}
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
            {o.label}: <strong className={isLight ? 'text-sky-700' : 'text-cyan-400'}>{o.count}</strong>
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
export function CvVerificationQrBadge({ isLight }: ThemeProps) {
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
          <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${isLight ? 'text-sky-700' : 'text-cyan-400'}`}>
            Scan to Verify Credentials &amp; Live Portfolio
          </div>
          <div className={`text-[11px] font-mono truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {PORTFOLIO_CANONICAL_URL.replace('https://', '')} · Interactive Radar, Verified Certs &amp; 23 Signed Quotes
          </div>
        </div>
      </div>

      <span
        className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
          isLight
            ? 'border-sky-200 bg-sky-50 text-sky-800'
            : 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300'
        }`}
      >
        Verified Interactive Edition
      </span>
    </div>
  );
}
