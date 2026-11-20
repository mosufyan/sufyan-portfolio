import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Headphones, Loader2, MessageCircle, Radio, Send, XCircle } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';

type ChatMessage = { id: string; role: string; text: string; createdAtMs: number };
type ChatSession = {
  sessionId: string;
  status: string;
  visitorName: string;
  visitorEmail: string;
  createdAtMs: number;
  updatedAtMs: number;
  messages: ChatMessage[];
};

type ChatStats = {
  botQuestions: number;
  liveRequests: number;
  liveSessions: number;
  openSessions: number;
  ownerOnline: boolean;
  ownerPresenceAtMs: number;
};

const EMPTY_STATS: ChatStats = {
  botQuestions: 0,
  liveRequests: 0,
  liveSessions: 0,
  openSessions: 0,
  ownerOnline: false,
  ownerPresenceAtMs: 0,
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

  const card = isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]';
  const muted = isLight ? 'text-slate-500' : 'text-slate-400';
  const title = isLight ? 'text-slate-900' : 'text-white';
  const input = isLight
    ? 'border-slate-300 bg-white text-slate-900'
    : 'border-slate-700 bg-[#070b14] text-slate-100';

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await authHeaders();
      await fetch('/api/owner/presence', { method: 'POST', headers }).catch(() => {});
      const res = await fetch('/api/owner/chat/sessions', { headers });
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
      setError(err instanceof Error ? err.message : 'Unable to load chat.');
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
      setError(err instanceof Error ? err.message : 'Reply failed.');
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
      setError(err instanceof Error ? err.message : 'Unable to close.');
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
                {selected.messages.map((m) => (
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
                      {m.role} · {new Date(m.createdAtMs).toLocaleTimeString()}
                    </div>
                    {m.text}
                  </div>
                ))}
              </div>
              <form onSubmit={sendReply} className={`p-2.5 border-t flex gap-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  disabled={selected.status === 'closed'}
                  placeholder="Reply to visitor…"
                  className={`flex-1 min-w-0 rounded-lg border px-2.5 py-2 text-xs focus:outline-none ${input}`}
                />
                <button
                  type="submit"
                  disabled={busy || !reply.trim() || selected.status === 'closed'}
                  className="inline-flex items-center gap-1 rounded-lg bg-cyan-500 text-slate-950 px-3 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send
                </button>
              </form>
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
