/** Curated reactions for portfolio / recruiting chat (not a full emoji mart). */
export const CHAT_QUICK_EMOJIS = [
  '👍',
  '👏',
  '✅',
  '🔥',
  '💡',
  '❓',
  '🙌',
  '🙂',
  '🎯',
  '🚀',
  '💼',
  '☁️',
  '🔒',
  '⭐',
  '🙏',
  '👋',
] as const;

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

export type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

export type ClientPlatform =
  | 'ios'
  | 'ipados'
  | 'android'
  | 'mac'
  | 'windows'
  | 'linux'
  | 'unknown';

export type ClientBrowser = 'chrome' | 'edge' | 'safari' | 'firefox' | 'samsung' | 'other';

export interface ClientEnvironment {
  platform: ClientPlatform;
  browser: ClientBrowser;
  isMobile: boolean;
  isSecureContext: boolean;
}

export interface MicrophoneHelp {
  title: string;
  steps: string[];
  /** Short note under the steps */
  note?: string;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechToTextSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

export function detectClientEnvironment(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platformHint = typeof navigator !== 'undefined' ? navigator.platform || '' : ''
): ClientEnvironment {
  const ua = userAgent || '';
  const uaLower = ua.toLowerCase();
  const plat = platformHint.toLowerCase();

  const isIPad =
    /ipad/i.test(ua) ||
    (plat === 'macintel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
  const isIPhone = /iphone|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isMac = !isIPad && /mac/i.test(ua + plat);
  const isWindows = /win/i.test(ua + plat);
  const isLinux = /linux/i.test(ua) && !isAndroid;

  let platform: ClientPlatform = 'unknown';
  if (isIPad) platform = 'ipados';
  else if (isIPhone) platform = 'ios';
  else if (isAndroid) platform = 'android';
  else if (isMac) platform = 'mac';
  else if (isWindows) platform = 'windows';
  else if (isLinux) platform = 'linux';

  let browser: ClientBrowser = 'other';
  if (/edg\//i.test(ua)) browser = 'edge';
  else if (/samsungbrowser/i.test(ua)) browser = 'samsung';
  else if (/firefox|fxios/i.test(ua)) browser = 'firefox';
  else if (/chrome|crios|chromium/i.test(ua) && !/edg\//i.test(ua)) browser = 'chrome';
  else if (/safari/i.test(ua) && !/chrome|crios|chromium|android/i.test(ua)) browser = 'safari';

  return {
    platform,
    browser,
    isMobile: platform === 'ios' || platform === 'ipados' || platform === 'android',
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : true,
  };
}

function browserLabel(browser: ClientBrowser): string {
  switch (browser) {
    case 'chrome':
      return 'Chrome';
    case 'edge':
      return 'Edge';
    case 'safari':
      return 'Safari';
    case 'firefox':
      return 'Firefox';
    case 'samsung':
      return 'Samsung Internet';
    default:
      return 'your browser';
  }
}

/** Steps to re-enable mic after the site was blocked (browsers won’t re-prompt automatically). */
export function getMicrophoneEnableHelp(
  env: ClientEnvironment = detectClientEnvironment()
): MicrophoneHelp {
  const browser = browserLabel(env.browser);

  if (!env.isSecureContext) {
    return {
      title: 'Microphone needs a secure page',
      steps: [
        'Open this site over HTTPS (or localhost).',
        'Browsers block microphone access on insecure HTTP pages.',
      ],
    };
  }

  if (env.platform === 'ios' || env.platform === 'ipados') {
    return {
      title: 'Allow the microphone on iPhone / iPad',
      steps: [
        `In ${browser}, tap aA (or the lock / page icon) in the address bar → Website Settings.`,
        'Set Microphone to Allow, then reload this page.',
        'Also check iOS Settings → Privacy & Security → Microphone and make sure Safari/Chrome is on.',
      ],
      note: 'After you allow it, tap the mic in chat again. iOS may ask once more.',
    };
  }

  if (env.platform === 'android') {
    return {
      title: 'Allow the microphone on Android',
      steps: [
        `In ${browser}, tap the lock / tune icon in the address bar → Permissions → Microphone → Allow.`,
        'Or: Android Settings → Apps → your browser → Permissions → Microphone → Allow.',
        'Reload this page, then tap the mic in chat again.',
      ],
    };
  }

  if (env.platform === 'mac') {
    if (env.browser === 'safari') {
      return {
        title: 'Allow the microphone on Mac (Safari)',
        steps: [
          'Safari menu → Settings for This Website… (or Website Settings).',
          'Set Microphone to Allow or Ask.',
          'Also check Mac System Settings → Privacy & Security → Microphone and enable Safari.',
          'Reload this page, then tap the mic again — Ask should show Safari’s permission popup.',
        ],
      };
    }
    return {
      title: `Allow the microphone on Mac (${browser})`,
      steps: [
        `Click the lock / site info icon left of the address bar → Site settings → Microphone → Allow (or Ask).`,
        `Also check Mac System Settings → Privacy & Security → Microphone and enable ${browser}.`,
        'Reload this page, then tap the mic again so the browser can show its Allow popup.',
      ],
      note: 'If Microphone is still Blocked for this site, browsers will not show Ask until you change it and reload.',
    };
  }

  if (env.platform === 'windows') {
    return {
      title: `Allow the microphone on Windows (${browser})`,
      steps: [
        `Click the lock / site info icon in the address bar → Site settings → Microphone → Allow.`,
        'Also check Windows Settings → Privacy & security → Microphone → let apps/desktop apps access your microphone.',
        'Reload this page, then tap the mic in chat again.',
      ],
      note: 'If Windows or the browser already blocked this site, the permission popup won’t appear again until you reset it.',
    };
  }

  return {
    title: 'Allow microphone access',
    steps: [
      `Click the lock / site info icon in the address bar and set Microphone to Allow for this site.`,
      `Check your device privacy settings so ${browser} can use the microphone.`,
      'Reload this page, then tap the mic in chat again.',
    ],
  };
}

export async function queryMicrophonePermission(): Promise<
  'granted' | 'denied' | 'prompt' | 'unknown'
> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
  } catch {
    /* Firefox / Safari may reject microphone permission queries */
  }
  return 'unknown';
}

export type MicAccessResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'unavailable' | 'secure' | 'unsupported' | 'unknown'; message?: string };

/**
 * Ask the browser for mic access via getUserMedia.
 * Always attempts getUserMedia so the native Ask/Allow popup can appear when the
 * site permission is still "Ask". Do not short-circuit on permissions.query('denied') —
 * that API is often stale after the user changes site settings, and only getUserMedia
 * can show the prompt when the site is set to Ask. After a hard Block, browsers will
 * not re-prompt; getUserMedia then throws and we surface settings help.
 */
export async function ensureMicrophoneAccess(): Promise<MicAccessResult> {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported' };
  if (!window.isSecureContext) return { ok: false, reason: 'secure' };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'unsupported' };

  try {
    // Triggers Chrome/Safari/Edge’s native microphone permission dialog when Ask.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return { ok: true };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err
        ? String((err as { name: unknown }).name)
        : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { ok: false, reason: 'denied' };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { ok: false, reason: 'unavailable', message: 'No microphone was found on this device.' };
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'The microphone is busy or unavailable. Close other apps using it and try again.',
      };
    }
    return { ok: false, reason: 'unknown', message: name || undefined };
  }
}

export function microphoneHelpForSpeechError(
  speechError: string,
  env: ClientEnvironment = detectClientEnvironment()
): MicrophoneHelp {
  const code = speechError.toLowerCase();
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return getMicrophoneEnableHelp(env);
  }
  if (code === 'audio-capture') {
    return {
      title: 'Microphone unavailable',
      steps: [
        'Make sure a microphone is connected and not used by another app.',
        ...getMicrophoneEnableHelp(env).steps.slice(0, 2),
      ],
    };
  }
  if (code === 'network') {
    return {
      title: 'Speech service unavailable',
      steps: [
        'Check your internet connection.',
        'Speech-to-text needs network access in most browsers — try again in a moment.',
      ],
    };
  }
  return getMicrophoneEnableHelp(env);
}
