import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  Lock,
  Shield,
  X,
  XCircle,
  Radar,
  Server,
  KeyRound,
  Eye,
} from 'lucide-react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface ControlStatus {
  turnstile: boolean;
  redis: boolean;
  adminWrites: boolean;
  mail: boolean;
  incidentMode: boolean;
  sentry: boolean;
  slackAlerts: boolean;
  sessionSecret: boolean;
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

const LAYERS: Array<{
  title: string;
  icon: typeof Shield;
  items: string[];
}> = [
  {
    title: 'Edge',
    icon: Radar,
    items: [
      'Cloudflare proxy / Bot Fight / Turnstile challenge',
      'Origin allowlist + Sec-Fetch-Site checks',
      'Sensitive-route bot UA blocking (contact, CV, chat)',
    ],
  },
  {
    title: 'Application',
    icon: Lock,
    items: [
      'CSP · HSTS · no production source maps',
      'HMAC OTP + MX verification for leads & chat',
      'Fail-closed Redis rate limits + shared chat quotas',
      'Chat receipt headers (no query-string tokens)',
      'Incident mode + per-feature visitor switches',
    ],
  },
  {
    title: 'Data',
    icon: Server,
    items: [
      'Firestore deny-by-default schemas',
      'Admin-bound owner replies (no unbound mail relay)',
      'Optional Admin SDK server writes for PII collections',
      'Announcement visibility rules (drafts never public)',
    ],
  },
  {
    title: 'Observability',
    icon: Eye,
    items: [
      'X-Request-Id on every response + structured JSON logs',
      'Owner Console funnel / CRM / chat / audit trail',
      'Optional Sentry DSN + Slack urgent/warning webhooks',
      'Gold-path checklist exposed on /api/health',
    ],
  },
];

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono uppercase tracking-wide ${
        ok
          ? 'border-emerald-500/35 bg-emerald-950/40 text-emerald-300'
          : 'border-slate-700 bg-slate-900/60 text-slate-400'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export default function SecurityArchitectureModal({
  open,
  onClose,
}: SecurityArchitectureModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
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
            className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-cyan-500/25 bg-[#070b14] shadow-2xl"
            initial={shouldReduceMotion ? false : { y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { y: 16, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800/80 bg-[#070b14]/95 px-5 py-4 backdrop-blur">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-400/90">
                  Live control map
                </p>
                <h2
                  id="security-arch-title"
                  className="font-display text-lg sm:text-xl font-bold text-white tracking-tight"
                >
                  Security Architecture
                </h2>
                <p className="mt-1 text-xs text-slate-400 max-w-xl">
                  Threat → control layers that protect this portfolio. No secrets are exposed —
                  only boolean readiness signals from <code className="text-cyan-300/90">/api/status</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-6">
              <section className="rounded-xl border border-slate-800 bg-[#0a101c] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-slate-200 font-semibold">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Production gold-path signals
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {loading
                      ? 'checking…'
                      : status?.goldPathScore
                        ? `score ${status.goldPathScore}`
                        : 'status unavailable'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill ok={Boolean(controls?.turnstile)} label="Turnstile" />
                  <StatusPill ok={Boolean(controls?.redis)} label="Redis" />
                  <StatusPill ok={Boolean(controls?.adminWrites)} label="Admin writes" />
                  <StatusPill ok={Boolean(controls?.mail)} label="Mail" />
                  <StatusPill ok={Boolean(controls?.sessionSecret)} label="SESSION_SECRET" />
                  <StatusPill ok={Boolean(controls?.sentry)} label="Sentry" />
                  <StatusPill ok={Boolean(controls?.slackAlerts)} label="Slack alerts" />
                  <StatusPill ok={Boolean(controls?.incidentMode)} label="Incident mode" />
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                {LAYERS.map((layer, index) => {
                  const Icon = layer.icon;
                  return (
                    <motion.section
                      key={layer.title}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: shouldReduceMotion ? 0 : 0.05 * index, duration: 0.3 }}
                      className="rounded-xl border border-slate-800/90 bg-gradient-to-b from-[#0c1422] to-[#080d16] p-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <h3 className="font-display font-semibold text-white text-sm">{layer.title}</h3>
                      </div>
                      <ul className="space-y-2">
                        {layer.items.map((item) => (
                          <li
                            key={item}
                            className="flex gap-2 text-[11px] leading-snug text-slate-400"
                          >
                            <KeyRound className="h-3 w-3 mt-0.5 shrink-0 text-cyan-500/70" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.section>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800 pt-4">
                Honest note: no public site is “100% secure.” This map shows defense-in-depth and
                live readiness. Responsible disclosure:{' '}
                <a
                  className="text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline"
                  href="mailto:sufyan.net@gmail.com"
                >
                  sufyan.net@gmail.com
                </a>{' '}
                ·{' '}
                <a
                  className="text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline"
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
