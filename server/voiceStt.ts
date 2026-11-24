/**
 * Grok (xAI) speech-to-text via POST /v1/stt.
 * Server-only — GROK_API_KEY must never be exposed to the client.
 */
const DEFAULT_BASE = 'https://api.x.ai/v1';
const DEFAULT_MODEL = 'grok-voice-transcribe-2.0';
const DEFAULT_TIMEOUT_MS = 20_000;

export interface VoiceSttOptions {
  apiKey?: string;
  modelId?: string;
  language?: string;
  timeoutMs?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  filename?: string;
  mimeType?: string;
}

export interface VoiceSttResult {
  ok: boolean;
  transcript?: string;
  latencyMs: number;
  error?: string;
}

export function resolveGrokApiKey(apiKey?: string): string {
  return (
    apiKey?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    process.env.XAI_API_KEY?.trim() ||
    ''
  );
}

export function isVoiceSttConfigured(apiKey = resolveGrokApiKey()): boolean {
  return Boolean(apiKey && apiKey.length >= 8);
}

function extensionForMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  return 'webm';
}

export async function transcribeAudioWithGrok(
  audio: Buffer,
  options: VoiceSttOptions = {}
): Promise<VoiceSttResult> {
  const started = Date.now();
  const apiKey = resolveGrokApiKey(options.apiKey);
  if (!apiKey) {
    return { ok: false, latencyMs: Date.now() - started, error: 'Grok STT is not configured.' };
  }
  if (!audio.length) {
    return { ok: false, latencyMs: Date.now() - started, error: 'Empty audio payload.' };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = (options.baseUrl || process.env.GROK_API_BASE_URL || DEFAULT_BASE).replace(
    /\/$/,
    ''
  );
  const timeoutMs = Math.min(
    60_000,
    Math.max(
      3_000,
      options.timeoutMs || Number(process.env.VOICE_STT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
    )
  );
  const modelId =
    (options.modelId || process.env.GROK_STT_MODEL || '').trim() || DEFAULT_MODEL;
  const mimeType = (options.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  const filename =
    (options.filename || '').trim() || `utterance.${extensionForMime(mimeType)}`;

  const form = new FormData();
  form.append('model', modelId);
  if (options.language) form.append('language', options.language);
  // file must be last per xAI STT docs
  const blob = new Blob([new Uint8Array(audio)], { type: mimeType });
  form.append('file', blob, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${baseUrl}/stt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const permissionDenied =
        res.status === 403 &&
        /lacks the permissions|voice endpoints|does not have permission/i.test(errText);
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: permissionDenied
          ? 'Grok voice APIs are not enabled on this API key. In console.x.ai, edit the key and add Voice permissions, then retry.'
          : `Grok STT ${res.status}: ${errText.replace(/\s+/g, ' ').slice(0, 160)}`,
      };
    }

    const body = (await res.json()) as { text?: string };
    const transcript = (body.text || '').trim();
    if (!transcript) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: 'Grok STT returned empty transcript.',
      };
    }

    return {
      ok: true,
      transcript: transcript.slice(0, 2000),
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: aborted
        ? 'Grok STT timed out.'
        : err instanceof Error
          ? err.message
          : 'Grok STT failed.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** @deprecated Use transcribeAudioWithGrok — kept for older imports. */
export async function transcribeAudioWithGroq(
  audio: Buffer,
  options: VoiceSttOptions = {}
): Promise<VoiceSttResult> {
  return transcribeAudioWithGrok(audio, options);
}
