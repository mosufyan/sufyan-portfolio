/**
 * Browser speechSynthesis fallback when cloud TTS is unavailable.
 */

export function isBrowserTtsSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function stopBrowserTts(): void {
  if (!isBrowserTtsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function speakWithBrowserTts(
  text: string,
  options: { rate?: number; pitch?: number } = {}
): Promise<void> {
  const clean = text.trim().slice(0, 600);
  if (!clean || !isBrowserTtsSupported()) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      stopBrowserTts();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.rate = options.rate ?? 1;
      utter.pitch = options.pitch ?? 1;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
}

export function playAudioBase64(
  base64: string,
  mimeType = 'audio/mpeg'
): {
  audio: HTMLAudioElement;
  done: Promise<void>;
  /** Starts playback; false if blocked (CSP / autoplay / decode). */
  play: () => Promise<boolean>;
} {
  let objectUrl: string | null = null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'audio/mpeg' }));
  } catch {
    objectUrl = `data:${mimeType};base64,${base64}`;
  }
  const audio = new Audio(objectUrl);
  const revoke = () => {
    if (objectUrl && objectUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
    }
  };
  const done = new Promise<void>((resolve) => {
    audio.onended = () => {
      revoke();
      resolve();
    };
    audio.onerror = () => {
      revoke();
      resolve();
    };
  });
  const play = async () => {
    try {
      await audio.play();
      return true;
    } catch {
      revoke();
      return false;
    }
  };
  return { audio, done, play };
}
