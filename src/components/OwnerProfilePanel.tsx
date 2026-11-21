import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Clock3,
  Copy,
  HeartPulse,
  Link2,
  MessageSquare,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  OWNER_CONSOLE_SECTIONS,
  buildOwnerConsoleHash,
  type OwnerConsoleSectionId,
} from '../utils/ownerConsoleRouting';
import { OWNER_EMAIL } from '../utils/announcementValidation';
import {
  EMPTY_SITE_TELEMETRY,
  filterActivityTimeline,
  type SiteTelemetrySnapshot,
} from '../utils/ownerTracking';

type ChatTrackingStats = {
  botQuestions?: number;
  liveRequests?: number;
  liveSessions?: number;
  llmCalls?: number;
  llmFallbacks?: number;
  openSessions?: number;
  queuedSessions?: number;
  activeSessions?: number;
  ownerOnline?: boolean;
  usage?: {
    trackedVisitors?: number;
    questions?: number;
    llmCalls?: number;
    liveSessions?: number;
  };
  policy?: {
    llmConfigured?: boolean;
    chatMaxQuestionsPerVisitor?: number;
    enableChatLlm?: boolean;
  };
};

export default function OwnerProfilePanel({
  isLight,
  onOpenSection,
  telemetry = EMPTY_SITE_TELEMETRY,
  opsHealth,
}: {
  isLight: boolean;
  onOpenSection: (section: OwnerConsoleSectionId) => void;
  telemetry?: SiteTelemetrySnapshot;
  opsHealth?: {
    apiOk: boolean | null;
    otpSupported: boolean | null;
    turnstileConfigured: boolean | null;
    policySynced: boolean;
  };
}) {
  const {
    user,
    isPrimaryOwner,
    adminAuditLogs,
    portfolioSettings,
    adminDelegates,
    contactMessageLogs,
    cvDownloadLogs,
  } = useFirebase();
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'auth' | 'ops' | 'outreach'>('all');
  const [chatStats, setChatStats] = useState<ChatTrackingStats | null>(null);
  const [copiedHref, setCopiedHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!user) return;
        const idToken = await user.getIdToken();
        const res = await fetch('/api/owner/chat/sessions', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { stats?: ChatTrackingStats };
        if (!cancelled && data.stats) setChatStats(data.stats);
      } catch {
        /* non-fatal */
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user]);

  const card = isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]';
  const subCard = isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800/80 bg-[#070b14]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const bodyCls = isLight ? 'text-slate-600' : 'text-slate-300';

  const timeline = useMemo(
    () => filterActivityTimeline(adminAuditLogs, timelineFilter).slice(0, 40),
    [adminAuditLogs, timelineFilter]
  );

  const sessionRows = useMemo(() => {
    return adminAuditLogs
      .filter((e) => e.eventType === 'owner_login')
      .slice(0, 6)
      .map((e) => ({
        id: e.auditId,
        when: e.createdAtMs,
        ua: e.userAgent || 'Unknown client',
        host: e.hostname || '—',
        tz: e.timezone || '—',
        summary: e.summary,
      }));
  }, [adminAuditLogs]);

  const deepLinks = OWNER_CONSOLE_SECTIONS.map((section) => ({
    section,
    href: buildOwnerConsoleHash(section),
  }));

  const copyLink = async (href: string) => {
    const absolute = `${window.location.origin}${window.location.pathname}${href}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopiedHref(href);
      window.setTimeout(() => {
        setCopiedHref((current) => (current === href ? null : current));
      }, 2000);
    } catch {
      /* ignore */
    }
  };

  const kpi = useMemo(
    () => ({
      newMsgs: contactMessageLogs.filter((m) => m.triageStatus === 'new').length,
      downloads: cvDownloadLogs.length,
      pageviews: telemetry.pageviews,
      og: telemetry.ogShares,
    }),
    [contactMessageLogs, cvDownloadLogs, telemetry]
  );

  const openChatTracking = () => onOpenSection('chat');

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row gap-4 ${card}`}>
        <div
          className={`w-16 h-16 rounded-2xl border overflow-hidden shrink-0 flex items-center justify-center ${subCard}`}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserRound className="w-7 h-7 text-cyan-400" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-base font-display font-bold ${titleCls}`}>
              {user?.displayName || 'Portfolio Owner'}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono uppercase ${
                isLight
                  ? 'border-sky-300 bg-sky-50 text-sky-800'
                  : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              {isPrimaryOwner ? 'Primary Owner' : 'Delegate Admin'}
            </span>
          </div>
          <p className={`text-xs font-mono break-all ${mutedCls}`}>{user?.email || OWNER_EMAIL}</p>
          <p className={`text-xs ${bodyCls}`}>
            UID <span className="font-mono">{user?.uid || '—'}</span>
            {user?.emailVerified ? ' · email verified' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: 'New inquiries', value: kpi.newMsgs },
          { label: 'CV logs', value: kpi.downloads },
          { label: 'Pageviews', value: kpi.pageviews },
          { label: 'OG shares', value: kpi.og },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl border p-3 ${card}`}>
            <div className={`text-[10px] font-mono uppercase ${mutedCls}`}>{item.label}</div>
            <div className={`text-xl font-display font-bold tabular-nums ${titleCls}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`text-xs font-display font-bold flex items-center gap-1.5 ${titleCls}`}>
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            Chat tracking &amp; limits
          </div>
          <button
            type="button"
            onClick={openChatTracking}
            className={`text-[10px] font-mono uppercase cursor-pointer ${
              isLight ? 'text-sky-700 hover:underline' : 'text-cyan-300 hover:underline'
            }`}
          >
            Open live inbox →
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] font-mono">
          {[
            ['Bot questions', chatStats?.botQuestions ?? '—'],
            ['Grok LLM', chatStats?.llmCalls ?? '—'],
            ['LLM fallbacks', chatStats?.llmFallbacks ?? '—'],
            ['Live sessions', chatStats?.liveSessions ?? '—'],
            ['Open / queued', `${chatStats?.openSessions ?? 0}/${chatStats?.queuedSessions ?? 0}`],
            ['Tracked visitors', chatStats?.usage?.trackedVisitors ?? '—'],
            [
              'Max Q / visitor',
              chatStats?.policy?.chatMaxQuestionsPerVisitor ??
                portfolioSettings.chatMaxQuestionsPerVisitor,
            ],
            [
              'Grok API',
              chatStats?.policy?.llmConfigured
                ? portfolioSettings.enableChatLlm
                  ? 'Ready'
                  : 'Key set / LLM off'
                : 'Not configured',
            ],
          ].map(([k, v]) => (
            <div key={String(k)} className={`flex justify-between gap-2 rounded-lg border px-2.5 py-2 ${subCard}`}>
              <span className={mutedCls}>{k}</span>
              <span className={titleCls}>{v}</span>
            </div>
          ))}
        </div>
        <p className={`text-[11px] ${mutedCls}`}>
          Owner online: {chatStats?.ownerOnline ? 'yes' : 'no'} · Presence warms while the console is open.
          Chat limits and alert routing are edited in{' '}
          <button
            type="button"
            onClick={() => onOpenSection('settings')}
            className={`font-semibold underline-offset-2 hover:underline cursor-pointer ${
              isLight ? 'text-sky-700' : 'text-cyan-300'
            }`}
          >
            Site Controls
          </button>
          .
        </p>
      </div>

      <div className={`rounded-xl border p-4 space-y-2 ${card}`}>
        <div className={`text-xs font-display font-bold flex items-center gap-1.5 ${titleCls}`}>
          <HeartPulse className="w-4 h-4 text-cyan-400" />
          Ops health
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
          {[
            ['API /health', opsHealth?.apiOk == null ? '…' : opsHealth.apiOk ? 'OK' : 'DOWN'],
            [
              'OTP transport',
              opsHealth?.otpSupported == null ? '…' : opsHealth.otpSupported ? 'Ready' : 'Not configured',
            ],
            [
              'Turnstile',
              opsHealth?.turnstileConfigured == null
                ? '…'
                : opsHealth.turnstileConfigured
                  ? 'Configured'
                  : 'Missing',
            ],
            ['Policy sync', opsHealth?.policySynced ? 'Synced this session' : 'Pending / unknown'],
            ['Incident mode', portfolioSettings.incidentMode ? 'ACTIVE' : 'Off'],
            ['Delegates', String(adminDelegates.length)],
          ].map(([k, v]) => (
            <div key={k} className={`flex justify-between gap-2 rounded-lg border px-2.5 py-2 ${subCard}`}>
              <span className={mutedCls}>{k}</span>
              <span className={titleCls}>{v}</span>
            </div>
          ))}
        </div>
        {Object.keys(telemetry.ogByTrack || {}).length > 0 && (
          <div className={`text-[11px] font-mono ${mutedCls}`}>
            OG tracks:{' '}
            {Object.entries(telemetry.ogByTrack)
              .map(([k, v]) => `${k}=${v}`)
              .join(' · ')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
          <div className={`text-xs font-display font-bold flex items-center gap-1.5 ${titleCls}`}>
            <Link2 className="w-4 h-4 text-cyan-400" />
            Deep-linkable console sections
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {deepLinks.map((item) => (
              <div
                key={item.section}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-mono ${subCard}`}
              >
                <button
                  type="button"
                  onClick={() => onOpenSection(item.section)}
                  className={`truncate text-left cursor-pointer hover:underline ${titleCls}`}
                >
                  {item.href}
                </button>
                <button
                  type="button"
                  onClick={() => void copyLink(item.href)}
                  className={`inline-flex items-center gap-1 shrink-0 rounded-md px-1.5 py-0.5 cursor-pointer transition-colors ${
                    copiedHref === item.href
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : mutedCls
                  }`}
                  aria-label={copiedHref === item.href ? 'Copied' : `Copy ${item.href}`}
                >
                  {copiedHref === item.href ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copiedHref === item.href ? 'Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
          <div className={`text-xs font-display font-bold flex items-center gap-1.5 ${titleCls}`}>
            <MonitorSmartphone className="w-4 h-4 text-cyan-400" />
            Session security (from audit)
          </div>
          <p className={`text-[11px] ${mutedCls}`}>
            Recent successful Google sign-ins. Full multi-device revoke requires Firebase Admin; use Sign Out
            here to end this browser session.
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {sessionRows.length === 0 ? (
              <p className={`text-xs ${mutedCls}`}>No login events yet.</p>
            ) : (
              sessionRows.map((row) => (
                <div key={row.id} className={`rounded-lg border px-2.5 py-2 text-[11px] font-mono ${subCard}`}>
                  <div className="flex justify-between gap-2">
                    <span className={titleCls}>{row.host}</span>
                    <span className={mutedCls}>{new Date(row.when).toLocaleString()}</span>
                  </div>
                  <div className={`truncate ${mutedCls}`}>{row.ua}</div>
                  <div className={mutedCls}>TZ {row.tz}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`text-xs font-display font-bold flex items-center gap-1.5 ${titleCls}`}>
            <Activity className="w-4 h-4 text-cyan-400" />
            Owner activity timeline
          </div>
          <div className="flex flex-wrap gap-1">
            {(['all', 'auth', 'ops', 'outreach'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTimelineFilter(f)}
                className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase cursor-pointer ${
                  timelineFilter === f
                    ? 'bg-[#38bdf8] border-[#38bdf8] text-slate-950 font-semibold'
                    : isLight
                      ? 'border-slate-300 text-slate-600'
                      : 'border-slate-700 text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {timeline.length === 0 ? (
            <p className={`text-xs ${mutedCls}`}>No matching audit events.</p>
          ) : (
            timeline.map((entry) => (
              <div key={entry.auditId} className={`rounded-lg border px-2.5 py-2 text-[11px] font-mono ${subCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`${titleCls} uppercase`}>{entry.eventType}</span>
                  <span className={`inline-flex items-center gap-1 ${mutedCls}`}>
                    <Clock3 className="w-3 h-3" />
                    {new Date(entry.createdAtMs).toLocaleString()}
                  </span>
                </div>
                <div className={`mt-0.5 ${bodyCls}`}>{entry.summary}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Hook-friendly fetcher used by OwnerConsolePage */
export function useOwnerOpsHealth(enabled: boolean) {
  const { user } = useFirebase();
  const [telemetry, setTelemetry] = useState<SiteTelemetrySnapshot>(EMPTY_SITE_TELEMETRY);
  const [opsHealth, setOpsHealth] = useState<{
    apiOk: boolean | null;
    otpSupported: boolean | null;
    turnstileConfigured: boolean | null;
    policySynced: boolean;
  }>({
    apiOk: null,
    otpSupported: null,
    turnstileConfigured: null,
    policySynced: false,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = async () => {
      try {
        const authHeaders: HeadersInit = {};
        if (user) {
          try {
            const idToken = await user.getIdToken();
            authHeaders.Authorization = `Bearer ${idToken}`;
          } catch {
            /* proceed without token; telemetry endpoint will 401 */
          }
        }
        const [healthRes, accessRes, telemetryRes] = await Promise.all([
          fetch('/api/health').then((r) => ({ ok: r.ok })),
          fetch('/api/access-config').then(async (r) => {
            if (!r.ok) return null;
            return (await r.json()) as { turnstileSiteKey?: string; otpSupported?: boolean };
          }),
          fetch('/api/owner/telemetry', { headers: authHeaders })
            .then(async (r) => (r.ok ? ((await r.json()) as SiteTelemetrySnapshot) : null))
            .catch(() => null),
        ]);
        if (cancelled) return;
        setOpsHealth({
          apiOk: healthRes.ok,
          otpSupported: accessRes ? Boolean(accessRes.otpSupported) : null,
          turnstileConfigured: accessRes ? Boolean(accessRes.turnstileSiteKey) : null,
          policySynced: true,
        });
        if (telemetryRes) {
          setTelemetry({
            pageviews: Number(telemetryRes.pageviews) || 0,
            ogShares: Number(telemetryRes.ogShares) || 0,
            ogByTrack: telemetryRes.ogByTrack || {},
            updatedAtIso: telemetryRes.updatedAtIso || '',
          });
        }
      } catch {
        if (!cancelled) {
          setOpsHealth((prev) => ({ ...prev, apiOk: false }));
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, user]);

  return { telemetry, opsHealth };
}
