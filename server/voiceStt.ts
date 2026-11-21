/**
 * Groq Whisper speech-to-text (OpenAI-compatible transcriptions API).
 * Server-only — GROQ_API_KEY must never be exposed to the client.
 */
const DEFAULT_BASE = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'whisper-large-v3-turbo';
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

export function isVoiceSttConfigured(apiKey = process.env.GROQ_API_KEY || ''): boolean {
  return Boolean(apiKey && apiKey.trim().length >= 8);
}

function extensionForMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  return 'webm';
}

export async function transcribeAudioWithGroq(
  audio: Buffer,
  options: VoiceSttOptions = {}
): Promise<VoiceSttResult> {
  const started = Date.now();
  const apiKey = (options.apiKey ?? process.env.GROQ_API_KEY ?? '').trim();
  if (!apiKey) {
    return { ok: false, latencyMs: Date.now() - started, error: 'Groq STT is not configured.' };
  }
  if (!audio.length) {
    return { ok: false, latencyMs: Date.now() - started, error: 'Empty audio payload.' };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = (options.baseUrl || process.env.GROQ_API_BASE_URL || DEFAULT_BASE).replace(
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
  const modelId = (options.modelId || process.env.GROQ_STT_MODEL || '').trim() || DEFAULT_MODEL;
  const mimeType = (options.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  const filename =
    (options.filename || '').trim() || `utterance.${extensionForMime(mimeType)}`;

  const form = new FormData();
  form.append('model', modelId);
  form.append('response_format', 'json');
  if (options.language) form.append('language', options.language);
  const blob = new Blob([new Uint8Array(audio)], { type: mimeType });
  form.append('file', blob, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: `Groq STT ${res.status}: ${errText.slice(0, 180)}`,
      };
    }

    const body = (await res.json()) as { text?: string };
    const transcript = (body.text || '').trim();
    if (!transcript) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: 'Groq STT returned empty transcript.',
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
        ? 'Groq STT timed out.'
        : err instanceof Error
          ? err.message
          : 'Groq STT failed.',
    };
  } finally {
    clearTimeout(timer);
  }
}
