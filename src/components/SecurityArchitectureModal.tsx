import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Database,
  Eye,
  GitBranch,
  KeyRound,
  Layers,
  Lock,
  MessageSquare,
  MousePointerClick,
  Radar,
  Server,
  Shield,
  Sparkles,
  Workflow,
  X,
  XCircle,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import SecurityMermaidChart from './SecurityMermaidChart';

interface ControlStatus {
  turnstile: boolean;
  redis: boolean;
  adminWrites: boolean;
  mail: boolean;
  incidentMode: boolean;
  sentry: boolean;
  slackAlerts: boolean;
  sessionSecret: boolean;
  appCheck?: boolean;
  piiClientCreatesDenied?: boolean;
  cspReporting?: boolean;
  httpsIpIntel?: boolean;
  cloudflareEdge?: boolean;
  uaBlocklist?: boolean;
  honeypot?: boolean;
}

interface StatusPayload {
  ok: boolean;
  goldPathScore?: string;
  controls?: ControlStatus;
  metricsPath?: string;
}

interface SecurityArchitectureModalProps {
  open: boolean;
  onClose: () => void;
}

type HubTab = 'overview' | 'platform' | 'security' | 'flows' | 'readiness';
type LayerId = 'edge' | 'application' | 'data' | 'observability';
type DiagramTab = 'system' | 'flow' | 'otp' | 'chat';

interface LayerDetail {
  id: LayerId;
  title: string;
  icon: typeof Shield;
  color: string;
  barColor: string;
  summary: string;
  design: string[];
  items: string[];
}

interface PlatformPillar {
  id: string;
  title: string;
  icon: typeof Boxes;
  accent: string;
  summary: string;
  bullets: string[];
}

const HUB_TABS: Array<{ id: HubTab; label: string; icon: typeof Shield }> = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'platform', label: 'Platform', icon: Boxes },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'flows', label: 'Flows', icon: Workflow },
  { id: 'readiness', label: 'Live status', icon: Activity },
];

const LAYERS: LayerDetail[] = [
  {
    id: 'edge',
    title: 'Edge',
    icon: Radar,
    color: 'from-sky-500/25 to-cyan-500/10',
    barColor: 'bg-sky-400',
    summary: 'Stop bots and scrapers before they reach Cloud Run.',
    design: [
      'Cloudflare terminates TLS and applies Bot Fight / Block AI Bots.',
      'Turnstile challenges prove a human before OTP or CV flows.',
      'Origin allowlist + Sec-Fetch-Site reject cross-site browser abuse.',
      'Expanded UA denylist blocks known agent frameworks on contact / CV / chat.',
    ],
    items: [
      'Cloudflare proxy / Bot Fight / Block AI Bots / Turnstile',
      'Origin allowlist + Sec-Fetch-Site checks',
      'AI-agent + headless UA blocking on contact / CV / chat',
    ],
  },
  {
    id: 'application',
    title: 'Application',
    icon: Lock,
    color: 'from-violet-500/25 to-fuchsia-500/10',
    barColor: 'bg-violet-400',
    summary: 'Request-time policy: CSP, OTP, fail-closed quotas, incident switches.',
    design: [
      'CSP + HSTS harden the browser; production builds ship without source maps.',
      'HMAC OTP + MX verification binds lead/chat identity to a mailbox.',
      'Redis-backed rate limits fail closed when Upstash is unreachable.',
      'Chat receipt headers keep tokens out of query strings and logs.',
    ],
    items: [
      'CSP · HSTS · no production source maps',
      'HMAC OTP + MX verification for leads & chat',
      'Fail-closed Redis rate limits + shared chat quotas',
      'Chat receipt headers (no query-string tokens)',
      'Incident mode + per-feature visitor switches',
    ],
  },
  {
    id: 'data',
    title: 'Data',
    icon: Server,
    color: 'from-emerald-500/25 to-teal-500/10',
    barColor: 'bg-emerald-400',
    summary: 'Firestore deny-by-default; PII writes only via Admin SDK; CMS soft-delete safe.',
    design: [
      'Rules default-deny every collection; each path has an explicit schema.',
      'cv_downloads / contact_messages deny client creates — server Admin SDK only.',
      'Owner replies are admin-bound (no unbound mail relay).',
      'Announcement drafts stay private until published/scheduled.',
      'Portfolio CMS merges seed data with Firestore overrides; soft-deletes use portfolio_seed_hides + deleted==false public queries.',
      'Experience role payloads are schema-validated in rules; CMS writes emit cms_mutated audit events.',
    ],
    items: [
      'Firestore deny-by-default schemas',
      'Admin-bound owner replies (no unbound mail relay)',
      'Portfolio CMS + seed hides (no soft-delete body leak)',
      'Announcement visibility rules (drafts never public)',
    ],
  },
  {
    id: 'observability',
    title: 'Observability',
    icon: Eye,
    color: 'from-amber-500/25 to-orange-500/10',
    barColor: 'bg-amber-400',
    summary: 'Trace every request; Prometheus scrape; owner console for funnel, CRM, chat, audit.',
    design: [
      'X-Request-Id on every response + structured JSON logs (chat RAG / voice / CSP).',
      'GET /api/metrics exposes Prometheus counters; optional METRICS_TOKEN gate.',
      'Owner Console surfaces funnel, CRM triage, chat, CMS, and audit history.',
      'Optional Sentry DSN and Slack urgent/warning webhooks.',
      '/api/status exposes boolean gold-path readiness + observability snapshot — never secrets.',
      'Mermaid architecture SVGs are DOMPurify-sanitized before DOM insert.',
    ],
    items: [
      'X-Request-Id + structured JSON logs',
      'Prometheus GET /api/metrics (+ optional token)',
      'Owner Console funnel / CRM / CMS / chat / audit trail',
      'Optional Sentry DSN + Slack urgent/warning webhooks',
      'Gold-path checklist + observability on /api/status',
    ],
  },
];

const PLATFORM: PlatformPillar[] = [
  {
    id: 'client',
    title: 'Browser client',
    icon: Layers,
    accent: 'from-sky-500/30 to-cyan-500/10 border-sky-400/40',
    summary: 'React + Vite SPA with motion, PWA, CV Studio, and owner console.',
    bullets: [
      'Public portfolio, CV Studio, command palette, digital card',
      'Chat widget · voice agent · live owner handoff',
      'Owner Console: CMS, funnel, triage, site controls',
      'Theme: light/dark · cyan/amber accents',
    ],
  },
  {
    id: 'edge-api',
    title: 'Express API',
    icon: Cloud,
    accent: 'from-violet-500/30 to-fuchsia-500/10 border-violet-400/40',
    summary: 'Cloud Run origin with security middleware and feature APIs.',
    bullets: [
      'CSP · origin · Turnstile · honeypot · UA denylist',
      '/api/chat · /api/contact · /api/cv-* · /api/owner/* · /api/metrics',
      'HMAC OTP + MX verification on gated flows',
      'Fail-closed Upstash rate limits & shared quotas',
    ],
  },
  {
    id: 'persistence',
    title: 'Persistence',
    icon: Database,
    accent: 'from-emerald-500/30 to-teal-500/10 border-emerald-400/40',
    summary: 'Firestore + Redis with deny-by-default rules and CMS merge.',
    bullets: [
      'Firestore: leads, CV logs, announcements, portfolio_* CMS',
      'Seed hides + deleted==false for public CMS reads',
      'Upstash Redis: OTP, limits, policy, hot cache',
      'Owner metrics + chat cache across Cloud Run replicas',
    ],
  },
  {
    id: 'ai',
    title: 'AI & messaging',
    icon: MessageSquare,
    accent: 'from-amber-500/30 to-orange-500/10 border-amber-400/40',
    summary: 'Grounded chat, dual voice (PTT + Live S2S), and transactional mail.',
    bullets: [
      'Upstash Vector RAG + keyword hybrid fallback',
      'Grok enrich · Live S2S (wss://api.x.ai) · Groq Whisper · ElevenLabs',
      'Resend / SMTP for OTP and owner replies',
      'Cloudflare Turnstile on registration / OTP gates',
    ],
  },
];

const SYSTEM_CHART = `flowchart TB
  subgraph Client["Browser"]
    UI["Portfolio UI"]
    Chat["Chat · Voice"]
    Owner["Owner Console · CMS"]
  end
  subgraph Edge["Cloudflare + Cloud Run"]
    CF["Edge · Turnstile · Bots"]
    API["Express API\\nCSP · OTP · Quotas"]
  end
  subgraph Data["Persistence"]
    FS[("Firestore")]
    Redis[("Upstash Redis")]
    Vec[("Vector RAG")]
  end
  subgraph AI["Intelligence"]
    Grok["Grok"]
    Groq["Whisper"]
    EL["ElevenLabs"]
    Mail["Resend / SMTP"]
  end
  UI --> CF --> API
  Chat --> API
  Owner --> API
  Owner --> FS
  API --> FS
  API --> Redis
  API --> Vec
  API --> Grok
  API --> Groq
  API --> EL
  API --> Mail
  classDef client fill:#083344,stroke:#22d3ee,color:#e2e8f0
  classDef edge fill:#2e1065,stroke:#c084fc,color:#e2e8f0
  classDef data fill:#052e16,stroke:#34d399,color:#e2e8f0
  classDef ai fill:#451a03,stroke:#fbbf24,color:#e2e8f0
  class UI,Chat,Owner client
  class CF,API edge
  class FS,Redis,Vec data
  class Grok,Groq,EL,Mail ai`;

const FLOW_CHART = `flowchart LR
  V["Visitor / Bot"] --> E["Edge\\nCloudflare + Turnstile"]
  E --> A["Application\\nCSP · OTP · Redis"]
  A --> D["Data\\nFirestore · CMS"]
  A --> O["Observability\\nLogs · Metrics · Sentry"]
  D --> O
  classDef edge fill:#083344,stroke:#22d3ee,color:#e2e8f0
  classDef app fill:#2e1065,stroke:#c084fc,color:#e2e8f0
  classDef data fill:#052e16,stroke:#34d399,color:#e2e8f0
  classDef obs fill:#451a03,stroke:#fbbf24,color:#e2e8f0
  classDef visitor fill:#1e3a8a,stroke:#60a5fa,color:#e2e8f0
  class V visitor
  class E edge
  class A app
  class D data
  class O obs`;

const OTP_SEQUENCE = `sequenceDiagram
  autonumber
  actor U as Visitor
  participant E as Edge
  participant A as App
  participant R as Redis
  participant M as Mail
  U->>E: Submit email
  E->>A: Turnstile + honeypot OK
  A->>R: Rate-limit + store challenge
  A->>M: Send HMAC OTP
  Note over M,U: 6-digit code · MX verified
  U->>A: Submit OTP
  A->>R: Verify + consume
  A-->>U: Verified session / receipt`;

const CHAT_SEQUENCE = `sequenceDiagram
  autonumber
  actor V as Visitor
  participant W as ChatWidget
  participant API as Express
  participant Vec as Vector
  participant LLM as Grok
  participant Own as Owner
  V->>W: Ask / live request
  W->>API: OTP gate + receipt header
  API->>Vec: Retrieve grounded chunks
  opt LLM enabled
    API->>LLM: Enrich from context
  end
  API-->>W: Answer + follow-ups
  opt Live handoff
    Own->>API: Presence + reply
    API-->>W: Owner message
  end`;

const CONTROL_META: Array<{
  key: keyof ControlStatus;
  label: string;
  layer: LayerId;
  detail: string;
}> = [
  { key: 'turnstile', label: 'Turnstile', layer: 'edge', detail: 'Cloudflare Turnstile human challenge on OTP-gated flows.' },
  { key: 'cloudflareEdge', label: 'CF Edge', layer: 'edge', detail: 'Detected Cloudflare proxy headers at origin.' },
  { key: 'uaBlocklist', label: 'UA block', layer: 'edge', detail: 'Agent / headless user-agent denylist active.' },
  { key: 'honeypot', label: 'Honeypot', layer: 'edge', detail: 'Hidden form field traps scripted bots.' },
  { key: 'redis', label: 'Redis', layer: 'application', detail: 'Upstash Redis shared limits across Cloud Run replicas.' },
  { key: 'sessionSecret', label: 'Session', layer: 'application', detail: 'SESSION_SECRET configured for signed cookies.' },
  { key: 'mail', label: 'Mail', layer: 'application', detail: 'Transactional mail provider ready for OTP / replies.' },
  { key: 'incidentMode', label: 'Incident', layer: 'application', detail: 'Incident mode flag available (locks visitor features when on).' },
  { key: 'adminWrites', label: 'Admin SDK', layer: 'data', detail: 'Server Admin SDK path for PII writes enabled.' },
  { key: 'piiClientCreatesDenied', label: 'PII deny', layer: 'data', detail: 'Client creates denied on PII collections in rules.' },
  { key: 'appCheck', label: 'App Check', layer: 'data', detail: 'App Check site key present for attested clients.' },
  { key: 'sentry', label: 'Sentry', layer: 'observability', detail: 'Error telemetry DSN configured.' },
  { key: 'slackAlerts', label: 'Slack', layer: 'observability', detail: 'Urgent/warning Slack webhooks configured.' },
  { key: 'cspReporting', label: 'CSP report', layer: 'observability', detail: 'CSP violation reporting endpoint wired.' },
  { key: 'httpsIpIntel', label: 'IP intel', layer: 'observability', detail: 'HTTPS IP intelligence enrichment available.' },
];

function StatusPill({
  ok,
  label,
  onClick,
  active,
  isLight,
}: {
  ok: boolean;
  label: string;
  onClick?: () => void;
  active?: boolean;
  isLight: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono uppercase tracking-wide transition-colors cursor-pointer ${
        active
          ? isLight
            ? 'border-sky-500 bg-sky-100 text-sky-800'
            : 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
          : ok
            ? isLight
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400'
              : 'border-emerald-500/35 bg-emerald-950/40 text-emerald-300 hover:border-emerald-400/50'
            : isLight
              ? 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300'
              : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </button>
  );
}

function mapDiagramNode(nodeId: string): LayerId | null {
  const id = nodeId.toLowerCase();
  if (
    id.includes('edge') ||
    id.includes('cloudflare') ||
    id.includes('turnstile') ||
    id === 'e' ||
    id === 'cf'
  ) {
    return 'edge';
  }
  if (
    id.includes('application') ||
    id.includes('express') ||
    id.includes('app') ||
    id.includes('api') ||
    id.includes('otp') ||
    id.includes('redis') ||
    id.includes('mail') ||
    id.includes('chat') ||
    id === 'a' ||
    id === 'r' ||
    id === 'm' ||
    id === 'w'
  ) {
    return 'application';
  }
  if (
    id.includes('data') ||
    id.includes('firestore') ||
    id.includes('vector') ||
    id.includes('persist') ||
    id === 'd' ||
    id === 'fs' ||
    id === 'vec'
  ) {
    return 'data';
  }
  if (
    id.includes('observ') ||
    id.includes('sentry') ||
    id.includes('slack') ||
    id.includes('owner') ||
    id === 'o' ||
    id === 'own'
  ) {
    return 'observability';
  }
  return null;
}

export default function SecurityArchitectureModal({
  open,
  onClose,
}: SecurityArchitectureModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const { isLight } = useTheme();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [hubTab, setHubTab] = useState<HubTab>('overview');
  const [selectedLayer, setSelectedLayer] = useState<LayerId | null>('edge');
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const [diagramTab, setDiagramTab] = useState<DiagramTab>('system');
  const [selectedPlatform, setSelectedPlatform] = useState(PLATFORM[0].id);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void fetch('/api/status')
      .then(async (res) => {
        if (!res.ok) throw new Error('status unavailable');
        return (await res.json()) as StatusPayload;
      })
      .then((payload) => {
        if (!cancelled) setStatus(payload);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const controls = status?.controls;
  const activeLayer = LAYERS.find((l) => l.id === selectedLayer) || LAYERS[0];
  const activePlatform = PLATFORM.find((p) => p.id === selectedPlatform) || PLATFORM[0];

  const readinessBars = useMemo(() => {
    return CONTROL_META.map((meta) => {
      const ok = Boolean(controls?.[meta.key]);
      return { ...meta, ok };
    });
  }, [controls]);

  const readyCount = readinessBars.filter((b) => b.ok).length;
  const readyPct = readinessBars.length ? Math.round((readyCount / readinessBars.length) * 100) : 0;

  const layerStats = useMemo(() => {
    return LAYERS.map((layer) => {
      const items = readinessBars.filter((b) => b.layer === layer.id);
      const on = items.filter((b) => b.ok).length;
      const pct = items.length ? Math.round((on / items.length) * 100) : 0;
      return { layer, items, on, total: items.length, pct };
    });
  }, [readinessBars]);

  const shell = isLight
    ? 'border-slate-200 bg-white text-slate-900'
    : 'border-cyan-500/25 bg-[#070b14] text-slate-200';
  const panel = isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#0a101c]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const accentCls = isLight ? 'text-sky-700' : 'text-cyan-400';

  const activeChart =
    diagramTab === 'system'
      ? SYSTEM_CHART
      : diagramTab === 'flow'
        ? FLOW_CHART
        : diagramTab === 'otp'
          ? OTP_SEQUENCE
          : CHAT_SEQUENCE;

  const selectFromDiagram = (nodeId: string) => {
    const layer = mapDiagramNode(nodeId);
    if (layer) {
      setSelectedLayer(layer);
      setSelectedControl(null);
      setHubTab('security');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="site-overlay fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.2 }}
        >
          <button
            type="button"
            aria-label="Close portfolio architecture"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-arch-title"
            className={`relative w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border shadow-2xl ${shell}`}
            initial={shouldReduceMotion ? false : { y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { y: 16, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          >
            <div
              className={`sticky top-0 z-10 border-b backdrop-blur ${
                isLight ? 'border-slate-200 bg-white/95' : 'border-slate-800/80 bg-[#070b14]/95'
              }`}
            >
              <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3">
                <div className="min-w-0">
                  <p className={`text-[10px] font-mono uppercase tracking-[0.18em] ${accentCls}`}>
                    Interactive system map
                  </p>
                  <h2
                    id="portfolio-arch-title"
                    className={`font-display text-lg sm:text-xl font-bold tracking-tight ${titleCls}`}
                  >
                    Portfolio Architecture
                  </h2>
                  <p className={`mt-1 text-xs max-w-2xl ${mutedCls}`}>
                    Full stack — client, edge, API, data, AI, security, and live readiness. Click
                    cards and diagram nodes to explore. Booleans from{' '}
                    <code className={accentCls}>/api/status</code> — never secrets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className={`shrink-0 rounded-lg border p-2 transition-colors ${
                    isLight
                      ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      : 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                className="flex items-center gap-1 overflow-x-auto px-4 sm:px-5 pb-3"
                role="tablist"
                aria-label="Architecture sections"
              >
                {HUB_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = hubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setHubTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? isLight
                            ? 'bg-sky-600 text-white font-semibold'
                            : 'bg-cyan-500 text-slate-950 font-semibold'
                          : isLight
                            ? 'text-slate-600 hover:bg-slate-100'
                            : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4 sm:px-5 py-5 space-y-6">
              {hubTab === 'overview' && (
                <>
                  <section className={`rounded-xl border p-4 space-y-3 ${panel}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`flex items-center gap-2 text-sm font-semibold ${titleCls}`}>
                        <GitBranch className={`h-4 w-4 ${accentCls}`} />
                        System overview
                      </div>
                      <div className={`inline-flex items-center gap-1 text-[10px] font-mono ${mutedCls}`}>
                        <MousePointerClick className="h-3 w-3" />
                        Click a node → Security layer
                      </div>
                    </div>
                    <SecurityMermaidChart chart={SYSTEM_CHART} onNodeClick={selectFromDiagram} />
                  </section>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {PLATFORM.map((pillar) => {
                      const Icon = pillar.icon;
                      return (
                        <button
                          key={pillar.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlatform(pillar.id);
                            setHubTab('platform');
                          }}
                          className={`text-left rounded-xl border p-3 bg-gradient-to-br transition-all cursor-pointer hover:scale-[1.02] ${pillar.accent}`}
                        >
                          <Icon className={`h-4 w-4 mb-2 ${accentCls}`} />
                          <div className={`text-sm font-display font-semibold ${titleCls}`}>
                            {pillar.title}
                          </div>
                          <p className={`mt-1 text-[11px] leading-snug line-clamp-2 ${mutedCls}`}>
                            {pillar.summary}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
                      isLight ? 'border-sky-200 bg-sky-50/80' : 'border-cyan-500/25 bg-cyan-950/20'
                    }`}
                  >
                    <div>
                      <div className={`text-sm font-semibold ${titleCls}`}>Live gold-path readiness</div>
                      <p className={`text-[11px] ${mutedCls}`}>
                        {loading
                          ? 'Checking control plane…'
                          : `${readyCount}/${readinessBars.length} controls reporting ready`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHubTab('readiness')}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-mono font-semibold cursor-pointer ${
                        isLight
                          ? 'bg-sky-600 text-white'
                          : 'bg-cyan-500 text-slate-950'
                      }`}
                    >
                      <span className="text-lg tabular-nums">{readyPct}%</span>
                      View chart
                    </button>
                  </div>
                </>
              )}

              {hubTab === 'platform' && (
                <section className={`rounded-xl border p-4 space-y-4 ${panel}`}>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {PLATFORM.map((pillar) => {
                      const Icon = pillar.icon;
                      const active = selectedPlatform === pillar.id;
                      return (
                        <button
                          key={pillar.id}
                          type="button"
                          onClick={() => setSelectedPlatform(pillar.id)}
                          className={`text-left rounded-xl border p-3 bg-gradient-to-br transition-all cursor-pointer ${pillar.accent} ${
                            active
                              ? isLight
                                ? 'ring-2 ring-sky-400/50'
                                : 'ring-2 ring-cyan-500/40'
                              : ''
                          }`}
                        >
                          <Icon className={`h-4 w-4 mb-2 ${accentCls}`} />
                          <div className={`text-sm font-display font-semibold ${titleCls}`}>
                            {pillar.title}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activePlatform.id}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                      className={`rounded-xl border p-4 ${
                        isLight ? 'border-sky-200 bg-white' : 'border-slate-700 bg-[#070b14]'
                      }`}
                    >
                      <h3 className={`font-display font-semibold text-base ${titleCls}`}>
                        {activePlatform.title}
                      </h3>
                      <p className={`mt-1 text-xs ${mutedCls}`}>{activePlatform.summary}</p>
                      <ul className="mt-3 space-y-2">
                        {activePlatform.bullets.map((line) => (
                          <li key={line} className={`flex gap-2 text-[12px] leading-relaxed ${mutedCls}`}>
                            <ChevronRight className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${accentCls}`} />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  </AnimatePresence>
                </section>
              )}

              {hubTab === 'security' && (
                <section className={`rounded-xl border p-4 space-y-3 ${panel}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`flex items-center gap-2 text-sm font-semibold ${titleCls}`}>
                      <Shield className={`h-4 w-4 ${accentCls}`} />
                      Defense-in-depth layers
                    </div>
                    <div className={`inline-flex items-center gap-1 text-[10px] font-mono ${mutedCls}`}>
                      <MousePointerClick className="h-3 w-3" />
                      Click a stage
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {LAYERS.map((layer, index) => {
                      const Icon = layer.icon;
                      const active = selectedLayer === layer.id;
                      return (
                        <button
                          key={layer.id}
                          type="button"
                          onClick={() => {
                            setSelectedLayer(layer.id);
                            setSelectedControl(null);
                          }}
                          className={`text-left rounded-xl border p-3 transition-all cursor-pointer bg-gradient-to-br ${layer.color} ${
                            active
                              ? isLight
                                ? 'border-sky-500 ring-2 ring-sky-400/40'
                                : 'border-cyan-400/70 ring-2 ring-cyan-500/30'
                              : isLight
                                ? 'border-slate-200 hover:border-sky-300'
                                : 'border-slate-700 hover:border-cyan-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`text-[10px] font-mono ${mutedCls}`}>0{index + 1}</span>
                            <Icon className={`h-4 w-4 ${accentCls}`} />
                          </div>
                          <div className={`text-sm font-display font-semibold ${titleCls}`}>
                            {layer.title}
                          </div>
                          <p className={`mt-1 text-[11px] leading-snug line-clamp-2 ${mutedCls}`}>
                            {layer.summary}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeLayer.id}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                      className={`rounded-xl border p-4 ${
                        isLight ? 'border-sky-200 bg-sky-50/80' : 'border-cyan-500/25 bg-cyan-950/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <ChevronRight className={`h-4 w-4 ${accentCls}`} />
                        <h3 className={`font-display font-semibold text-sm ${titleCls}`}>
                          How {activeLayer.title} is designed
                        </h3>
                      </div>
                      <ul className="space-y-2">
                        {activeLayer.design.map((line) => (
                          <li key={line} className={`flex gap-2 text-[12px] leading-relaxed ${mutedCls}`}>
                            <KeyRound className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${accentCls}`} />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {activeLayer.items.map((item) => (
                          <li
                            key={item}
                            className={`rounded-md border px-2 py-1 text-[10px] font-mono ${
                              isLight
                                ? 'border-slate-200 bg-white text-slate-600'
                                : 'border-slate-700 bg-[#070b14] text-slate-300'
                            }`}
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  </AnimatePresence>
                </section>
              )}

              {hubTab === 'flows' && (
                <section className={`rounded-xl border p-4 space-y-3 ${panel}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`flex items-center gap-2 text-sm font-semibold ${titleCls}`}>
                      <Activity className={`h-4 w-4 ${accentCls}`} />
                      Interactive diagrams
                    </div>
                    <div
                      className={`flex rounded-lg border p-0.5 overflow-x-auto ${
                        isLight ? 'border-slate-200' : 'border-slate-700'
                      }`}
                    >
                      {(
                        [
                          { id: 'system' as const, label: 'Full stack' },
                          { id: 'flow' as const, label: 'Security flow' },
                          { id: 'otp' as const, label: 'OTP sequence' },
                          { id: 'chat' as const, label: 'Chat / RAG' },
                        ]
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDiagramTab(tab.id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                            diagramTab === tab.id
                              ? isLight
                                ? 'bg-sky-600 text-white'
                                : 'bg-cyan-500 text-slate-950'
                              : mutedCls
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SecurityMermaidChart chart={activeChart} onNodeClick={selectFromDiagram} />
                  <p className={`text-[10px] font-mono ${mutedCls}`}>
                    Tip: click actors, messages, or flowchart nodes to jump into the matching security
                    layer.
                  </p>
                </section>
              )}

              {hubTab === 'readiness' && (
                <section className={`rounded-xl border p-4 space-y-4 ${panel}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`flex items-center gap-2 text-sm font-semibold ${titleCls}`}>
                      <Activity className={`h-4 w-4 ${accentCls}`} />
                      Live readiness by layer
                    </div>
                    <span className={`text-[10px] font-mono ${mutedCls}`}>
                      {loading ? 'checking…' : `${readyCount}/${readinessBars.length} ready · ${readyPct}%`}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                    <div
                      className={`relative mx-auto sm:mx-0 shrink-0 w-36 h-36 rounded-full border-8 flex items-center justify-center ${
                        isLight ? 'border-slate-200' : 'border-slate-800'
                      }`}
                      style={{
                        background: `conic-gradient(${
                          isLight ? '#0284c7' : '#22d3ee'
                        } ${readyPct * 3.6}deg, ${isLight ? '#e2e8f0' : '#1e293b'} 0)`,
                      }}
                    >
                      <div
                        className={`absolute inset-2 rounded-full flex flex-col items-center justify-center ${
                          isLight ? 'bg-white' : 'bg-[#0a101c]'
                        }`}
                      >
                        <span className={`text-2xl font-display font-bold tabular-nums ${titleCls}`}>
                          {readyPct}%
                        </span>
                        <span className={`text-[10px] font-mono ${mutedCls}`}>gold path</span>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
                      {layerStats.map(({ layer, items, on, total, pct }) => {
                        const Icon = layer.icon;
                        const active = selectedLayer === layer.id;
                        return (
                          <button
                            key={layer.id}
                            type="button"
                            onClick={() => {
                              setSelectedLayer(layer.id);
                              setSelectedControl(null);
                            }}
                            className={`text-left rounded-xl border p-3 bg-gradient-to-br transition-all cursor-pointer ${layer.color} ${
                              active
                                ? isLight
                                  ? 'border-sky-500 ring-2 ring-sky-400/40'
                                  : 'border-cyan-400/60 ring-2 ring-cyan-500/30'
                                : isLight
                                  ? 'border-slate-200'
                                  : 'border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-3">
                              <Icon className={`h-4 w-4 ${accentCls}`} />
                              <span className={`text-[10px] font-mono tabular-nums ${mutedCls}`}>
                                {on}/{total}
                              </span>
                            </div>
                            <div className={`text-xs font-semibold ${titleCls}`}>{layer.title}</div>
                            <div
                              className={`mt-3 h-24 flex items-end rounded-lg px-2 pb-2 pt-1 ${
                                isLight ? 'bg-white/70' : 'bg-black/25'
                              }`}
                            >
                              <motion.div
                                className={`w-full rounded-md ${layer.barColor}`}
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max(pct, 8)}%` }}
                                transition={{
                                  duration: shouldReduceMotion ? 0 : 0.55,
                                  ease: EASE_OUT_EXPO,
                                }}
                              />
                            </div>
                            <div className={`mt-2 text-[10px] font-mono tabular-nums ${accentCls}`}>
                              {pct}%
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {items.map((item) => (
                                <span
                                  key={item.key}
                                  title={item.label}
                                  className={`h-2 w-2 rounded-full ${
                                    item.ok
                                      ? layer.barColor
                                      : isLight
                                        ? 'bg-slate-300'
                                        : 'bg-slate-600'
                                  }`}
                                />
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedLayer && (
                    <div
                      className={`rounded-xl border p-3 ${
                        isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-[#070b14]'
                      }`}
                    >
                      <div className={`text-xs font-semibold mb-2 ${titleCls}`}>
                        {activeLayer.title} controls — click for detail
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {readinessBars
                          .filter((b) => b.layer === selectedLayer)
                          .map((bar) => (
                            <StatusPill
                              key={bar.key}
                              ok={bar.ok}
                              label={bar.label}
                              isLight={isLight}
                              active={selectedControl === bar.key}
                              onClick={() => {
                                setSelectedControl(bar.key);
                                setSelectedLayer(bar.layer);
                              }}
                            />
                          ))}
                      </div>
                      {selectedControl && (
                        <p className={`mt-2 text-[11px] leading-relaxed ${mutedCls}`}>
                          {CONTROL_META.find((m) => m.key === selectedControl)?.detail}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}

              <p
                className={`text-[11px] leading-relaxed border-t pt-4 ${mutedCls} ${
                  isLight ? 'border-slate-200' : 'border-slate-800'
                }`}
              >
                Honest note: no public site is “100% secure.” This map shows defense-in-depth across
                the full portfolio stack and live readiness
                {status?.metricsPath ? (
                  <>
                    {' '}
                    · scrape{' '}
                    <a
                      className={`${accentCls} hover:underline underline-offset-2`}
                      href={status.metricsPath}
                    >
                      {status.metricsPath}
                    </a>
                  </>
                ) : null}
                . Responsible disclosure:{' '}
                <a
                  className={`${accentCls} hover:underline underline-offset-2`}
                  href="mailto:sufyan.net@gmail.com"
                >
                  sufyan.net@gmail.com
                </a>
                {' · '}
                <a
                  className={`${accentCls} hover:underline underline-offset-2`}
                  href="/.well-known/security.txt"
                >
                  security.txt
                </a>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
