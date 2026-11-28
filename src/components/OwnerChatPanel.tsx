import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Headphones, Loader2, MessageCircle, Radio, XCircle } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { toUserFacingError } from '../utils/userFacingError';
import ChatMessageComposer from './ChatMessageComposer';

type ChatChannel = 'text' | 'ptt' | 's2s';
type ChatMessage = {
  id: string;
  role: string;
  text: string;
  createdAtMs: number;
  channel?: ChatChannel;
};
type ChatSession = {
  sessionId: string;
  status: string;
  visitorName: string;
  visitorEmail: string;
  createdAtMs: number;
  updatedAtMs: number;
  messages: ChatMessage[];
};
type ChannelFilter = 'all' | ChatChannel;

type ChatStats = {
  botQuestions: number;
  liveRequests: number;
  liveSessions: number;
  openSessions: number;
  ownerOnline: boolean;
  ownerPresenceAtMs: number;
  voiceTurns?: number;
  voiceRealtimeSessions?: number;
  voiceRealtimeMinutes?: number;
  usage?: {
    voiceTurns?: number;
    voiceRealtimeSessions?: number;
    voiceRealtimeMinutes?: number;
  };
};

const EMPTY_STATS: ChatStats = {
  botQuestions: 0,
  liveRequests: 0,
  liveSessions: 0,
  openSessions: 0,
  ownerOnline: false,
  ownerPresenceAtMs: 0,
  voiceTurns: 0,
  voiceRealtimeSessions: 0,
  voiceRealtimeMinutes: 0,
};

export default function OwnerChatPanel({ isLight }: { isLight: boolean }) {
  const { user } = useFirebase();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [stats, setStats] = useState<ChatStats>(EMPTY_STATS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');

  const card = isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]';
  const muted = isLight ? 'text-slate-500' : 'text-slate-400';
  const title = isLight ? 'text-slate-900' : 'text-white';

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await authHeaders();
      await fetch('/api/owner/presence', { credentials: 'include',
          method: 'POST', headers }).catch(() => {});
      const res = await fetch('/api/owner/chat/sessions', { credentials: 'include', headers });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        stats?: ChatStats;
        sessions?: ChatSession[];
      };
      if (!res.ok) throw new Error(data.error || 'Unable to load chat sessions.');
      setStats(data.stats || EMPTY_STATS);
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      setError(null);
    } catch (err) {
      setError(toUserFacingError(err, 'Unable to load chat.'));
    } finally {
      setLoading(false);
    }
  }, [authHeaders, user]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const selected = useMemo(
    () => sessions.find((s) => s.sessionId === selectedId) || sessions[0] || null,
    [sessions, selectedId]
  );

  const filteredMessages = useMemo(() => {
    if (!selected) return [];
    if (channelFilter === 'all') return selected.messages;
    return selected.messages.filter((m) => (m.channel || 'text') === channelFilter);
  }, [selected, channelFilter]);

  const channelBadge = (channel?: ChatChannel) => {
    const c = channel || 'text';
    if (c === 'ptt') {
      return (
        <span
          className={`ml-1 inline-flex items-center rounded border px-1 py-px text-[9px] font-mono uppercase ${
            isLight
              ? 'border-violet-300 bg-violet-50 text-violet-700'
              : 'border-violet-500/40 bg-violet-950/30 text-violet-300'
          }`}
        >
          PTT
        </span>
      );
    }
    if (c === 's2s') {
      return (
        <span
          className={`ml-1 inline-flex items-center rounded border px-1 py-px text-[9px] font-mono uppercase ${
            isLight
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
          }`}
        >
          S2S
        </span>
      );
    }
    return null;
  };

  useEffect(() => {
    if (selected && selected.sessionId !== selectedId) setSelectedId(selected.sessionId);
  }, [selected, selectedId]);

  const sendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/owner/chat/reply', {
        credentials: 'include',
          method: 'POST',
        headers,
        body: JSON.stringify({ sessionId: selected.sessionId, text: reply.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; session?: ChatSession };
      if (!res.ok) throw new Error(data.error || 'Reply failed.');
      setReply('');
      if (data.session) {
        setSessions((prev) =>
          prev.map((s) => (s.sessionId === data.session!.sessionId ? data.session! : s))
        );
      } else {
        await refresh();
      }
    } catch (err) {
      setError(toUserFacingError(err, 'Reply failed.'));
    } finally {
      setBusy(false);
    }
  };

  const closeSession = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/owner/chat/close', {
        credentials: 'include',
          method: 'POST',
        headers,
        body: JSON.stringify({ sessionId: selected.sessionId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Unable to close session.');
      }
      await refresh();
    } catch (err) {
      setError(toUserFacingError(err, 'Unable to close.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className={`font-display font-bold text-sm flex items-center gap-1.5 ${title}`}>
              <Headphones className="w-4 h-4 text-cyan-400" />
              Portfolio Chat & Live Agent
            </h3>
            <p className={`text-[11px] font-mono mt-0.5 ${muted}`}>
              Bot Q&A is grounded in portfolio content. Live sessions require visitor email OTP. Presence
              heartbeats keep “online” accurate while this panel is open.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono ${
              stats.ownerOnline
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                : 'border-slate-600 text-slate-400'
            }`}
          >
            <Radio className="w-3 h-3" />
            {stats.ownerOnline ? 'Marked online' : 'Offline'}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Bot questions', value: stats.botQuestions },
            { label: 'Live requests', value: stats.liveRequests },
            { label: 'Live sessions', value: stats.liveSessions },
            { label: 'Open now', value: stats.openSessions },
            { label: 'PTT turns (all-time)', value: stats.voiceTurns ?? 0 },
            {
              label: 'S2S sessions (all-time)',
              value: stats.voiceRealtimeSessions ?? 0,
            },
            {
              label: 'S2S minutes granted',
              value: stats.voiceRealtimeMinutes ?? 0,
            },
            {
              label: 'PTT / S2S (window)',
              value: `${stats.usage?.voiceTurns ?? 0} / ${stats.usage?.voiceRealtimeSessions ?? 0}`,
            },
          ].map((item) => (
            <div key={item.label} className={`rounded-lg border px-2.5 py-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className={`text-[10px] font-mono uppercase ${muted}`}>{item.label}</div>
              <div className={`text-lg font-display font-bold tabular-nums ${title}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className={`lg:col-span-4 rounded-xl border p-2 space-y-1 max-h-[28rem] overflow-y-auto ${card}`}>
          {loading ? (
            <div className={`p-3 text-xs flex items-center gap-2 ${muted}`}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <div className={`p-3 text-xs ${muted}`}>No live chat sessions yet.</div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.sessionId}
                type="button"
                onClick={() => setSelectedId(s.sessionId)}
                className={`w-full text-left rounded-lg border px-2.5 py-2 cursor-pointer ${
                  selected?.sessionId === s.sessionId
                    ? isLight
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-cyan-500/40 bg-cyan-950/25'
                    : isLight
                      ? 'border-transparent hover:bg-slate-50'
                      : 'border-transparent hover:bg-[#0d121f]'
                }`}
              >
                <div className={`text-xs font-semibold truncate ${title}`}>{s.visitorName}</div>
                <div className={`text-[10px] font-mono truncate ${muted}`}>{s.visitorEmail}</div>
                <div className={`text-[10px] font-mono mt-0.5 ${muted}`}>
                  {s.status} · {new Date(s.updatedAtMs).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>

        <div className={`lg:col-span-8 rounded-xl border flex flex-col min-h-[22rem] max-h-[28rem] ${card}`}>
          {!selected ? (
            <div className={`m-auto text-xs ${muted}`}>Select a session to reply.</div>
          ) : (
            <>
              <div className={`px-3 py-2 border-b flex items-center justify-between gap-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold truncate ${title}`}>
                    {selected.visitorName}{' '}
                    <span className={`text-[10px] font-mono ${muted}`}>{selected.sessionId}</span>
                  </div>
                  <div className={`text-[10px] font-mono truncate ${muted}`}>{selected.visitorEmail}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Filter by channel">
                    {(
                      [
                        ['all', 'All'],
                        ['text', 'Text'],
                        ['ptt', 'PTT'],
                        ['s2s', 'S2S'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setChannelFilter(id)}
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase cursor-pointer ${
                          channelFilter === id
                            ? isLight
                              ? 'border-sky-500 bg-sky-50 text-sky-800'
                              : 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                            : isLight
                              ? 'border-slate-200 text-slate-600'
                              : 'border-slate-700 text-slate-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void closeSession()}
                  disabled={busy || selected.status === 'closed'}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-rose-500/40 text-rose-300 disabled:opacity-50 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Close
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                {filteredMessages.length === 0 ? (
                  <div className={`text-[11px] font-mono ${muted}`}>
                    No {channelFilter === 'all' ? '' : `${channelFilter.toUpperCase()} `}messages in this
                    session yet.
                  </div>
                ) : (
                  filteredMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap ${
                        m.role === 'owner'
                          ? 'bg-cyan-500/15 border border-cyan-500/25 ml-6'
                          : m.role === 'visitor'
                            ? isLight
                              ? 'bg-slate-100 mr-6'
                              : 'bg-[#121826] mr-6'
                            : isLight
                              ? 'bg-amber-50 text-amber-900'
                              : 'bg-amber-950/25 text-amber-100'
                      }`}
                    >
                      <div className={`text-[10px] font-mono mb-0.5 ${muted}`}>
                        {m.role}
                        {channelBadge(m.channel)} · {new Date(m.createdAtMs).toLocaleTimeString()}
                      </div>
                      {m.text}
                    </div>
                  ))
                )}
              </div>
              <div className={`p-2.5 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <ChatMessageComposer
                  value={reply}
                  onChange={setReply}
                  onSubmit={sendReply}
                  busy={busy}
                  disabled={selected.status === 'closed'}
                  isLight={isLight}
                  placeholder="Reply to visitor…"
                  submitAriaLabel="Send reply"
                  showSubmitLabel
                  minSubmitLength={1}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`rounded-xl border p-3 text-[11px] font-mono ${card} ${muted}`}>
        <MessageCircle className="w-3.5 h-3.5 inline mr-1 text-cyan-400" />
        Tip: keep the Owner Console open (any section) or stay on Chat to remain “online”. Visitors requesting live
        chat after OTP will appear here within a few seconds.
      </div>
    </div>
  );
}
