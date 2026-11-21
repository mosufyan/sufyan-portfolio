import { FormEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Loader2, Mic, MicOff, Send, SmilePlus } from 'lucide-react';
import { EASE_OUT_EXPO } from './MotionPrimitives';
import {
  CHAT_QUICK_EMOJIS,
  ensureMicrophoneAccess,
  getMicrophoneEnableHelp,
  getSpeechRecognitionConstructor,
  isSpeechToTextSupported,
  microphoneHelpForSpeechError,
  type BrowserSpeechRecognition,
  type MicrophoneHelp,
} from '../utils/chatComposer';

export interface ChatMessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  isLight: boolean;
  placeholder: string;
  listeningPlaceholder?: string;
  maxLength?: number;
  minSubmitLength?: number;
  submitAriaLabel?: string;
  /** When true, show “Send” text next to the icon (owner console). */
  showSubmitLabel?: boolean;
  /** Optional external error banner (composer still shows mic help when needed). */
  error?: string | null;
  onError?: (message: string | null) => void;
}

/**
 * Shared chat input: quick emoji picker + browser speech-to-text + send.
 * Used by visitor ChatWidget and owner console live reply.
 */
export default function ChatMessageComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  busy = false,
  isLight,
  placeholder,
  listeningPlaceholder = 'Listening… speak now',
  maxLength = 2000,
  minSubmitLength = 1,
  submitAriaLabel = 'Send',
  showSubmitLabel = false,
  error = null,
  onError,
}: ChatMessageComposerProps) {
  const shouldReduceMotion = useReducedMotion();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [micHelp, setMicHelp] = useState<MicrophoneHelp | null>(null);
  const [speechSupported] = useState(() => isSpeechToTextSupported());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechBaseRef = useRef('');

  const fieldShell = isLight
    ? 'border-slate-300 bg-white text-slate-900'
    : 'border-slate-700 bg-[#070b14] text-slate-100';
  const iconBtn = isLight
    ? 'text-slate-500 hover:text-sky-700 hover:bg-sky-50'
    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80';

  const stopSpeechRecognition = () => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
    }
    setListening(false);
  };

  const insertComposerText = (chunk: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${chunk}${value.slice(end)}`.slice(0, maxLength);
    onChange(next);
    requestAnimationFrame(() => {
      const fieldEl = inputRef.current;
      if (!fieldEl) return;
      fieldEl.focus();
      const pos = Math.min(start + chunk.length, next.length);
      fieldEl.setSelectionRange(pos, pos);
    });
  };

  const showMicHelp = (help: MicrophoneHelp, banner?: string) => {
    setMicHelp(help);
    onError?.(banner || help.title);
  };

  const toggleSpeechToText = async () => {
    if (busy || disabled) return;
    if (listening) {
      stopSpeechRecognition();
      return;
    }
    const SpeechCtor = getSpeechRecognitionConstructor();
    if (!SpeechCtor) {
      setMicHelp({
        title: 'Speech-to-text isn’t supported here',
        steps: [
          'Try Chrome or Edge on desktop for microphone dictation.',
          'You can still type your reply or use the emoji picker.',
        ],
      });
      onError?.(null);
      return;
    }
    onError?.(null);
    setMicHelp(null);
    setEmojiOpen(false);

    const access = await ensureMicrophoneAccess();
    if (!access.ok) {
      if (access.reason === 'denied' || access.reason === 'secure') {
        showMicHelp(getMicrophoneEnableHelp());
      } else if (access.reason === 'unavailable') {
        showMicHelp({
          title: 'Microphone unavailable',
          steps: [
            access.message || 'No usable microphone was found.',
            'Plug in a mic or close other apps using it, then try again.',
          ],
        });
      } else {
        showMicHelp(getMicrophoneEnableHelp(), 'Couldn’t access the microphone.');
      }
      return;
    }

    const rec = new SpeechCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
    speechBaseRef.current = value.trim() ? `${value.trim()} ` : '';
    rec.onresult = (event) => {
      let interim = '';
      let finals = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript || '';
        if (event.results[i]?.isFinal) finals += piece;
        else interim += piece;
      }
      if (finals) speechBaseRef.current = `${speechBaseRef.current}${finals}`;
      onChange(`${speechBaseRef.current}${interim}`.slice(0, maxLength));
    };
    rec.onerror = (event) => {
      const code = (event.error || '').toLowerCase();
      if (code && code !== 'aborted' && code !== 'no-speech') {
        showMicHelp(microphoneHelpForSpeechError(code));
      }
      stopSpeechRecognition();
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setMicHelp(null);
      onError?.(null);
    } catch {
      showMicHelp(getMicrophoneEnableHelp(), 'Couldn’t start speech recognition.');
      stopSpeechRecognition();
    }
  };

  useEffect(() => {
    if (!emojiOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) setEmojiOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEmojiOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [emojiOpen]);

  useEffect(() => {
    if (disabled) {
      stopSpeechRecognition();
      setEmojiOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop on disable only
  }, [disabled]);

  useEffect(() => () => stopSpeechRecognition(), []);

  const handleSubmit = (event: FormEvent) => {
    stopSpeechRecognition();
    setEmojiOpen(false);
    void onSubmit(event);
  };

  const canSubmit = !busy && !disabled && value.trim().length >= minSubmitLength;

  return (
    <div ref={composerRef} className="relative shrink-0">
      {(error || micHelp) && (
        <div
          role="alert"
          className={`mb-2 rounded-lg border px-2.5 py-2 text-[11px] ${
            isLight
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
          }`}
        >
          {micHelp ? (
            <div className="space-y-1">
              <p className="font-semibold">{micHelp.title}</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                {micHelp.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {micHelp.note ? <p className="opacity-90 pt-0.5">{micHelp.note}</p> : null}
            </div>
          ) : (
            error
          )}
        </div>
      )}

      <AnimatePresence>
        {emojiOpen && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
            className={`absolute bottom-[calc(100%-0.25rem)] left-0 right-0 z-10 rounded-xl border p-2 shadow-xl ${
              isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-[#0b101a]'
            }`}
            role="listbox"
            aria-label="Quick emoji reactions"
          >
            <div className="grid grid-cols-8 gap-1">
              {CHAT_QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    insertComposerText(emoji);
                    setEmojiOpen(false);
                  }}
                  className={`flex h-8 items-center justify-center rounded-lg text-base cursor-pointer disabled:opacity-50 ${
                    isLight ? 'hover:bg-sky-50' : 'hover:bg-slate-800'
                  }`}
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div
          className={`flex flex-1 min-w-0 items-center gap-0.5 rounded-xl border px-1.5 focus-within:border-cyan-400 ${fieldShell}`}
        >
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => {
              stopSpeechRecognition();
              setEmojiOpen((openPicker) => !openPicker);
            }}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg cursor-pointer disabled:opacity-50 ${iconBtn} ${
              emojiOpen ? (isLight ? 'text-sky-700 bg-sky-50' : 'text-cyan-300 bg-slate-800') : ''
            }`}
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            title="Emoji"
          >
            <SmilePlus className="w-4 h-4" />
          </button>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
            disabled={disabled}
            placeholder={listening ? listeningPlaceholder : placeholder}
            className={`min-w-0 flex-1 bg-transparent px-1 py-2.5 text-xs focus:outline-none disabled:opacity-60 ${
              isLight ? 'placeholder-slate-400' : 'placeholder-slate-500'
            }`}
            aria-label="Chat message"
          />
          {speechSupported && (
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => void toggleSpeechToText()}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg cursor-pointer disabled:opacity-50 ${
                listening ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/15' : iconBtn
              }`}
              aria-label={listening ? 'Stop listening' : 'Speech to text'}
              aria-pressed={listening}
              title={listening ? 'Stop listening' : 'Speech to text'}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className={`inline-flex items-center justify-center gap-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 cursor-pointer ${
            showSubmitLabel ? 'px-3 text-xs font-semibold' : 'px-3'
          }`}
          aria-label={submitAriaLabel}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {showSubmitLabel ? 'Send' : null}
        </button>
      </form>
    </div>
  );
}
