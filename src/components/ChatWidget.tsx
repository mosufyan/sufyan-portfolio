import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bot,
  Loader2,
  Maximize2,
  MessageCircle,
  MessageSquarePlus,
  Minimize2,
  Sparkles,
  X,
} from 'lucide-react';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import ModalHeaderScan from './ModalHeaderScan';
import { useTheme } from '../theme/ThemeProvider';
import { toUserFacingError } from '../utils/userFacingError';
import {
  CHAT_WINDOW_DEFAULT,
  clampChatWindowSize,
  expandedChatWindowSize,
  loadChatWindowSize,
  saveChatWindowSize,
  type ChatWindowSize,
} from '../utils/chatWindowLayout';
import ChatMessageComposer from './ChatMessageComposer';

const OWNER_AVATAR_SRC = '/assets/aistudio/Sufyan_hero_portrait.png';

type ChatBubble = {
  id: string;
  role: 'visitor' | 'bot' | 'owner' | 'system';
  text: string;
  sources?: string[];
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
const SESSION_EXPIRED_MESSAGE =
  'Your verified session expired. Please verify your email again to continue.';

function chatReceiptHeaders(receipt: string): HeadersInit {
  return { 'X-Chat-Receipt': receipt };
}

function isSessionExpiredResponse(
  status: number,
  data: { code?: string; error?: string } | null | undefined
): boolean {
  if (status !== 401) return false;
  if (data?.code === 'session_expired') return true;
  const err = (data?.error || '').toLowerCase();
  return err.includes('expired') || err.includes('re-verify') || err.includes('verify your email');
}

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

function bubblesFromSession(
  messages: LiveSession['messages']
): ChatBubble[] {
  return messages.map((m) => ({
    id: m.id,
    role: (m.role === 'visitor' || m.role === 'owner' || m.role === 'bot'
      ? m.role
      : 'system') as ChatBubble['role'],
    text: m.text,
  }));
}

/** Verified chat auth stays in memory only — no receipt/PII in sessionStorage. */
let memoryChatSession: {
  sessionId: string;
  receipt: string;
  name: string;
  email: string;
} | null = null;

function loadStoredSession(): {
  sessionId: string;
  receipt: string;
  name: string;
  email: string;
} | null {
  // Drop any legacy sessionStorage payload from older builds.
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return memoryChatSession;
}

function persistSession(input: {
  sessionId: string;
  receipt: string;
  name: string;
  email: string;
}): void {
  memoryChatSession = input;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function clearStoredSession(): void {
  memoryChatSession = null;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
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
  const [turnstileSiteKey, setTurnstileSiteKey] = useState(
    () => (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || ''
  );
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<{
    edge: 'left' | 'top' | 'corner';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [windowSize, setWindowSize] = useState<ChatWindowSize>(() => ({ ...CHAT_WINDOW_DEFAULT }));
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    setWindowSize(loadChatWindowSize());
    const syncViewport = () => {
      setIsNarrow(window.matchMedia('(max-width: 639px)').matches);
      setWindowSize((prev) => clampChatWindowSize(prev));
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    if (expanded || isNarrow) return;
    saveChatWindowSize(windowSize);
  }, [windowSize, expanded, isNarrow]);

  const beginResize = (edge: 'left' | 'top' | 'corner') => (event: ReactPointerEvent) => {
    if (isNarrow || expanded) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    resizeRef.current = {
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startW: windowSize.width,
      startH: windowSize.height,
    };
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const active = resizeRef.current;
      if (!active) return;
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      // Panel is anchored bottom-right: drag left/top edges outward to grow.
      const nextW =
        active.edge === 'left' || active.edge === 'corner' ? active.startW - dx : active.startW;
      const nextH =
        active.edge === 'top' || active.edge === 'corner' ? active.startH - dy : active.startH;
      setWindowSize(clampChatWindowSize({ width: nextW, height: nextH }));
    };
    const onUp = () => {
      resizeRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const toggleExpanded = () => {
    setExpanded((prev) => {
      if (prev) {
        setWindowSize(loadChatWindowSize());
        return false;
      }
      setWindowSize(
        expandedChatWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      );
      return true;
    });
  };

  const panel = isLight
    ? 'border-slate-200 bg-white text-slate-900'
    : 'border-slate-700/80 bg-[#0b101a] text-slate-100';
  const muted = isLight ? 'text-slate-500' : 'text-slate-400';
  const field = isLight
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400'
    : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500';


  useEffect(() => {
    let cancelled = false;
    const refreshStatus = () => {
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
    };
    refreshStatus();
    // Poll so Online clears soon after owner logout (not only on next open).
    const pollMs = open ? 15_000 : 30_000;
    const id = window.setInterval(refreshStatus, pollMs);
    if (!turnstileSiteKey) {
      void fetch('/api/access-config')
        .then(async (r) => (r.ok ? ((await r.json()) as { turnstileSiteKey?: string }) : null))
        .then((cfg) => {
          if (!cancelled && cfg?.turnstileSiteKey) setTurnstileSiteKey(cfg.turnstileSiteKey);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, turnstileSiteKey]);

  useEffect(() => {
    if (!open || mode !== 'register' || !turnstileSiteKey) return;
    const container = turnstileContainerRef.current;
    if (!container) return;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !window.turnstile || !turnstileContainerRef.current) return;
      if (turnstileWidgetIdRef.current) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        theme: isLight ? 'light' : 'dark',
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      });
    };
    if (window.turnstile) {
      mount();
    } else {
      const existing = document.querySelector('script[data-turnstile]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.dataset.turnstile = '1';
        script.onload = () => mount();
        document.head.appendChild(script);
      } else {
        const timer = window.setInterval(() => {
          if (window.turnstile) {
            window.clearInterval(timer);
            mount();
          }
        }, 200);
        return () => {
          cancelled = true;
          window.clearInterval(timer);
        };
      }
    }
    return () => {
      cancelled = true;
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [open, mode, turnstileSiteKey, isLight]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, liveSession?.messages.length, open, mode]);

  const forceReverify = (message = SESSION_EXPIRED_MESSAGE) => {
    clearStoredSession();
    setLiveSession(null);
    setLiveReceipt(null);
    setBubbles([]);
    setOtpStep(null);
    setOtpCode('');
    setInput('');
    setMode('register');
    setError(message);
  };

  useEffect(() => {
    if (mode !== 'chat' || !liveSession || !liveReceipt) return;
    const id = window.setInterval(() => {
      void fetch(`/api/chat/live/${encodeURIComponent(liveSession.sessionId)}`, {
        headers: chatReceiptHeaders(liveReceipt),
      })
        .then(async (r) => {
          const data = (await r.json().catch(() => ({}))) as {
            session?: LiveSession;
            ownerOnline?: boolean;
            code?: string;
            error?: string;
          };
          if (isSessionExpiredResponse(r.status, data)) {
            forceReverify(data.error || SESSION_EXPIRED_MESSAGE);
            return null;
          }
          return r.ok ? data : null;
        })
        .then((data) => {
          if (!data) return;
          if (data.session) setLiveSession(data.session);
          if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
        })
        .catch(() => {});
    }, 3500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- forceReverify closes over setters only
  }, [mode, liveSession, liveReceipt]);

  // Keep the visible thread aligned with the server thread (new chat + owner replies).
  useEffect(() => {
    if (mode !== 'chat' || !liveSession || busy) return;
    const next = bubblesFromSession(liveSession.messages);
    if (next.length === 0) return;
    setBubbles((prev) => {
      const merged = next.map((n) => {
        const prior =
          prev.find((p) => p.id === n.id) ||
          prev.find((p) => p.role === n.role && p.text === n.text && p.sources?.length);
        return prior?.sources?.length ? { ...n, sources: prior.sources } : n;
      });
      if (
        prev.length === merged.length &&
        prev.every(
          (b, i) =>
            b.id === merged[i]?.id &&
            b.text === merged[i]?.text &&
            (b.sources || []).join('|') === (merged[i]?.sources || []).join('|')
        )
      ) {
        return prev;
      }
      return merged;
    });
  }, [mode, liveSession, busy]);

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
    const fromSession = bubblesFromSession(inputSession.session.messages);
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

  const startNewChat = async () => {
    if (busy || !liveSession || !liveReceipt || mode !== 'chat') return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/live/${encodeURIComponent(liveSession.sessionId)}/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...chatReceiptHeaders(liveReceipt),
        },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        session?: LiveSession;
        ownerOnline?: boolean;
        suggestions?: string[];
      };
      if (isSessionExpiredResponse(res.status, data)) {
        forceReverify(data.error || SESSION_EXPIRED_MESSAGE);
        return;
      }
      if (!res.ok || !data.session) {
        throw new Error(data.error || 'Unable to start a new chat.');
      }
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      setLiveSession(data.session);
      setBubbles(bubblesFromSession(data.session.messages));
      if (Array.isArray(data.suggestions) && data.suggestions.length) {
        setSuggestions(data.suggestions.slice(0, 5));
      }
      setInput('');
    } catch (err) {
      setError(toUserFacingError(err, 'Unable to start a new chat.'));
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    setError(null);
    if (!next) return;

    const stored = loadStoredSession();
    if (stored) {
      setBusy(true);
      void fetch(`/api/chat/live/${encodeURIComponent(stored.sessionId)}`, {
        headers: chatReceiptHeaders(stored.receipt),
      })
        .then(async (r) => {
          const data = (await r.json().catch(() => ({}))) as {
            session?: LiveSession;
            ownerOnline?: boolean;
            code?: string;
            error?: string;
          };
          if (isSessionExpiredResponse(r.status, data)) {
            forceReverify(data.error || SESSION_EXPIRED_MESSAGE);
            return null;
          }
          return r.ok ? data : null;
        })
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
          if (data === null) return;
          clearStoredSession();
          setMode('welcome');
        })
        .catch(() => {
          clearStoredSession();
          setMode('welcome');
        })
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
        headers: {
          'Content-Type': 'application/json',
          ...chatReceiptHeaders(liveReceipt),
        },
        body: JSON.stringify({
          question: clean,
          visitorId: getOrCreateVisitorId(),
          sessionId: liveSession.sessionId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        answer?: string;
        sources?: string[];
        suggestions?: string[];
        followUps?: string[];
        ownerOnline?: boolean;
        session?: LiveSession;
      };
      if (isSessionExpiredResponse(res.status, data)) {
        forceReverify(data.error || SESSION_EXPIRED_MESSAGE);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Unable to answer right now.');
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      // Replace starter chips with contextual follow-ups (single chip strip near the input).
      const nextChips = Array.isArray(data.followUps) && data.followUps.length
        ? data.followUps
        : Array.isArray(data.suggestions)
          ? data.suggestions
          : [];
      if (nextChips.length) setSuggestions(nextChips.slice(0, 4));
      if (data.session) setLiveSession(data.session);
      setBubbles((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: 'bot',
          text: data.answer || 'No answer returned.',
          sources: data.sources,
        },
      ]);
    } catch (err) {
      setError(toUserFacingError(err, 'Chat unavailable.'));
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
      if (turnstileSiteKey && turnstileToken.trim().length < 10) {
        throw new Error('Please complete the bot verification challenge.');
      }
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
          turnstileToken: turnstileToken || undefined,
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
      setError(toUserFacingError(err, 'Unable to start verification.'));
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
      setError(toUserFacingError(err, 'Verification failed.'));
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
        headers: {
          'Content-Type': 'application/json',
          ...chatReceiptHeaders(liveReceipt),
        },
        body: JSON.stringify({ text: cleaned }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        session?: LiveSession;
        ownerOnline?: boolean;
      };
      if (isSessionExpiredResponse(res.status, data)) {
        forceReverify(data.error || SESSION_EXPIRED_MESSAGE);
        return;
      }
      if (!res.ok || !data.session) throw new Error(data.error || 'Unable to send message.');
      setLiveSession(data.session);
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      setBubbles(bubblesFromSession(data.session.messages));
    } catch (err) {
      setError(toUserFacingError(err, 'Unable to send.'));
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) return null;

  const chipCls = isLight
    ? 'border-slate-200 hover:border-sky-300 text-slate-600 bg-white'
    : 'border-slate-700 hover:border-cyan-500/40 text-slate-300 bg-[#070b14]';

  const panelStyle =
    isNarrow
      ? expanded
        ? {
            width: '100%',
            height: 'min(100dvh - 4.5rem, 100dvh - env(safe-area-inset-bottom) - 4.5rem)',
            maxHeight: 'calc(100dvh - 4.5rem)',
          }
        : {
            width: '100%',
            height: 'min(88dvh, 40rem)',
            maxHeight: 'calc(100dvh - 5.5rem)',
          }
      : expanded
        ? {
            width: Math.min(window.innerWidth - 24, Math.max(windowSize.width, 640)),
            height: Math.min(window.innerHeight - 88, Math.max(windowSize.height, 480)),
            maxWidth: 'calc(100vw - 1.5rem)',
            maxHeight: 'calc(100dvh - 5.5rem)',
          }
        : {
            width: windowSize.width,
            height: windowSize.height,
            maxWidth: 'calc(100vw - 1.5rem)',
            maxHeight: 'calc(100dvh - 5.5rem)',
          };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[42] flex justify-end p-[max(0.75rem,env(safe-area-inset-bottom))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] print:hidden sm:inset-x-auto sm:right-0 sm:bottom-0 sm:p-[max(1.25rem,env(safe-area-inset-bottom))] sm:pr-[max(1.25rem,env(safe-area-inset-right))]">
      <div className="pointer-events-none flex w-full max-w-[100vw] flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:items-end">
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
              style={panelStyle as CSSProperties}
              className={`pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-2xl border shadow-2xl ${panel} ${
                isNarrow ? 'max-w-full' : ''
              }`}
              role="dialog"
              aria-label="Portfolio chat"
              aria-modal="true"
            >
              {!isNarrow && !expanded && (
                <>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize chat width"
                    onPointerDown={beginResize('left')}
                    className="absolute inset-y-3 left-0 z-20 w-2 cursor-ew-resize touch-none"
                  />
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize chat height"
                    onPointerDown={beginResize('top')}
                    className="absolute inset-x-3 top-0 z-20 h-2 cursor-ns-resize touch-none"
                  />
                  <div
                    role="separator"
                    aria-label="Resize chat"
                    onPointerDown={beginResize('corner')}
                    className="absolute left-0 top-0 z-30 h-4 w-4 cursor-nwse-resize touch-none"
                  />
                </>
              )}
              {/* Always-dark header — navbar-chrome opts out of lightTheme remaps */}
              <div className="navbar-chrome relative flex items-center justify-between gap-2 px-3.5 py-3 border-b border-slate-800 bg-[#080b13] shrink-0">
                <ModalHeaderScan active={open} />
                <div className="relative min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">
                      {mode === 'chat' && customerName
                        ? `Hi, ${customerName.split(' ')[0]}`
                        : 'Portfolio Assistant'}
                    </span>
                    {ownerOnline && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-emerald-300"
                        title="Mohammed is online"
                      >
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </span>
                        Online
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {mode === 'welcome' && 'Welcome'}
                    {mode === 'register' && 'Step 1 · Your details'}
                    {mode === 'otp' && 'Step 2 · Email OTP'}
                    {mode === 'chat' &&
                      (ownerOnline ? 'Verified · owner online' : 'Verified · owner queued')}
                  </div>
                </div>
                <div className="relative flex items-center gap-1.5 shrink-0">
                  {mode === 'chat' && liveSession && liveReceipt && (
                    <button
                      type="button"
                      onClick={() => void startNewChat()}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-50 cursor-pointer"
                      aria-label="Start a new chat"
                      title="Start a new chat"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">New chat</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    aria-label={expanded ? 'Collapse chat' : 'Expand chat'}
                    title={expanded ? 'Collapse' : 'Expand'}
                  >
                    {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    aria-label="Close chat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
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
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${
                          b.role === 'owner'
                            ? isLight
                              ? 'border-sky-300 bg-slate-100'
                              : 'border-cyan-400/50 bg-[#0b1220]'
                            : isLight
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300'
                        }`}
                      >
                        {b.role === 'owner' ? (
                          <img
                            src={OWNER_AVATAR_SRC}
                            alt="Mohammed Sufyan"
                            width={28}
                            height={28}
                            className="h-full w-full object-cover object-top"
                            decoding="async"
                          />
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
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="px-3 pb-2 shrink-0 text-[11px] text-rose-400" role="alert">
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
                  {turnstileSiteKey ? (
                    <div className="flex w-full justify-center min-h-[65px]">
                      <div ref={turnstileContainerRef} />
                    </div>
                  ) : null}
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
                  <div
                    className={`p-3 border-t shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}
                  >
                    <ChatMessageComposer
                      value={input}
                      onChange={setInput}
                      onSubmit={sendOwnerMessage}
                      busy={busy}
                      isLight={isLight}
                      placeholder="Ask a concise question… (@mohammed for live note)"
                      submitAriaLabel="Send question"
                      minSubmitLength={2}
                    />
                  </div>
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
          className="pointer-events-auto relative ml-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label={open ? 'Close portfolio chat' : 'Open portfolio chat'}
        >
          {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
          {!open && ownerOnline && (
            <span
              className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#020617] bg-emerald-400"
              title="Owner online"
              aria-hidden
            />
          )}
        </motion.button>
      </div>
    </div>
  );
}
