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
  Headphones,
  Loader2,
  Maximize2,
  MessageCircle,
  MessageSquarePlus,
  Mic,
  Minimize2,
  Sparkles,
  Volume2,
  VolumeX,
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
import VoiceWaveform from './VoiceWaveform';
import { viteTurnstileSiteKey } from '../vitePublicEnv.ts';
import { ensureMicrophoneAccess, getMicrophoneEnableHelp } from '../utils/chatComposer';
import {
  playAudioBase64,
  speakWithBrowserTts,
  stopBrowserTts,
} from '../utils/browserTts';
import { createVoiceTransport } from '../utils/voiceTransport';
import { GrokRealtimeVoiceSession } from '../utils/grokRealtimeVoice';

type VoicePath = 'ptt' | 'live';

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
  const [requireOtpForChat, setRequireOtpForChat] = useState(true);
  const [voiceAgentAvailable, setVoiceAgentAvailable] = useState(false);
  const [voiceRealtimeAvailable, setVoiceRealtimeAvailable] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voicePath, setVoicePath] = useState<VoicePath>('ptt');
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [liveVoiceActive, setLiveVoiceActive] = useState(false);
  const [liveVoiceStatus, setLiveVoiceStatus] = useState('');
  const [liveCaptions, setLiveCaptions] = useState<
    Array<{ id: string; role: 'visitor' | 'bot'; text: string }>
  >([]);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [pttSpeaking, setPttSpeaking] = useState(false);
  const [mode, setMode] = useState<Mode>('welcome');
  const voiceStageMode =
    mode === 'chat' &&
    voiceMode &&
    ((voicePath === 'ptt' && voiceAgentAvailable) ||
      (voicePath === 'live' && voiceRealtimeAvailable));
  const pttStage = voiceStageMode && voicePath === 'ptt';
  const liveStage = voiceStageMode && voicePath === 'live';
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerOnline, setOwnerOnline] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceTransportRef = useRef(createVoiceTransport('http-turn'));
  const liveVoiceRef = useRef<GrokRealtimeVoiceSession | null>(null);
  const pttMeterCtxRef = useRef<AudioContext | null>(null);
  const pttMeterRafRef = useRef<number | null>(null);
  const voiceLevelDecayRef = useRef<number | null>(null);
  /** Bumped to cancel in-flight PTT turns / TTS when the visitor barges in. */
  const pttTurnGenRef = useRef(0);
  const anyVoiceAvailable = voiceAgentAvailable || voiceRealtimeAvailable;
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
    () => viteTurnstileSiteKey()
  );
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const voiceCaptionsRef = useRef<HTMLDivElement | null>(null);
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
  /** Dark → cyan; light → amber (matches site theme accents). */
  const voiceAccent = isLight
    ? {
        selected:
          'border-amber-400/60 bg-amber-500/15 text-amber-900',
        idle: 'border-slate-300 text-slate-600 hover:text-amber-900 hover:border-amber-400/40',
        visitorBubble: 'bg-amber-500 text-slate-950',
        botBubble: 'bg-amber-50 text-slate-800',
        primaryBtn: 'border-amber-400 bg-amber-500 text-slate-950',
        primaryIdle: 'border-amber-300 bg-amber-500 text-slate-950',
        statusHover: 'hover:text-amber-700',
      }
    : {
        selected: 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200',
        idle: 'border-slate-700 text-slate-400 hover:text-slate-200',
        visitorBubble: 'bg-cyan-500 text-slate-950',
        botBubble: 'bg-[#121826] text-slate-200',
        primaryBtn: 'border-cyan-400/50 bg-cyan-500 text-slate-950',
        primaryIdle: 'border-cyan-400/50 bg-cyan-500 text-slate-950',
        statusHover: 'hover:text-cyan-300',
      };
  const waveformActive =
    (liveStage && liveVoiceActive) ||
    (pttStage && (recording || pttSpeaking || (busy && !recording)));
  const pttCanInterrupt = pttStage && (pttSpeaking || (busy && !recording));

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
                requireOtpForChat?: boolean;
                voiceAgentAvailable?: boolean;
                voiceRealtimeAvailable?: boolean;
              })
            : null
        )
        .then((data) => {
          if (cancelled || !data) return;
          setEnabled(data.enabled !== false);
          setOtpAvailable(data.liveChatAvailable !== false);
          if (typeof data.requireOtpForChat === 'boolean') {
            setRequireOtpForChat(data.requireOtpForChat);
          }
          const ptt = Boolean(data.voiceAgentAvailable);
          const live = Boolean(data.voiceRealtimeAvailable);
          setVoiceAgentAvailable(ptt);
          setVoiceRealtimeAvailable(live);
          if (!ptt && !live) setVoiceMode(false);
          setVoicePath((prev) => {
            if (prev === 'live' && live) return 'live';
            if (prev === 'ptt' && ptt) return 'ptt';
            if (live && !ptt) return 'live';
            return 'ptt';
          });
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
        .then(async (r) =>
          r.ok
            ? ((await r.json()) as { turnstileSiteKey?: string; requireOtpForChat?: boolean })
            : null
        )
        .then((cfg) => {
          if (cancelled || !cfg) return;
          if (cfg.turnstileSiteKey) setTurnstileSiteKey(cfg.turnstileSiteKey);
          if (typeof cfg.requireOtpForChat === 'boolean') {
            setRequireOtpForChat(cfg.requireOtpForChat);
          }
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
    const el = listRef.current;
    if (!el) return;
    // Keep the latest answer visible above the sticky chip/input footer.
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [bubbles, suggestions, liveSession?.messages.length, open, mode]);

  useEffect(() => {
    if (!voiceStageMode) return;
    const el = voiceCaptionsRef.current;
    if (!el) return;
    // Pin PTT / live captions to the newest exchange (not stuck on Q1).
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [liveCaptions, voiceStageMode, pttSpeaking, liveVoiceStatus]);

  const stopLiveVoice = async () => {
    const session = liveVoiceRef.current;
    liveVoiceRef.current = null;
    setLiveVoiceActive(false);
    setLiveVoiceStatus('');
    setVoiceLevel(0);
    if (session) {
      try {
        await session.stop();
      } catch {
        /* ignore */
      }
    }
  };

  const appendLiveCaption = (role: 'visitor' | 'bot', text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLiveCaptions((prev) =>
      [...prev, { id: `cap-${role}-${Date.now()}`, role, text: clean }].slice(-4)
    );
  };

  const forceReverify = (message = SESSION_EXPIRED_MESSAGE) => {
    void stopLiveVoice();
    clearStoredSession();
    setLiveSession(null);
    setLiveReceipt(null);
    setBubbles([]);
    setOtpStep(null);
    setOtpCode('');
    setInput('');
    setVoiceMode(false);
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
    if (!next) {
      if (recording) stopVoiceRecording();
      void stopLiveVoice();
      stopVoicePlayback();
      return;
    }

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

  const stopVoicePlayback = () => {
    stopBrowserTts();
    if (playbackAudioRef.current) {
      try {
        playbackAudioRef.current.pause();
        playbackAudioRef.current.src = '';
      } catch {
        /* ignore */
      }
      playbackAudioRef.current = null;
    }
  };

  /** Stop assistant speech / abandon in-flight PTT turn so the visitor can ask again. */
  const interruptPttReply = () => {
    pttTurnGenRef.current += 1;
    stopVoicePlayback();
    if (voiceLevelDecayRef.current != null) {
      cancelAnimationFrame(voiceLevelDecayRef.current);
      voiceLevelDecayRef.current = null;
    }
    setPttSpeaking(false);
    setVoiceLevel(0);
  };

  const stopPttLevelMeter = () => {
    if (pttMeterRafRef.current != null) {
      cancelAnimationFrame(pttMeterRafRef.current);
      pttMeterRafRef.current = null;
    }
    if (pttMeterCtxRef.current) {
      void pttMeterCtxRef.current.close().catch(() => undefined);
      pttMeterCtxRef.current = null;
    }
    setVoiceLevel(0);
  };

  const startPttLevelMeter = (stream: MediaStream) => {
    stopPttLevelMeter();
    try {
      const ctx = new AudioContext();
      pttMeterCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        setVoiceLevel(Math.min(1, Math.sqrt(sum / data.length) * 2.4));
        pttMeterRafRef.current = requestAnimationFrame(tick);
      };
      pttMeterRafRef.current = requestAnimationFrame(tick);
    } catch {
      /* meter is optional */
    }
  };

  const pulseVoiceLevelWhile = async (done: Promise<void>) => {
    if (voiceLevelDecayRef.current != null) {
      cancelAnimationFrame(voiceLevelDecayRef.current);
      voiceLevelDecayRef.current = null;
    }
    let running = true;
    const start = performance.now();
    const tick = (now: number) => {
      if (!running) return;
      const t = (now - start) / 1000;
      setVoiceLevel(0.35 + 0.45 * Math.abs(Math.sin(t * 6.2)));
      voiceLevelDecayRef.current = requestAnimationFrame(tick);
    };
    voiceLevelDecayRef.current = requestAnimationFrame(tick);
    try {
      await done;
    } finally {
      running = false;
      if (voiceLevelDecayRef.current != null) {
        cancelAnimationFrame(voiceLevelDecayRef.current);
        voiceLevelDecayRef.current = null;
      }
      setVoiceLevel(0);
    }
  };

  const releaseMediaStream = () => {
    stopPttLevelMeter();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];
  };

  useEffect(() => {
    return () => {
      stopVoicePlayback();
      releaseMediaStream();
      if (voiceLevelDecayRef.current != null) cancelAnimationFrame(voiceLevelDecayRef.current);
      void liveVoiceRef.current?.stop();
      liveVoiceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!voiceMode || voicePath !== 'live') {
      void stopLiveVoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop when leaving live path
  }, [voiceMode, voicePath]);

  useEffect(() => {
    if (!voiceMode) {
      setLiveCaptions([]);
      setVoiceLevel(0);
      setPttSpeaking(false);
    }
  }, [voiceMode]);

  const playVoiceReply = async (
    answerText: string,
    audioBase64?: string,
    audioMimeType?: string,
    turnGen?: number
  ) => {
    // Prefer-reduced-motion should not mute speech replies — only skip decorative animation.
    if (voiceMuted) return;
    const gen = turnGen ?? pttTurnGenRef.current;
    if (pttTurnGenRef.current !== gen) return;
    stopVoicePlayback();
    setPttSpeaking(true);
    try {
      if (audioBase64) {
        const { audio, done, play } = playAudioBase64(audioBase64, audioMimeType || 'audio/mpeg');
        playbackAudioRef.current = audio;
        if (pttTurnGenRef.current !== gen) return;
        if (await play()) {
          await pulseVoiceLevelWhile(done);
          return;
        }
        // CSP / autoplay / decode failure — fall back to browser speechSynthesis.
      }
      if (pttTurnGenRef.current !== gen) return;
      await pulseVoiceLevelWhile(speakWithBrowserTts(answerText));
    } finally {
      if (pttTurnGenRef.current === gen) setPttSpeaking(false);
    }
  };

  const callRealtimePortfolioTool = async (question: string): Promise<string> => {
    if (!liveSession || !liveReceipt) return 'Session expired. Please verify again.';
    try {
      const res = await fetch('/api/chat/voice/realtime-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...chatReceiptHeaders(liveReceipt),
        },
        body: JSON.stringify({
          question,
          sessionId: liveSession.sessionId,
          visitorId: getOrCreateVisitorId(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        answer?: string;
      };
      if (isSessionExpiredResponse(res.status, data)) {
        forceReverify(data.error || SESSION_EXPIRED_MESSAGE);
        return 'Session expired. Please verify again.';
      }
      if (!res.ok) return data.error || 'Unable to look up portfolio facts right now.';
      return (data.answer || '').trim() || 'No portfolio answer available.';
    } catch (err) {
      return toUserFacingError(err, 'Unable to look up portfolio facts right now.');
    }
  };

  const startLiveVoice = async () => {
    if (
      !voiceRealtimeAvailable ||
      !voiceMode ||
      voicePath !== 'live' ||
      busy ||
      liveVoiceActive ||
      !liveSession ||
      !liveReceipt
    ) {
      return;
    }
    setError(null);
    stopVoicePlayback();
    setBusy(true);
    setLiveVoiceStatus('Starting live voice…');
    try {
      const access = await ensureMicrophoneAccess();
      if (!access.ok) {
        const help = getMicrophoneEnableHelp();
        setError(`${help.title}: ${help.steps[0]}`);
        setLiveVoiceStatus('');
        return;
      }

      const res = await fetch('/api/chat/voice/realtime-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...chatReceiptHeaders(liveReceipt),
        },
        body: JSON.stringify({
          sessionId: liveSession.sessionId,
          visitorId: getOrCreateVisitorId(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        token?: string;
        wsUrl?: string;
        voice?: string;
        instructions?: string;
        tools?: unknown[];
      };
      if (isSessionExpiredResponse(res.status, data)) {
        forceReverify(data.error || SESSION_EXPIRED_MESSAGE);
        return;
      }
      if (!res.ok || !data.token || !data.wsUrl) {
        throw new Error(data.error || 'Unable to start live voice.');
      }

      const session = new GrokRealtimeVoiceSession(
        {
          token: data.token,
          wsUrl: data.wsUrl,
          voice: data.voice,
          instructions: data.instructions,
          tools: data.tools,
        },
        {
          onStatus: (status) => setLiveVoiceStatus(status),
          onAudioLevel: (level) => setVoiceLevel(level),
          onTranscript: (role, text) => {
            const bubbleRole = role === 'visitor' ? 'visitor' : 'bot';
            appendLiveCaption(bubbleRole, text);
            setBubbles((prev) => [
              ...prev,
              {
                id: `live-${role}-${Date.now()}`,
                role: bubbleRole,
                text,
              },
            ]);
            // Persist captions into the OTP session for Owner Console (fire-and-forget).
            if (liveSession && liveReceipt && text.trim()) {
              void fetch('/api/chat/voice/realtime-log', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...chatReceiptHeaders(liveReceipt),
                },
                body: JSON.stringify({
                  sessionId: liveSession.sessionId,
                  role: bubbleRole,
                  text: text.trim().slice(0, 2000),
                }),
              }).catch(() => {});
            }
          },
          onError: (message) => setError(message),
          onPortfolioTool: callRealtimePortfolioTool,
        }
      );
      liveVoiceRef.current = session;
      setLiveCaptions([]);
      await session.start();
      setLiveVoiceActive(true);
    } catch (err) {
      await stopLiveVoice();
      setError(toUserFacingError(err, 'Live voice unavailable.'));
    } finally {
      setBusy(false);
    }
  };

  const submitVoiceBlob = async (blob: Blob) => {
    if (!liveSession || !liveReceipt) return;
    const gen = ++pttTurnGenRef.current;
    setBusy(true);
    setPttSpeaking(false);
    setError(null);
    try {
      const result = await voiceTransportRef.current.submitUtterance({
        audio: blob,
        sessionId: liveSession.sessionId,
        receipt: liveReceipt,
        visitorId: getOrCreateVisitorId(),
      });
      if (pttTurnGenRef.current !== gen) return;
      if (isSessionExpiredResponse(result.status || 200, result)) {
        forceReverify(result.error || SESSION_EXPIRED_MESSAGE);
        return;
      }
      if (!result.ok) throw new Error(result.error || 'Unable to process voice turn.');
      if (typeof result.ownerOnline === 'boolean') setOwnerOnline(result.ownerOnline);
      if (result.transcript) {
        appendLiveCaption('visitor', result.transcript);
        setBubbles((prev) => [
          ...prev,
          { id: `v-${Date.now()}`, role: 'visitor', text: result.transcript || '' },
        ]);
      }
      const answerText = result.answer || 'No answer returned.';
      appendLiveCaption('bot', answerText);
      setBubbles((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: 'bot',
          text: answerText,
          sources: result.sources,
        },
      ]);
      const nextChips =
        Array.isArray(result.followUps) && result.followUps.length
          ? result.followUps
          : Array.isArray(result.suggestions)
            ? result.suggestions
            : [];
      if (nextChips.length) setSuggestions(nextChips.slice(0, 3));
      if (pttTurnGenRef.current !== gen) return;
      await playVoiceReply(answerText, result.audioBase64, result.audioMimeType, gen);
    } catch (err) {
      if (pttTurnGenRef.current === gen) {
        setError(toUserFacingError(err, 'Voice chat unavailable.'));
      }
    } finally {
      if (pttTurnGenRef.current === gen) {
        setBusy(false);
        setPttSpeaking(false);
      }
    }
  };

  const startVoiceRecording = async () => {
    if (!voiceMode || voicePath !== 'ptt' || recording || !liveSession || !liveReceipt) {
      return;
    }
    // Barge-in: stop assistant speech / abandon thinking, then record a new question.
    if (busy || pttSpeaking) {
      interruptPttReply();
      setBusy(false);
    }
    setError(null);
    stopVoicePlayback();
    try {
      const access = await ensureMicrophoneAccess();
      if (!access.ok) {
        const help = getMicrophoneEnableHelp();
        setError(`${help.title}: ${help.steps[0]}`);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = mediaChunksRef.current.slice();
        releaseMediaStream();
        setRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 256) {
          setError('Recording was too short. Hold the mic and speak a question.');
          return;
        }
        void submitVoiceBlob(blob);
      };
      recorder.start();
      startPttLevelMeter(stream);
      setRecording(true);
    } catch (err) {
      releaseMediaStream();
      setRecording(false);
      setError(toUserFacingError(err, 'Microphone unavailable.'));
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      releaseMediaStream();
      setRecording(false);
      return;
    }
    try {
      recorder.stop();
    } catch {
      releaseMediaStream();
      setRecording(false);
    }
  };

  const askBot = async (question: string) => {
    const clean = question.trim();
    if (!clean || busy || !liveSession || !liveReceipt) return;
    setBusy(true);
    setError(null);
    stopVoicePlayback();
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
      if (nextChips.length) setSuggestions(nextChips.slice(0, 3));
      if (data.session) setLiveSession(data.session);
      const answerText = data.answer || 'No answer returned.';
      setBubbles((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: 'bot',
          text: answerText,
          sources: data.sources,
        },
      ]);
      if (voiceMode && voicePath === 'ptt') await playVoiceReply(answerText);
    } catch (err) {
      setError(toUserFacingError(err, 'Chat unavailable.'));
    } finally {
      setBusy(false);
    }
  };

  const startRegistration = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (requireOtpForChat && !otpAvailable) {
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
        status?: string;
        challengeId?: string;
        challengeToken?: string;
        maskedEmail?: string;
        ownerOnline?: boolean;
        sessionReceipt?: string;
        session?: LiveSession;
        suggestions?: string[];
      };
      if (!res.ok) throw new Error(data.error || 'Unable to start verification.');
      if (typeof data.ownerOnline === 'boolean') setOwnerOnline(data.ownerOnline);
      if (data.status === 'live' && data.sessionReceipt && data.session) {
        enterVerifiedChat({
          session: data.session,
          receipt: data.sessionReceipt,
          name: form.name.trim() || data.session.visitorName || 'there',
          email: form.email.trim() || data.session.visitorEmail || '',
          starterSuggestions: data.suggestions,
        });
        return;
      }
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
                      (liveStage
                        ? liveVoiceActive
                          ? 'Live speech-to-speech call'
                          : 'Live call ready'
                        : pttStage
                          ? recording
                            ? 'Push-to-talk · listening'
                            : pttSpeaking
                              ? 'Push-to-talk · speaking — interrupt anytime'
                              : busy
                                ? 'Push-to-talk · thinking — hold mic to interrupt'
                                : 'Push-to-talk ready'
                          : ownerOnline
                            ? 'Verified · owner online'
                            : 'Verified · owner queued')}
                  </div>
                </div>
                <div className="relative flex items-center gap-1.5 shrink-0">
                  {mode === 'chat' && anyVoiceAvailable && (
                    <button
                      type="button"
                      onClick={() => {
                        stopVoicePlayback();
                        if (recording) stopVoiceRecording();
                        void stopLiveVoice();
                        setVoiceMode((prev) => !prev);
                      }}
                      disabled={busy}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer ${
                        voiceMode
                          ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                          : 'border-slate-700 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300'
                      }`}
                      aria-pressed={voiceMode}
                      aria-label={voiceMode ? 'Switch to text chat' : 'Switch to voice agent'}
                      title={voiceMode ? 'Voice on — tap for text' : 'Voice agent'}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{voiceMode ? 'Voice' : 'Talk'}</span>
                    </button>
                  )}
                  {mode === 'chat' && voiceMode && voicePath === 'ptt' && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceMuted((prev) => {
                          const next = !prev;
                          if (next) stopVoicePlayback();
                          return next;
                        });
                      }}
                      className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      aria-label={voiceMuted ? 'Unmute voice replies' : 'Mute voice replies'}
                      title={voiceMuted ? 'Unmute replies' : 'Mute replies'}
                    >
                      {voiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  )}
                  {mode === 'chat' && liveSession && liveReceipt && (
                    <button
                      type="button"
                      onClick={() => {
                        void stopLiveVoice();
                        void startNewChat();
                      }}
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

              <div
                ref={listRef}
                className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 ${
                  voiceStageMode ? 'flex flex-col' : 'space-y-2.5'
                }`}
              >
                {voiceStageMode ? (
                  <div className="flex flex-1 flex-col items-center justify-between gap-3 sm:gap-4 py-2 min-h-[14rem] w-full">
                    <div className="w-full space-y-2 shrink-0">
                      {voiceAgentAvailable && voiceRealtimeAvailable && (
                        <div className="flex justify-center flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busy || liveVoiceActive || recording}
                            onClick={() => {
                              void stopLiveVoice();
                              if (recording) stopVoiceRecording();
                              stopVoicePlayback();
                              setLiveCaptions([]);
                              setVoiceLevel(0);
                              setVoicePath('ptt');
                            }}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50 ${
                              voicePath === 'ptt' ? voiceAccent.selected : voiceAccent.idle
                            }`}
                            aria-pressed={voicePath === 'ptt'}
                          >
                            <Mic className="w-3 h-3" />
                            Push-to-talk
                          </button>
                          <button
                            type="button"
                            disabled={busy || liveVoiceActive || recording}
                            onClick={() => {
                              if (recording) stopVoiceRecording();
                              stopVoicePlayback();
                              setLiveCaptions([]);
                              setVoiceLevel(0);
                              setVoicePath('live');
                            }}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50 ${
                              voicePath === 'live' ? voiceAccent.selected : voiceAccent.idle
                            }`}
                            aria-pressed={voicePath === 'live'}
                          >
                            <Headphones className="w-3 h-3" />
                            Live call
                          </button>
                        </div>
                      )}
                      <p className={`text-center text-[11px] font-mono px-1 ${muted}`}>
                        {liveStage
                          ? liveVoiceStatus ||
                            (liveVoiceActive
                              ? 'Live call — speak naturally; interrupt anytime'
                              : 'Start a live speech-to-speech call')
                          : recording
                            ? 'Listening… release to send'
                            : pttSpeaking
                              ? 'Speaking… hold mic to interrupt and ask another question'
                              : busy
                                ? 'Thinking… hold mic to cancel and ask something else'
                                : 'Hold the mic, ask a question, then release'}
                      </p>
                      <VoiceWaveform
                        level={voiceLevel}
                        active={waveformActive}
                        isLight={isLight}
                      />
                    </div>

                    <div
                      ref={voiceCaptionsRef}
                      className="w-full max-w-sm flex-1 min-h-0 overflow-y-auto space-y-2 px-1 scroll-smooth"
                    >
                      {liveCaptions.length === 0 ? (
                        <p className={`text-center text-[11px] pt-4 sm:pt-6 ${muted}`}>
                          Captions appear here while you talk.
                        </p>
                      ) : (
                        liveCaptions.map((c) => (
                          <div
                            key={c.id}
                            className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                              c.role === 'visitor'
                                ? `ml-4 sm:ml-6 ${voiceAccent.visitorBubble}`
                                : `mr-4 sm:mr-6 ${voiceAccent.botBubble}`
                            }`}
                          >
                            {c.text}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-2 pb-1 shrink-0">
                      {pttStage ? (
                        <>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setVoiceMuted((prev) => {
                                  const next = !prev;
                                  if (next) stopVoicePlayback();
                                  return next;
                                });
                              }}
                              className={`p-2.5 sm:p-2 rounded-full border cursor-pointer ${voiceAccent.idle}`}
                              aria-label={voiceMuted ? 'Unmute voice replies' : 'Mute voice replies'}
                              title={voiceMuted ? 'Unmute replies' : 'Mute replies'}
                            >
                              {voiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              disabled={!voiceAgentAvailable}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                void startVoiceRecording();
                              }}
                              onPointerUp={() => stopVoiceRecording()}
                              onPointerLeave={() => {
                                if (recording) stopVoiceRecording();
                              }}
                              onPointerCancel={() => stopVoiceRecording()}
                              className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border transition-colors cursor-pointer disabled:opacity-50 touch-none ${
                                recording
                                  ? 'border-rose-400 bg-rose-500 text-white shadow-lg shadow-rose-900/40'
                                  : pttSpeaking
                                    ? isLight
                                      ? 'border-amber-500 bg-amber-400 text-slate-950 ring-2 ring-amber-300/60'
                                      : 'border-cyan-300 bg-cyan-400 text-slate-950 ring-2 ring-cyan-400/40'
                                    : voiceAccent.primaryIdle
                              }`}
                              aria-label={
                                recording
                                  ? 'Release to send voice question'
                                  : pttCanInterrupt
                                    ? 'Hold to interrupt and ask another question'
                                    : 'Hold to talk'
                              }
                            >
                              {busy && !recording && !pttSpeaking ? (
                                <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
                              ) : (
                                <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
                              )}
                            </button>
                            {pttCanInterrupt && !recording && (
                              <button
                                type="button"
                                onClick={() => {
                                  interruptPttReply();
                                  setBusy(false);
                                }}
                                className="p-2.5 sm:p-2 rounded-full border border-rose-400/50 bg-rose-500/15 text-rose-300 cursor-pointer"
                                aria-label="Stop assistant and interrupt"
                                title="Interrupt"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {pttCanInterrupt && !recording && (
                            <p className={`text-[10px] font-mono text-center ${muted}`}>
                              Hold mic to cut in · or tap ✕ to stop
                            </p>
                          )}
                          <button
                            type="button"
                            disabled={recording}
                            onClick={() => {
                              if (recording) stopVoiceRecording();
                              interruptPttReply();
                              setBusy(false);
                              setVoiceMode(false);
                            }}
                            className={`text-[10px] font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50 ${muted} ${voiceAccent.statusHover}`}
                          >
                            Back to text chat
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busy && !liveVoiceActive}
                            onClick={() => {
                              if (liveVoiceActive) void stopLiveVoice();
                              else void startLiveVoice();
                            }}
                            className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
                              liveVoiceActive
                                ? 'border-rose-400 bg-rose-500 text-white shadow-lg shadow-rose-900/40'
                                : voiceAccent.primaryBtn
                            }`}
                            aria-label={
                              liveVoiceActive
                                ? 'End live speech-to-speech call'
                                : 'Start live call'
                            }
                          >
                            {busy && !liveVoiceActive ? (
                              <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
                            ) : liveVoiceActive ? (
                              <X className="w-6 h-6 sm:w-7 sm:h-7" />
                            ) : (
                              <Headphones className="w-6 h-6 sm:w-7 sm:h-7" />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={busy || liveVoiceActive}
                            onClick={() => {
                              void stopLiveVoice();
                              setVoiceMode(false);
                              setVoicePath(voiceAgentAvailable ? 'ptt' : 'live');
                            }}
                            className={`text-[10px] font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50 ${muted} ${voiceAccent.statusHover}`}
                          >
                            Back to text chat
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}

                {!voiceStageMode && mode === 'welcome' && (
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

                {!voiceStageMode &&
                  (mode === 'chat' ? bubbles : []).map((b) => (
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
                    {requireOtpForChat
                      ? 'Tell us who you are. We’ll email a 6-digit code to create your chat profile.'
                      : 'Tell us who you are to start chatting (email verification is currently off).'}
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
                      disabled={busy || (requireOtpForChat && !otpAvailable)}
                      className="flex-[1.4] rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs py-2 disabled:opacity-50 cursor-pointer"
                    >
                      {busy
                        ? requireOtpForChat
                          ? 'Sending code…'
                          : 'Starting…'
                        : requireOtpForChat
                          ? 'Send OTP'
                          : 'Start chat'}
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

              {mode === 'chat' && !voiceStageMode && (
                <div
                  className={`relative z-10 shrink-0 border-t ${
                    isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#070b14]'
                  }`}
                >
                  <div className="max-h-[4.75rem] min-h-[2.5rem] overflow-y-auto overscroll-contain px-3 pt-2 pb-1.5">
                    <div className="flex flex-wrap gap-1.5 content-start">
                      {suggestions.slice(0, 3).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busy || recording}
                          onClick={() => void askBot(s)}
                          className={`max-w-full truncate text-[10px] font-mono px-2 py-1 rounded-lg border cursor-pointer disabled:opacity-50 ${chipCls}`}
                          title={s}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 pt-2">
                    {voiceMode ? (
                      <div className="space-y-2">
                        {voiceAgentAvailable && voiceRealtimeAvailable && (
                          <div className="flex justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={busy || liveVoiceActive}
                              onClick={() => {
                                void stopLiveVoice();
                                setVoicePath('ptt');
                              }}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50 ${
                                voicePath === 'ptt'
                                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                              aria-pressed={voicePath === 'ptt'}
                            >
                              <Mic className="w-3 h-3" />
                              Push-to-talk
                            </button>
                            <button
                              type="button"
                              disabled={busy || recording}
                              onClick={() => {
                                if (recording) stopVoiceRecording();
                                stopVoicePlayback();
                                setVoicePath('live');
                              }}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50 ${
                                voicePath === 'live'
                                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                              aria-pressed={voicePath === 'live'}
                            >
                              <Headphones className="w-3 h-3" />
                              Live S2S
                            </button>
                          </div>
                        )}
                        <p className={`text-[11px] text-center ${muted}`}>
                          {recording
                            ? 'Listening… release to send'
                            : busy
                              ? 'Thinking…'
                              : 'Hold the mic, ask a question, then release'}
                        </p>
                        <button
                          type="button"
                          disabled={(busy && !recording) || !voiceAgentAvailable}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            void startVoiceRecording();
                          }}
                          onPointerUp={() => stopVoiceRecording()}
                          onPointerLeave={() => {
                            if (recording) stopVoiceRecording();
                          }}
                          onPointerCancel={() => stopVoiceRecording()}
                          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border transition-colors cursor-pointer disabled:opacity-50 touch-none ${
                            recording
                              ? 'border-rose-400 bg-rose-500 text-white shadow-lg shadow-rose-900/40'
                              : isLight
                                ? 'border-sky-300 bg-sky-500 text-white'
                                : 'border-cyan-400/50 bg-cyan-500 text-slate-950'
                          }`}
                          aria-label={
                            recording ? 'Release to send voice question' : 'Hold to talk'
                          }
                        >
                          {busy && !recording ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <Mic className="w-6 h-6" />
                          )}
                        </button>
                      </div>
                    ) : (
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
                    )}
                  </div>
                </div>
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
