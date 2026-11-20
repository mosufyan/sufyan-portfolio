import { FormEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bot,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import { useTheme } from '../theme/ThemeProvider';

type ChatBubble = {
  id: string;
  role: 'visitor' | 'bot' | 'owner' | 'system';
  text: string;
  sources?: string[];
  followUps?: string[];
};

type LiveSession = {
  sessionId: string;
  status: string;
  visitorName?: string;
  visitorEmail?: string;
  messages: Array<{ id: string; role: string; text: string; createdAtMs: number }>;
};

type Mode = 'welcome' | 'register' | 'otp' | 'chat';

const SESSION_STORAGE_KEY = 'ms_chat_verified_session_v1';

function getOrCreateVisitorId(): string {
  try {
    const key = 'ms_chat_visitor_id';
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length >= 8) return existing.slice(0, 64);
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return `v-${Date.now()}`;
  }
}

function loadStoredSession(): {
  sessionId: string;
  receipt: string;
  name: string;
  email: string;
} | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      sessionId?: string;
      receipt?: string;
      name?: string;
      email?: string;
    };
    if (!parsed.sessionId || !parsed.receipt || !parsed.name || !parsed.email) return null;
    return {
      sessionId: parsed.sessionId,
      receipt: parsed.receipt,
      name: parsed.name,
      email: parsed.email,
    };
  } catch {
    return null;
  }
}

function persistSession(input: {
  sessionId: string;
  receipt: string;
  name: string;
  email: string;
}): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(input));
  } catch {
    /* ignore */
  }
}

export default function ChatWidget() {
  const { isLight } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [otpAvailable, setOtpAvailable] = useState(true);
  const [mode, setMode] = useState<Mode>('welcome');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerOnline, setOwnerOnline] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    interest: '',
    openingMessage: '',
    website: '',
  });
  const [otpStep, setOtpStep] = useState<{
    challengeId: string;
    challengeToken: string;
    maskedEmail: string;
  } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [liveReceipt, setLiveReceipt] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [customerName, setCustomerName] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const panel = isLight
    ? 'border-slate-200 bg-white text-slate-900'
    : 'border-slate-700/80 bg-[#0b101a] text-slate-100';
  const muted = isLight ? 'text-slate-500' : 'text-slate-400';
  const field = isLight
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400'
    : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500';

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/chat/status')
      .then(async (r) =>
        r.ok
          ? ((await r.json()) as {
              enabled?: boolean;
              ownerOnline?: boolean;
              suggestions?: string[];
              liveChatAvailable?: boolean;
            })
          : null
      )
      .then((data) => {
        if (cancelled || !data) return;
        setEnabled(data.enabled !== false);
        setOtpAvailable(data.liveChatAvailable !== false);
        setOwnerOnline(Boolean(data.ownerOnline));
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions.slice(0, 5));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, liveSession?.messages.length, open, mode]);

  useEffect(() => {
    if (mode !== 'chat' || !liveSession || !liveReceipt) return;
    const id = window.setInterval(() => {
      void fetch(
        `/api/chat/live/${encodeURIComponent(liveSession.sessionId)}?receipt=${encodeURIComponent(liveReceipt)}`
      )
        .then(async (r) =>
          r.ok
            ? ((await r.json()) as { session?: LiveSession; ownerOnline?: boolean })
            : null
        )
        .then((data) => {
          if (data?.session) setLiveSession(data.session);
          if (typeof data?.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
        })
        .catch(() => {});
    }, 3500);
    return () => window.clearInterval(id);
  }, [mode, liveSession, liveReceipt]);

  const enterVerifiedChat = (inputSession: {
    session: LiveSession;
    receipt: string;
    name: string;
    email: string;
    starterSuggestions?: string[];
  }) => {
    setLiveSession(inputSession.session);
    setLiveReceipt(inputSession.receipt);
    setCustomerName(inputSession.name);
    persistSession({
      sessionId: inputSession.session.sessionId,
      receipt: inputSession.receipt,
      name: inputSession.name,
      email: inputSession.email,
    });
    if (inputSession.starterSuggestions?.length) {
      setSuggestions(inputSession.starterSuggestions.slice(0, 5));
    }
    const fromSession: ChatBubble[] = inputSession.session.messages.map((m) => ({
      id: m.id,
      role: (m.role === 'visitor' || m.role === 'owner' || m.role === 'bot'
        ? m.role
        : 'system') as ChatBubble['role'],
      text: m.text,
    }));
    setBubbles(
      fromSession.length > 0
        ? fromSession
        : [
            {
              id: 'welcome-verified',
              role: 'bot',
              text: `Welcome, ${inputSession.name}! You’re verified. Ask anything about Mohammed’s portfolio — I’ll keep answers concise and suggest follow-ups.`,
            },
          ]
    );
    setMode('chat');
  };

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    setError(null);
    if (!next) return;

    const stored = loadStoredSession();
    if (stored) {
      setBusy(true);
      void fetch(
        `/api/chat/live/${encodeURIComponent(stored.sessionId)}?receipt=${encodeURIComponent(stored.receipt)}`
      )
        .then(async (r) =>
          r.ok
            ? ((await r.json()) as { session?: LiveSession; ownerOnline?: boolean })
            : null
        )
        .then((data) => {
          if (data?.session) {
            if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
            enterVerifiedChat({
              session: data.session,
              receipt: stored.receipt,
              name: stored.name,
              email: stored.email,
            });
            return;
          }
          setMode('welcome');
        })
        .catch(() => setMode('welcome'))
        .finally(() => setBusy(false));
      return;
    }
    setMode('welcome');
  };

  const askBot = async (question: string) => {
    const clean = question.trim();
    if (!clean || busy || !liveSession || !liveReceipt) return;
    setBusy(true);
    setError(null);
    setBubbles((prev) => [...prev, { id: `v-${Date.now()}`, role: 'visitor', text: clean }]);
    setInput('');
    try {
      const res = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: clean,
          visitorId: getOrCreateVisitorId(),
          sessionId: liveSession.sessionId,
          receipt: liveReceipt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        answer?: string;
        sources?: string[];
        suggestions?: string[];
        followUps?: string[];
        ownerOnline?: boolean;
        session?: LiveSession;
      };
      if (!res.ok) throw new Error(data.error || 'Unable to answer right now.');
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      if (Array.isArray(data.suggestions) && data.suggestions.length) {
        setSuggestions(data.suggestions);
      }
      if (data.session) setLiveSession(data.session);
      setBubbles((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: 'bot',
          text: data.answer || 'No answer returned.',
          sources: data.sources,
          followUps: Array.isArray(data.followUps) ? data.followUps.slice(0, 3) : [],
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat unavailable.');
    } finally {
      setBusy(false);
    }
  };

  const startRegistration = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!otpAvailable) {
      setError('Email verification is temporarily unavailable. Please use the contact form instead.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          interest: form.interest.trim(),
          openingMessage: form.openingMessage.trim(),
          website: form.website,
          theme: isLight ? 'light' : 'dark',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        challengeId?: string;
        challengeToken?: string;
        maskedEmail?: string;
        ownerOnline?: boolean;
      };
      if (!res.ok) throw new Error(data.error || 'Unable to start verification.');
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      if (!data.challengeId || !data.challengeToken) throw new Error('OTP challenge missing.');
      setOtpStep({
        challengeId: data.challengeId,
        challengeToken: data.challengeToken,
        maskedEmail: data.maskedEmail || form.email,
      });
      setMode('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start verification.');
    } finally {
      setBusy(false);
    }
  };

  const verifyRegistration = async (e: FormEvent) => {
    e.preventDefault();
    if (!otpStep || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/live/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: otpStep.challengeId,
          challengeToken: otpStep.challengeToken,
          code: otpCode.replace(/\s+/g, ''),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessionReceipt?: string;
        session?: LiveSession;
        ownerOnline?: boolean;
        suggestions?: string[];
      };
      if (!res.ok || !data.sessionReceipt || !data.session) {
        throw new Error(data.error || 'Invalid verification code.');
      }
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      enterVerifiedChat({
        session: data.session,
        receipt: data.sessionReceipt,
        name: form.name.trim() || data.session.visitorName || 'there',
        email: form.email.trim() || data.session.visitorEmail || '',
        starterSuggestions: data.suggestions,
      });
      setOtpCode('');
      setOtpStep(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const sendOwnerMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!liveSession || !liveReceipt || busy) return;
    const text = input.trim();
    if (!text) return;
    // Prefer bot Q&A for questions; owner path for explicit notes prefixed or when short greeting.
    if (!text.toLowerCase().startsWith('@mohammed') && !text.toLowerCase().startsWith('/msg')) {
      void askBot(text);
      return;
    }
    const cleaned = text.replace(/^(@mohammed|\/msg)\s*/i, '').trim() || text;
    setBusy(true);
    setError(null);
    setInput('');
    try {
      const res = await fetch(`/api/chat/live/${encodeURIComponent(liveSession.sessionId)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt: liveReceipt, text: cleaned }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        session?: LiveSession;
        ownerOnline?: boolean;
      };
      if (!res.ok || !data.session) throw new Error(data.error || 'Unable to send message.');
      setLiveSession(data.session);
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      setBubbles(
        data.session.messages.map((m) => ({
          id: m.id,
          role: (m.role === 'visitor' || m.role === 'owner' || m.role === 'bot'
            ? m.role
            : 'system') as ChatBubble['role'],
          text: m.text,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send.');
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) return null;

  const chipCls = isLight
    ? 'border-slate-200 hover:border-sky-300 text-slate-600 bg-white'
    : 'border-slate-700 hover:border-cyan-500/40 text-slate-300 bg-[#070b14]';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[42] flex justify-end p-[max(0.75rem,env(safe-area-inset-bottom))] pr-[max(0.75rem,env(safe-area-inset-right))] print:hidden sm:inset-x-auto sm:right-0 sm:bottom-0 sm:p-[max(1.25rem,env(safe-area-inset-bottom))] sm:pr-[max(1.25rem,env(safe-area-inset-right))]">
      <div className="pointer-events-none flex w-full max-w-[100vw] flex-col items-stretch gap-3 sm:w-auto sm:items-end">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
              className={`pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border shadow-2xl sm:w-[min(100vw-2rem,28rem)] md:w-[30rem] ${panel} h-[min(88dvh,40rem)] max-h-[calc(100dvh-5.5rem)] sm:h-[min(78dvh,38rem)]`}
              role="dialog"
              aria-label="Portfolio chat"
            >
              <div
                className={`flex items-center justify-between gap-2 px-3.5 py-3 border-b shrink-0 ${
                  isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#080c14]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">
                      {mode === 'chat' && customerName
                        ? `Hi, ${customerName.split(' ')[0]}`
                        : 'Portfolio Assistant'}
                    </span>
                  </div>
                  <div className={`text-[10px] font-mono uppercase tracking-wider ${muted}`}>
                    {mode === 'welcome' && 'Welcome'}
                    {mode === 'register' && 'Step 1 · Your details'}
                    {mode === 'otp' && 'Step 2 · Email OTP'}
                    {mode === 'chat' &&
                      (ownerOnline ? 'Verified · owner online' : 'Verified · owner queued')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`p-1.5 rounded-lg border ${isLight ? 'border-slate-200' : 'border-slate-700'} cursor-pointer`}
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2.5">
                {mode === 'welcome' && (
                  <div className="space-y-3 py-2">
                    <div
                      className={`rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${
                        isLight
                          ? 'border-sky-200 bg-sky-50 text-slate-800'
                          : 'border-cyan-500/25 bg-cyan-950/25 text-slate-100'
                      }`}
                    >
                      <p className="font-semibold mb-1">Welcome — glad you’re here.</p>
                      <p className={`text-xs ${muted}`}>
                        To chat about Mohammed’s experience, skills, or opportunities, we’ll collect a few
                        details and verify your email with a one-time code. Then you can ask questions with
                        concise answers and suggested follow-ups.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(suggestions.length ? suggestions : [
                        'Current role at Cisco',
                        'Cloud & platform experience',
                        'Security / Zero Trust',
                        'Contact & CV',
                      ]).slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className={`text-[10px] font-mono px-2 py-1 rounded-lg border ${chipCls}`}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMode('register');
                      }}
                      className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm py-2.5 cursor-pointer"
                    >
                      Continue — collect my details
                    </button>
                    {!otpAvailable && (
                      <p className="text-[11px] text-amber-400">
                        Email OTP is temporarily unavailable. Please use the contact form instead.
                      </p>
                    )}
                  </div>
                )}

                {(mode === 'chat' ? bubbles : []).map((b) => (
                  <div
                    key={b.id}
                    className={`flex gap-2 ${b.role === 'visitor' ? 'justify-end' : 'justify-start'}`}
                  >
                    {b.role !== 'visitor' && (
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                          isLight
                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                            : 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300'
                        }`}
                      >
                        {b.role === 'owner' ? (
                          <UserRound className="w-3.5 h-3.5" />
                        ) : (
                          <Bot className="w-3.5 h-3.5" />
                        )}
                      </div>
                    )}
                    <div className="max-w-[min(88%,22rem)] space-y-1.5">
                      <div
                        className={`rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                          b.role === 'visitor'
                            ? 'bg-cyan-500 text-slate-950'
                            : b.role === 'system'
                              ? isLight
                                ? 'bg-amber-50 border border-amber-200 text-amber-900'
                                : 'bg-amber-950/30 border border-amber-500/30 text-amber-100'
                              : isLight
                                ? 'bg-slate-100 text-slate-800'
                                : 'bg-[#121826] text-slate-200'
                        }`}
                      >
                        {b.text}
                        {b.sources && b.sources.length > 0 && (
                          <div className={`mt-1.5 text-[10px] font-mono ${muted}`}>
                            Sources: {b.sources.join(' · ')}
                          </div>
                        )}
                      </div>
                      {b.followUps && b.followUps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-0.5">
                          {b.followUps.map((fu) => (
                            <button
                              key={fu}
                              type="button"
                              disabled={busy}
                              onClick={() => void askBot(fu)}
                              className={`text-[10px] font-mono px-2 py-1 rounded-lg border cursor-pointer disabled:opacity-50 ${chipCls}`}
                            >
                              {fu}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="px-3 pb-1 text-[11px] text-rose-400 shrink-0" role="alert">
                  {error}
                </div>
              )}

              {mode === 'register' && (
                <form
                  onSubmit={startRegistration}
                  className={`p-3 border-t space-y-2 shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}
                >
                  <p className={`text-[11px] ${muted}`}>
                    Tell us who you are. We’ll email a 6-digit code to create your chat profile.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Full name *"
                      className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 ${field}`}
                    />
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Work email *"
                      className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 ${field}`}
                    />
                    <input
                      value={form.company}
                      onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                      placeholder="Company (optional)"
                      className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 ${field}`}
                    />
                    <input
                      value={form.interest}
                      onChange={(e) => setForm((p) => ({ ...p, interest: e.target.value }))}
                      placeholder="Interest (optional)"
                      className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 ${field}`}
                    />
                  </div>
                  <textarea
                    value={form.openingMessage}
                    onChange={(e) => setForm((p) => ({ ...p, openingMessage: e.target.value }))}
                    placeholder="Optional note for Mohammed"
                    rows={2}
                    className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none resize-none focus:border-cyan-400 ${field}`}
                  />
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={form.website}
                    onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('welcome')}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs cursor-pointer ${isLight ? 'border-slate-200' : 'border-slate-700'}`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={busy || !otpAvailable}
                      className="flex-[1.4] rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs py-2 disabled:opacity-50 cursor-pointer"
                    >
                      {busy ? 'Sending code…' : 'Send OTP'}
                    </button>
                  </div>
                </form>
              )}

              {mode === 'otp' && otpStep && (
                <form
                  onSubmit={verifyRegistration}
                  className={`p-3 border-t space-y-2 shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}
                >
                  <p className={`text-[11px] ${muted}`}>
                    Enter the 6-digit code sent to {otpStep.maskedEmail} to create your customer chat profile.
                  </p>
                  <input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="######"
                    autoFocus
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm font-mono tracking-[0.3em] text-center focus:outline-none focus:border-cyan-400 ${field}`}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setOtpCode('');
                      }}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs cursor-pointer ${isLight ? 'border-slate-200' : 'border-slate-700'}`}
                    >
                      Edit details
                    </button>
                    <button
                      type="submit"
                      disabled={busy || otpCode.replace(/\s+/g, '').length !== 6}
                      className="flex-[1.4] rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs py-2 disabled:opacity-50 cursor-pointer"
                    >
                      {busy ? 'Verifying…' : 'Verify & start chat'}
                    </button>
                  </div>
                </form>
              )}

              {mode === 'chat' && (
                <>
                  <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
                    {suggestions.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => void askBot(s)}
                        className={`text-[10px] font-mono px-2 py-1 rounded-lg border cursor-pointer disabled:opacity-50 ${chipCls}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={sendOwnerMessage}
                    className={`p-3 border-t flex gap-2 shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}
                  >
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a concise question… (@mohammed for live note)"
                      className={`flex-1 min-w-0 rounded-xl border px-3 py-2.5 text-xs focus:outline-none focus:border-cyan-400 ${field}`}
                    />
                    <button
                      type="submit"
                      disabled={busy || input.trim().length < 2}
                      className="inline-flex items-center justify-center rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 px-3 cursor-pointer"
                      aria-label="Send question"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleOpen}
          className="pointer-events-auto ml-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label={open ? 'Close portfolio chat' : 'Open portfolio chat'}
        >
          {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        </motion.button>
      </div>
    </div>
  );
}
