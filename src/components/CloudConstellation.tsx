import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle, ExternalLink, Radar, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { CERTIFICATIONS, Certification } from '../data/portfolioData';
import { useTheme } from '../theme/ThemeProvider';
import IssuerMark from './IssuerMark';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface CloudConstellationProps {
  onSelectCertification: (cert: Certification) => void;
  onFilterGridByProvider: (query: string) => void;
}

interface ProviderPillar {
  id: 'aws' | 'azure' | 'gcp' | 'databricks' | 'ai-academy';
  label: string;
  shortLabel: string;
  searchToken: string;
  description: string;
  accentDark: string;
  accentLight: string;
  certs: Certification[];
}

export default function CloudConstellation({
  onSelectCertification,
  onFilterGridByProvider,
}: CloudConstellationProps) {
  const { isLight, theme } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  const pillars = useMemo<ProviderPillar[]>(() => {
    const awsCerts = CERTIFICATIONS.filter((c) => c.issuer.includes('Amazon Web Services'));
    const azureCerts = CERTIFICATIONS.filter((c) => c.issuer === 'Microsoft');
    const gcpCerts = CERTIFICATIONS.filter((c) => c.issuer === 'Google');
    const dbCerts = CERTIFICATIONS.filter((c) => c.issuer === 'Databricks');
    const academyCerts = CERTIFICATIONS.filter(
      (c) =>
        !c.issuer.includes('Amazon Web Services') &&
        c.issuer !== 'Microsoft' &&
        c.issuer !== 'Google' &&
        c.issuer !== 'Databricks'
    );

    return [
      {
        id: 'aws',
        label: 'Amazon Web Services',
        shortLabel: 'AWS',
        searchToken: 'AWS',
        description: 'DevOps Engineer Professional, Solutions Architect Associate, Cloud Practitioner & GenAI.',
        accentDark: '#f59e0b',
        accentLight: '#d97706',
        certs: awsCerts,
      },
      {
        id: 'azure',
        label: 'Microsoft Azure',
        shortLabel: 'Azure',
        searchToken: 'Microsoft',
        description: 'DevOps Engineer Expert (AZ-400), Architect Solutions, Administrator & Data Fundamentals.',
        accentDark: '#38bdf8',
        accentLight: '#0284c7',
        certs: azureCerts,
      },
      {
        id: 'gcp',
        label: 'Google Cloud',
        shortLabel: 'GCP',
        searchToken: 'Google',
        description: 'Associate Cloud Engineer & Generative AI Leader across GCP security & compute.',
        accentDark: '#34d399',
        accentLight: '#059669',
        certs: gcpCerts,
      },
      {
        id: 'databricks',
        label: 'Databricks',
        shortLabel: 'Databricks',
        searchToken: 'Databricks',
        description: 'Generative AI Fundamentals & Building AI Agents on Lakehouse architecture.',
        accentDark: '#fb7185',
        accentLight: '#e11d48',
        certs: dbCerts,
      },
      {
        id: 'ai-academy',
        label: 'AI & SecOps Academies',
        shortLabel: 'Applied AI',
        searchToken: 'AI',
        description: 'Applied GenAI, Agentic Systems, Prompt Engineering & Python Data Science credentials.',
        accentDark: '#a78bfa',
        accentLight: '#7c3aed',
        certs: academyCerts,
      },
    ];
  }, []);

  const [selectedPillarId, setSelectedPillarId] = useState<ProviderPillar['id']>('aws');
  const activePillar = pillars.find((p) => p.id === selectedPillarId) ?? pillars[0];

  const maxCount = Math.max(...pillars.map((p) => p.certs.length), 1);
  const cx = 210;
  const cy = 200;
  const maxRadius = 128;

  // Compute 5 radar vertex coordinates evenly spaced around the circle starting at top (-90 deg)
  const vertices = pillars.map((pillar, idx) => {
    const angle = (-Math.PI / 2) + (idx * 2 * Math.PI) / pillars.length;
    // Scale radius cleanly between 42% and 100% so even 2-cert pillars remain visually balanced
    const normalized = 0.42 + (pillar.certs.length / maxCount) * 0.58;
    const r = maxRadius * normalized;
    const labelR = maxRadius + 38;
    return {
      pillar,
      angle,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      outerX: cx + maxRadius * Math.cos(angle),
      outerY: cy + maxRadius * Math.sin(angle),
      labelX: cx + labelR * Math.cos(angle),
      labelY: cy + labelR * Math.sin(angle),
    };
  });

  const polygonPoints = vertices.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left: Interactive 5-Pillar Multi-Cloud Radar */}
      <div
        className={`lg:col-span-6 rounded-2xl border p-5 sm:p-6 flex flex-col justify-between ${
          isLight
            ? 'border-slate-200 bg-white shadow-lg shadow-slate-200/50'
            : 'border-slate-800 bg-[#0a0f1c]/90 shadow-xl'
        }`}
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400">
            <Radar className="w-4 h-4" />
            <span>Multi-Cloud &amp; AI Mastery Radar</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
            {CERTIFICATIONS.length} Verified Credentials
          </div>
        </div>

        <div className="my-4 flex items-center justify-center">
          <svg
            viewBox="0 0 420 400"
            className="w-full max-w-[400px] h-auto select-none"
            role="img"
            aria-label="5-pillar multi-cloud and AI certification radar chart"
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
              fill={isLight ? 'rgba(14, 165, 233, 0.16)' : 'rgba(34, 211, 238, 0.16)'}
              stroke={isLight ? '#0284c7' : '#22d3ee'}
              strokeWidth="2.2"
            />

            {/* Interactive Vendor Nodes */}
            {vertices.map((v) => {
              const isSelected = v.pillar.id === selectedPillarId;
              const accent = isLight ? v.pillar.accentLight : v.pillar.accentDark;
              return (
                <g
                  key={v.pillar.id}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${v.pillar.label} (${v.pillar.certs.length} certifications)`}
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
                      strokeOpacity="0.6"
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
                    {v.pillar.certs.length} certs
                  </text>
                </g>
              );
            })}

            {/* Center Badge */}
            <circle
              cx={cx}
              cy={cy}
              r="24"
              fill={isLight ? '#f0f9ff' : '#0d121f'}
              stroke={isLight ? '#7dd3fc' : '#1e293b'}
              strokeWidth="1.5"
            />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              className="font-display text-[14px] font-extrabold tabular-nums"
              fill={isLight ? '#0369a1' : '#38bdf8'}
            >
              20x
            </text>
          </svg>
        </div>

        {/* Bottom Pillar Quick Tabs */}
        <div
          className={`flex flex-wrap gap-1.5 pt-3 border-t ${
            isLight ? 'border-slate-200' : 'border-slate-800/80'
          }`}
        >
          {pillars.map((p) => {
            const active = p.id === selectedPillarId;
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
                {p.shortLabel} ({p.certs.length})
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Selected Cloud Provider Credential Breakdown */}
      <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0d121f]/80 p-5 sm:p-6 flex flex-col justify-between shadow-xl">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div>
              <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                {activePillar.label}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {activePillar.description}
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400 tabular-nums shrink-0">
              {activePillar.certs.length} Verified
            </span>
          </div>

          <div className="mt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {activePillar.certs.map((cert) => (
              <div
                key={cert.id}
                className="rounded-xl border border-slate-800/90 bg-[#090d16] p-3.5 hover:border-cyan-500/40 transition-colors flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <IssuerMark issuer={cert.issuer} size="sm" theme={theme} />
                    <span className="truncate text-cyan-400">{cert.issuer}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{cert.issueDate}</span>
                  </div>
                  <div className="text-sm font-display font-semibold text-white mt-1 leading-snug">
                    {cert.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono text-emerald-400">
                    <CheckCircle className="w-3 h-3 shrink-0" />
                    <span>{cert.credentialId ? `ID: ${cert.credentialId}` : 'Verified Record'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectCertification(cert)}
                    className="p-2 rounded-lg border border-slate-800 bg-slate-900 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-colors"
                    title="Inspect credential details"
                    aria-label={`Inspect ${cert.title}`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                  {cert.credentialUrl && (
                    <a
                      href={cert.credentialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg border border-cyan-500/35 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 transition-colors"
                      title="Open official verification URL"
                      aria-label={`Verify ${cert.title}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 mt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-mono text-slate-400">
            Click any badge above to verify ID &amp; skills
          </span>
          <button
            type="button"
            onClick={() => onFilterGridByProvider(activePillar.searchToken)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            <span>Open {activePillar.shortLabel} in Grid</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
