/**
 * ElevenLabs text-to-speech. Returns null audio on missing key / quota / errors
 * so the client can fall back to browser speechSynthesis.
 * Server-only — ELEVENLABS_API_KEY must never be exposed to the client.
 */
const DEFAULT_BASE = 'https://api.elevenlabs.io/v1';
/** Flash model stretches free-tier credits. */
const DEFAULT_MODEL = 'eleven_flash_v2_5';
/** Public stock voice; override with ELEVENLABS_VOICE_ID. */
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_CHARS = 600;

export interface VoiceTtsOptions {
  apiKey?: string;
  voiceId?: string;
  modelId?: string;
  timeoutMs?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface VoiceTtsResult {
  ok: boolean;
  audioBase64?: string;
  mimeType?: string;
  latencyMs: number;
  error?: string;
  skipped?: boolean;
}

export function isVoiceTtsConfigured(apiKey = process.env.ELEVENLABS_API_KEY || ''): boolean {
  return Boolean(apiKey && apiKey.trim().length >= 8);
}

export async function synthesizeSpeechWithElevenLabs(
  textRaw: string,
  options: VoiceTtsOptions = {}
): Promise<VoiceTtsResult> {
  const started = Date.now();
  const apiKey = (options.apiKey ?? process.env.ELEVENLABS_API_KEY ?? '').trim();
  const text = textRaw.trim().slice(0, MAX_CHARS);
  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      latencyMs: Date.now() - started,
      error: 'ElevenLabs TTS is not configured.',
    };
  }
  if (!text) {
    return { ok: false, latencyMs: Date.now() - started, error: 'Empty TTS text.' };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = (options.baseUrl || process.env.ELEVENLABS_API_BASE_URL || DEFAULT_BASE).replace(
    /\/$/,
    ''
  );
  const voiceId =
    (options.voiceId || process.env.ELEVENLABS_VOICE_ID || '').trim() || DEFAULT_VOICE_ID;
  const modelId =
    (options.modelId || process.env.ELEVENLABS_MODEL_ID || '').trim() || DEFAULT_MODEL;
  const timeoutMs = Math.min(
    60_000,
    Math.max(
      3_000,
      options.timeoutMs || Number(process.env.VOICE_TTS_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
    )
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${baseUrl}/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.7,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        skipped: res.status === 401 || res.status === 402 || res.status === 429,
        latencyMs: Date.now() - started,
        error: `ElevenLabs TTS ${res.status}: ${errText.slice(0, 180)}`,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: 'ElevenLabs TTS returned empty audio.',
      };
    }

    return {
      ok: true,
      audioBase64: buf.toString('base64'),
      mimeType: 'audio/mpeg',
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      skipped: true,
      latencyMs: Date.now() - started,
      error: aborted
        ? 'ElevenLabs TTS timed out.'
        : err instanceof Error
          ? err.message
          : 'ElevenLabs TTS failed.',
    };
  } finally {
    clearTimeout(timer);
  }
}
