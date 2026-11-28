import { brandMarkSvgSnippet } from '../brand/brandMark';
import { PERSONAL_INFO } from '../data/portfolioData';

export type ShareTrackId = 'executive' | 'security' | 'platform' | 'ai';

export interface ShareCardTrack {
  id: ShareTrackId;
  label: string;
  headline: string;
  subline: string;
  kicker: string;
  metrics: readonly [string, string, string];
  shareQuery: string;
}

const EXPERIENCE_YEARS = PERSONAL_INFO.experienceYears;

export const SHARE_CARD_TRACKS: readonly ShareCardTrack[] = [
  {
    id: 'executive',
    label: 'Executive',
    headline: 'Mohammed Sufyan',
    subline: 'Software Engineer · Cisco Systems Inc. STO CTO Operations',
    kicker: `${EXPERIENCE_YEARS} Yrs · Multi-Cloud & Security Data Platforms · US / UK / India`,
    metrics: [`${EXPERIENCE_YEARS} Years`, '20x Certified', '9.5/10 CGPA'],
    shareQuery: '',
  },
  {
    id: 'security',
    label: 'Security & Zero Trust',
    headline: 'Mohammed Sufyan · Portfolio Architecture',
    subline: 'Project Atlas Security Data Platform · Zero Trust & Vulnerability Engines',
    kicker: 'Cisco STO CTO Ops · Governance, Compliance & Policy Enforcement',
    metrics: ['Zero Trust', 'Project Atlas', '20x Certified'],
    shareQuery: '?cv=security&theme=dark',
  },
  {
    id: 'platform',
    label: 'Multi-Cloud Platform',
    headline: 'Mohammed Sufyan · Multi-Cloud Systems',
    subline: 'AWS · Azure · GCP · Kubernetes (EKS / AKS / GKE) & DevSecOps',
    kicker: 'Enterprise Infrastructure · High-Throughput Telemetry & SRE',
    metrics: ['AWS · Azure · GCP', 'Kubernetes', `${EXPERIENCE_YEARS} Yrs`],
    shareQuery: '?cv=platform&theme=dark',
  },
  {
    id: 'ai',
    label: 'Data & Applied AI',
    headline: 'Mohammed Sufyan · Data & Applied AI',
    subline: 'Databricks Lakehouse · Autonomous Agentic Workflows & Python',
    kicker: 'Auditable AI Pipelines · Governed Security Analytics',
    metrics: ['Databricks', 'Agentic AI', '23 Endorsements'],
    shareQuery: '?skill=Databricks',
  },
];

export function buildDynamicSocialSvg(options: {
  track?: ShareTrackId;
  theme?: 'dark' | 'light';
  skillLabel?: string;
}): string {
  const track =
    SHARE_CARD_TRACKS.find((t) => t.id === options.track) ?? SHARE_CARD_TRACKS[0];
  const isLight = options.theme === 'light';
  const skill = options.skillLabel?.trim();

  const bg = isLight ? '#f8fafc' : '#06080d';
  const cardBg = isLight ? '#ffffff' : '#0b111f';
  const border = isLight ? '#cbd5e1' : '#1e293b';
  const titleColor = isLight ? '#0f172a' : '#f8fafc';
  const subColor = isLight ? '#334155' : '#cbd5e1';
  const mutedColor = isLight ? '#64748b' : '#94a3b8';
  const accent = isLight ? '#0284c7' : '#38bdf8';
  const accentSoft = isLight ? '#e0f2fe' : '#082f49';
  const accentBorder = isLight ? '#7dd3fc' : '#0ea5e9';
  const gridDot = isLight ? 'rgba(2,132,199,0.14)' : 'rgba(56,189,248,0.14)';

  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const safeHeadline = escapeXml(
    skill ? `Mohammed Sufyan · ${skill}` : track.headline
  );
  const safeSubline = escapeXml(
    skill
      ? `Verified Architecture, Production Delivery & Credentials in ${skill}`
      : track.subline
  );
  const safeKicker = escapeXml(track.kicker);

  const pills = track.metrics
    .map((metric, idx) => {
      const x = 96 + idx * 245;
      return `
      <g transform="translate(${x}, 442)">
        <rect width="225" height="54" rx="12" fill="${accentSoft}" stroke="${accentBorder}" stroke-opacity="0.45" />
        <text x="112.5" y="34" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" font-weight="700" fill="${accent}">${escapeXml(metric)}</text>
      </g>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.3" fill="${gridDot}" />
    </pattern>
    <radialGradient id="glow" cx="82%" cy="22%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="${isLight ? '0.14' : '0.20'}" />
      <stop offset="100%" stop-color="${bg}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${bg}" />
  <rect width="1200" height="630" fill="url(#dots)" />
  <rect width="1200" height="630" fill="url(#glow)" />
  <rect x="44" y="44" width="1112" height="542" rx="28" fill="${cardBg}" fill-opacity="0.94" stroke="${border}" stroke-width="1.5" />

  <!-- Brand Mark -->
  ${brandMarkSvgSnippet(96, 96, 56)}

  <text x="172" y="120" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" font-weight="700" letter-spacing="2.2" fill="${accent}">VERIFIED ARCHITECT PORTFOLIO</text>
  <text x="172" y="145" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" fill="${mutedColor}">www.mohammedsufyan.com</text>

  <!-- Main Title -->
  <text x="96" y="246" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="800" letter-spacing="-1" fill="${titleColor}">${safeHeadline}</text>
  <text x="96" y="302" font-family="system-ui, -apple-system, sans-serif" font-size="25" font-weight="500" fill="${subColor}">${safeSubline}</text>
  <text x="96" y="346" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" fill="${mutedColor}">${safeKicker}</text>

  <!-- Hairline -->
  <line x1="96" y1="398" x2="1104" y2="398" stroke="${border}" stroke-width="1" />

  ${pills}

  <text x="96" y="544" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="${mutedColor}">Cisco Systems Inc. · HCL America Inc. / HCLTech · Tata Consultancy Services</text>
  <text x="1104" y="544" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" font-weight="600" fill="${accent}">San Jose, CA · Global</text>
</svg>`;
}
