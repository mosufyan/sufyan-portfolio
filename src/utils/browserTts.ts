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
): { audio: HTMLAudioElement; done: Promise<void> } {
  const audio = new Audio(`data:${mimeType};base64,${base64}`);
  const done = new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
  });
  void audio.play().catch(() => {
    /* autoplay / permission — ignore */
  });
  return { audio, done };
}
