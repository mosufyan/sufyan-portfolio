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
  Headphones,
} from 'lucide-react';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import { useTheme } from '../theme/ThemeProvider';

type ChatBubble = {
  id: string;
  role: 'visitor' | 'bot' | 'owner' | 'system';
  text: string;
  sources?: string[];
};

type LiveSession = {
  sessionId: string;
  status: string;
  messages: Array<{ id: string; role: string; text: string; createdAtMs: number }>;
};

export default function ChatWidget() {
  const { isLight } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'bot' | 'live-start' | 'live-otp' | 'live'>('bot');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerOnline, setOwnerOnline] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hi — ask me anything about Mohammed’s portfolio (experience, skills, certifications, contact). You can also request a live chat after email OTP verification.',
    },
  ]);
  const [liveForm, setLiveForm] = useState({ name: '', email: '', openingMessage: '', website: '' });
  const [otpStep, setOtpStep] = useState<{
    challengeId: string;
    challengeToken: string;
    maskedEmail: string;
  } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [liveReceipt, setLiveReceipt] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
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
      .then(async (r) => (r.ok ? ((await r.json()) as { ownerOnline?: boolean; suggestions?: string[] }) : null))
      .then((data) => {
        if (cancelled || !data) return;
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
  }, [bubbles, liveSession?.messages.length, open]);

  useEffect(() => {
    if (mode !== 'live' || !liveSession || !liveReceipt) return;
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

  const askBot = async (question: string) => {
    const clean = question.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    setBubbles((prev) => [
      ...prev,
      { id: `v-${Date.now()}`, role: 'visitor', text: clean },
    ]);
    setInput('');
    try {
      const res = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: clean }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        answer?: string;
        sources?: string[];
        suggestions?: string[];
        offerLiveAgent?: boolean;
        ownerOnline?: boolean;
      };
      if (!res.ok) throw new Error(data.error || 'Unable to answer right now.');
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
      setBubbles((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: 'bot',
          text: data.answer || 'No answer returned.',
          sources: data.sources,
        },
      ]);
      if (data.offerLiveAgent) {
        setBubbles((prev) => [
          ...prev,
          {
            id: `s-${Date.now()}`,
            role: 'system',
            text: ownerOnline
              ? 'Want a live answer? Request live chat — Mohammed appears online.'
              : 'Want a human follow-up? Request live chat (email OTP). Your request will queue in the Owner Console.',
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat unavailable.');
    } finally {
      setBusy(false);
    }
  };

  const startLive = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: liveForm.name.trim(),
          email: liveForm.email.trim(),
          openingMessage: liveForm.openingMessage.trim() || input.trim(),
          website: liveForm.website,
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
      if (!res.ok) throw new Error(data.error || 'Unable to start live chat.');
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      if (!data.challengeId || !data.challengeToken) throw new Error('OTP challenge missing.');
      setOtpStep({
        challengeId: data.challengeId,
        challengeToken: data.challengeToken,
        maskedEmail: data.maskedEmail || liveForm.email,
      });
      setMode('live-otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start live chat.');
    } finally {
      setBusy(false);
    }
  };

  const verifyLive = async (e: FormEvent) => {
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
      };
      if (!res.ok || !data.sessionReceipt || !data.session) {
        throw new Error(data.error || 'Invalid verification code.');
      }
      setLiveReceipt(data.sessionReceipt);
      setLiveSession(data.session);
      setMode('live');
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const sendLiveMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!liveSession || !liveReceipt || busy) return;
    const text = input.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setInput('');
    try {
      const res = await fetch(`/api/chat/live/${encodeURIComponent(liveSession.sessionId)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt: liveReceipt, text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        session?: LiveSession;
        ownerOnline?: boolean;
      };
      if (!res.ok || !data.session) throw new Error(data.error || 'Unable to send message.');
      setLiveSession(data.session);
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send.');
    } finally {
      setBusy(false);
    }
  };

  const renderBubbles: ChatBubble[] =
    mode === 'live' && liveSession
      ? liveSession.messages.map((m) => ({
          id: m.id,
          role: (m.role === 'visitor' || m.role === 'owner' || m.role === 'bot'
            ? m.role
            : 'system') as ChatBubble['role'],
          text: m.text,
        }))
      : bubbles;

  return (
    <div className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-[42] flex flex-col items-end gap-3 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
            className={`pointer-events-auto w-[min(100vw-1.5rem,24rem)] sm:w-[26rem] max-h-[min(70dvh,34rem)] rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${panel}`}
          >
            <div
              className={`flex items-center justify-between gap-2 px-3.5 py-3 border-b ${
                isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#080c14]'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="truncate">Portfolio Assistant</span>
                </div>
                <div className={`text-[10px] font-mono uppercase tracking-wider ${muted}`}>
                  {ownerOnline ? 'Owner presence: online' : 'Owner presence: offline / queued'}
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
              {renderBubbles.map((b) => (
                <div
                  key={b.id}
                  className={`flex gap-2 ${b.role === 'visitor' ? 'justify-end' : 'justify-start'}`}
                >
                  {b.role !== 'visitor' && (
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                        isLight ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300'
                      }`}
                    >
                      {b.role === 'owner' ? <UserRound className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
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
                </div>
              ))}
            </div>

            {error && (
              <div className="px-3 pb-1 text-[11px] text-rose-400" role="alert">
                {error}
              </div>
            )}

            {mode === 'bot' && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {suggestions.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void askBot(s)}
                    className={`text-[10px] font-mono px-2 py-1 rounded-lg border cursor-pointer ${
                      isLight
                        ? 'border-slate-200 hover:border-sky-300 text-slate-600'
                        : 'border-slate-700 hover:border-cyan-500/40 text-slate-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMode('live-start')}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-lg border border-cyan-500/40 text-cyan-300 cursor-pointer"
                >
                  <Headphones className="w-3 h-3" />
                  Request live agent
                </button>
              </div>
            )}

            {mode === 'bot' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void askBot(input);
                }}
                className={`p-3 border-t flex gap-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about experience, skills, contact…"
                  className={`flex-1 min-w-0 rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 ${field}`}
                />
                <button
                  type="submit"
                  disabled={busy || input.trim().length < 3}
                  className="inline-flex items-center justify-center rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 px-3 cursor-pointer"
                  aria-label="Send question"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            )}

            {mode === 'live-start' && (
              <form onSubmit={startLive} className={`p-3 border-t space-y-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <input
                  required
                  value={liveForm.name}
                  onChange={(e) => setLiveForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your name"
                  className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${field}`}
                />
                <input
                  required
                  type="email"
                  value={liveForm.email}
                  onChange={(e) => setLiveForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Email for OTP"
                  className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${field}`}
                />
                <textarea
                  value={liveForm.openingMessage}
                  onChange={(e) => setLiveForm((p) => ({ ...p, openingMessage: e.target.value }))}
                  placeholder="Optional opening message"
                  rows={2}
                  className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none resize-none ${field}`}
                />
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={liveForm.website}
                  onChange={(e) => setLiveForm((p) => ({ ...p, website: e.target.value }))}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('bot')}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs cursor-pointer ${isLight ? 'border-slate-200' : 'border-slate-700'}`}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs py-2 disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Sending…' : 'Send OTP'}
                  </button>
                </div>
              </form>
            )}

            {mode === 'live-otp' && otpStep && (
              <form onSubmit={verifyLive} className={`p-3 border-t space-y-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <p className={`text-[11px] ${muted}`}>
                  Enter the 6-digit code sent to {otpStep.maskedEmail}.
                </p>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="######"
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-mono tracking-[0.3em] text-center focus:outline-none ${field}`}
                />
                <button
                  type="submit"
                  disabled={busy || otpCode.replace(/\s+/g, '').length !== 6}
                  className="w-full rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs py-2 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Verifying…' : 'Start live chat'}
                </button>
              </form>
            )}

            {mode === 'live' && (
              <form
                onSubmit={sendLiveMessage}
                className={`p-3 border-t flex gap-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message Mohammed…"
                  className={`flex-1 min-w-0 rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 ${field}`}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="inline-flex items-center justify-center rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 px-3 cursor-pointer"
                  aria-label="Send live message"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        aria-label={open ? 'Close portfolio chat' : 'Open portfolio chat'}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </motion.button>
    </div>
  );
}
