import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Lock,
  Shield,
  X,
  XCircle,
  Radar,
  Server,
  KeyRound,
  Eye,
  GitBranch,
  BarChart3,
  MousePointerClick,
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
}

interface SecurityArchitectureModalProps {
  open: boolean;
  onClose: () => void;
}

type LayerId = 'edge' | 'application' | 'data' | 'observability';

interface LayerDetail {
  id: LayerId;
  title: string;
  icon: typeof Shield;
  color: string;
  summary: string;
  design: string[];
  items: string[];
}

const LAYERS: LayerDetail[] = [
  {
    id: 'edge',
    title: 'Edge',
    icon: Radar,
    color: 'from-sky-500/25 to-cyan-500/10',
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
    summary: 'Firestore deny-by-default; PII writes only via Admin SDK.',
    design: [
      'Rules default-deny every collection; each path has an explicit schema.',
      'cv_downloads / contact_messages deny client creates — server Admin SDK only.',
      'Owner replies are admin-bound (no unbound mail relay).',
      'Announcement drafts stay private until published/scheduled.',
    ],
    items: [
      'Firestore deny-by-default schemas',
      'Admin-bound owner replies (no unbound mail relay)',
      'Optional Admin SDK server writes for PII collections',
      'Announcement visibility rules (drafts never public)',
    ],
  },
  {
    id: 'observability',
    title: 'Observability',
    icon: Eye,
    color: 'from-amber-500/25 to-orange-500/10',
    summary: 'Trace every request; owner console for funnel, CRM, chat, audit.',
    design: [
      'X-Request-Id on every response + structured JSON logs.',
      'Owner Console surfaces funnel, CRM triage, chat, and audit history.',
      'Optional Sentry DSN and Slack urgent/warning webhooks.',
      '/api/status exposes boolean gold-path readiness — never secrets.',
    ],
    items: [
      'X-Request-Id on every response + structured JSON logs',
      'Owner Console funnel / CRM / chat / audit trail',
      'Optional Sentry DSN + Slack urgent/warning webhooks',
      'Gold-path checklist exposed on /api/health',
    ],
  },
];

const FLOW_CHART = `flowchart LR
  V["Visitor / Bot"] --> E["Edge\\nCloudflare + Turnstile"]
  E --> A["Application\\nCSP · OTP · Redis"]
  A --> D["Data\\nFirestore rules"]
  A --> O["Observability\\nLogs · Sentry · Slack"]
  D --> O
  classDef edge fill:#083344,stroke:#22d3ee,color:#e2e8f0
  classDef app fill:#2e1065,stroke:#c084fc,color:#e2e8f0
  classDef data fill:#052e16,stroke:#34d399,color:#e2e8f0
  classDef obs fill:#451a03,stroke:#fbbf24,color:#e2e8f0
  class E edge
  class A app
  class D data
  class O obs`;

const OTP_SEQUENCE = `sequenceDiagram
  participant U as Visitor
  participant E as Edge
  participant A as App
  participant R as Redis
  participant M as Mail
  U->>E: Submit email
  E->>A: Turnstile + honeypot OK
  A->>R: Rate-limit + store challenge
  A->>M: Send HMAC OTP
  U->>A: Submit OTP
  A->>R: Verify + consume
  A-->>U: Verified session / receipt`;

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

export default function SecurityArchitectureModal({
  open,
  onClose,
}: SecurityArchitectureModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const { isLight } = useTheme();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<LayerId | null>('edge');
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const [diagramTab, setDiagramTab] = useState<'flow' | 'otp'>('flow');

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

  const readinessBars = useMemo(() => {
    return CONTROL_META.map((meta) => {
      const ok = Boolean(controls?.[meta.key]);
      return { ...meta, ok };
    });
  }, [controls]);

  const readyCount = readinessBars.filter((b) => b.ok).length;
  const readyPct = readinessBars.length ? Math.round((readyCount / readinessBars.length) * 100) : 0;

  const shell = isLight
    ? 'border-slate-200 bg-white text-slate-900'
    : 'border-cyan-500/25 bg-[#070b14] text-slate-200';
  const panel = isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#0a101c]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const accentCls = isLight ? 'text-sky-700' : 'text-cyan-400';

  const mapMermaidNodeToLayer = (nodeId: string): LayerId | null => {
    const id = nodeId.toLowerCase();
    if (id.includes('edge') || id === 'e') return 'edge';
    if (id.includes('application') || id === 'a') return 'application';
    if (id.includes('data') || id === 'd') return 'data';
    if (id.includes('observ') || id === 'o') return 'observability';
    return null;
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
            aria-label="Close security architecture"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="security-arch-title"
            className={`relative w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border shadow-2xl ${shell}`}
            initial={shouldReduceMotion ? false : { y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { y: 16, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          >
            <div
              className={`sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-4 sm:px-5 py-4 backdrop-blur ${
                isLight ? 'border-slate-200 bg-white/95' : 'border-slate-800/80 bg-[#070b14]/95'
              }`}
            >
              <div className="min-w-0">
                <p className={`text-[10px] font-mono uppercase tracking-[0.18em] ${accentCls}`}>
                  Interactive control map
                </p>
                <h2
                  id="security-arch-title"
                  className={`font-display text-lg sm:text-xl font-bold tracking-tight ${titleCls}`}
                >
                  Security Architecture
                </h2>
                <p className={`mt-1 text-xs max-w-2xl ${mutedCls}`}>
                  Click layers, bars, or diagram nodes to inspect how each control is designed. Live
                  booleans come from <code className={accentCls}>/api/status</code> — never secrets.
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

            <div className="px-4 sm:px-5 py-5 space-y-6">
              {/* Interactive request flow */}
              <section className={`rounded-xl border p-4 space-y-3 ${panel}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className={`flex items-center gap-2 text-sm font-semibold ${titleCls}`}>
                    <GitBranch className={`h-4 w-4 ${accentCls}`} />
                    Defense-in-depth flow
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
                        <div className={`text-sm font-display font-semibold ${titleCls}`}>{layer.title}</div>
                        <p className={`mt-1 text-[11px] leading-snug line-clamp-2 ${mutedCls}`}>{layer.summary}</p>
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
                    className={`rounded-xl border p-4 ${isLight ? 'border-sky-200 bg-sky-50/80' : 'border-cyan-500/25 bg-cyan-950/20'}`}
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

              {/* Colorful readiness chart */}
              <section className={`rounded-xl border p-4 space-y-3 ${panel}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className={`flex items-center gap-2 text-sm font-semibold ${titleCls}`}>
                    <BarChart3 className={`h-4 w-4 ${accentCls}`} />
                    Live readiness chart
                  </div>
                  <span className={`text-[10px] font-mono ${mutedCls}`}>
                    {loading ? 'checking…' : `${readyCount}/${readinessBars.length} ready · ${readyPct}%`}
                  </span>
                </div>

                <div className={`h-3 w-full overflow-hidden rounded-full border ${isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-800 bg-[#060911]'}`}>
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${readyPct}%` }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: EASE_OUT_EXPO }}
                  />
                </div>

                <div className="space-y-1.5">
                  {readinessBars.map((bar) => {
                    const active = selectedControl === bar.key;
                    return (
                      <button
                        key={bar.key}
                        type="button"
                        onClick={() => {
                          setSelectedControl(bar.key);
                          setSelectedLayer(bar.layer);
                        }}
                        className={`w-full text-left rounded-lg border px-2.5 py-1.5 transition-colors cursor-pointer ${
                          active
                            ? isLight
                              ? 'border-sky-400 bg-sky-50'
                              : 'border-cyan-500/50 bg-cyan-950/30'
                            : isLight
                              ? 'border-transparent hover:bg-white'
                              : 'border-transparent hover:bg-[#0c1422]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[11px] font-mono ${titleCls}`}>{bar.label}</span>
                          <span className={`text-[10px] font-mono ${bar.ok ? 'text-emerald-400' : mutedCls}`}>
                            {bar.ok ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <div className={`h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                          <div
                            className={`h-full rounded-full ${
                              bar.ok
                                ? bar.layer === 'edge'
                                  ? 'bg-sky-400'
                                  : bar.layer === 'application'
                                    ? 'bg-violet-400'
                                    : bar.layer === 'data'
                                      ? 'bg-emerald-400'
                                      : 'bg-amber-400'
                                : isLight
                                  ? 'bg-slate-300 w-1/5'
                                  : 'bg-slate-700 w-1/5'
                            }`}
                            style={{ width: bar.ok ? '100%' : '18%' }}
                          />
                        </div>
                        {active && (
                          <p className={`mt-1.5 text-[11px] leading-relaxed ${mutedCls}`}>{bar.detail}</p>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {CONTROL_META.map((meta) => (
                    <StatusPill
                      key={meta.key}
                      ok={Boolean(controls?.[meta.key])}
                      label={meta.label}
                      isLight={isLight}
                      active={selectedControl === meta.key}
                      onClick={() => {
                        setSelectedControl(meta.key);
                        setSelectedLayer(meta.layer);
                      }}
                    />
                  ))}
                </div>
              </section>

              {/* Mermaid diagrams */}
              <section className={`rounded-xl border p-4 space-y-3 ${panel}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className={`flex items-center gap-2 text-sm font-semibold ${titleCls}`}>
                    <Activity className={`h-4 w-4 ${accentCls}`} />
                    Mermaid architecture diagrams
                  </div>
                  <div className={`flex rounded-lg border p-0.5 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                    {(
                      [
                        { id: 'flow' as const, label: 'System flow' },
                        { id: 'otp' as const, label: 'OTP sequence' },
                      ]
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDiagramTab(tab.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
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
                <SecurityMermaidChart
                  chart={diagramTab === 'flow' ? FLOW_CHART : OTP_SEQUENCE}
                  onNodeClick={(nodeId) => {
                    const layer = mapMermaidNodeToLayer(nodeId);
                    if (layer) {
                      setSelectedLayer(layer);
                      setSelectedControl(null);
                    }
                  }}
                />
                <p className={`text-[10px] font-mono ${mutedCls}`}>
                  Tip: click flowchart nodes to jump to that layer’s design notes above.
                </p>
              </section>

              <section className={`rounded-xl border p-4 space-y-3 ${panel}`}>
                <h3 className={`font-display font-semibold text-sm ${titleCls}`}>Case notes</h3>
                <ul className={`space-y-2 text-[11px] leading-relaxed ${mutedCls}`}>
                  <li>
                    <span className={`font-mono ${accentCls}`}>OTP design</span> — HMAC-bound
                    challenges, MX verification, Redis-shared across Cloud Run replicas.
                  </li>
                  <li>
                    <span className={`font-mono ${accentCls}`}>Fail-closed Redis</span> — rate
                    limits, chat quotas, and policy load deny or lock down when Upstash is unreachable.
                  </li>
                  <li>
                    <span className={`font-mono ${accentCls}`}>Firestore rules</span> — deny-by-default
                    schemas; PII collections are Admin-SDK-write-only; public settings are a UX-only slice.
                  </li>
                  <li>
                    <span className={`font-mono ${accentCls}`}>Agent bots</span> — Turnstile +
                    honeypot + expanded UA denylist stop scripted scrapers and agent frameworks on
                    forms; enable Cloudflare Bot Fight / Block AI Bots at the edge for headless farms.
                  </li>
                </ul>
              </section>

              <p className={`text-[11px] leading-relaxed border-t pt-4 ${mutedCls} ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                Honest note: no public site is “100% secure.” This map shows defense-in-depth and
                live readiness. Responsible disclosure:{' '}
                <a
                  className={`${accentCls} hover:underline underline-offset-2`}
                  href="mailto:sufyan.net@gmail.com"
                >
                  sufyan.net@gmail.com
                </a>{' '}
                ·{' '}
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
