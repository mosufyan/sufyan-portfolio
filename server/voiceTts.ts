/**
 * Grok (xAI) text-to-speech via POST /v1/tts.
 * Returns null audio on missing key / quota / errors so the client can fall
 * back to browser speechSynthesis. Server-only — GROK_API_KEY must never ship to the client.
 */
import { resolveGrokApiKey } from './voiceStt.ts';

const DEFAULT_BASE = 'https://api.x.ai/v1';
/** Built-in Grok voice; override with GROK_TTS_VOICE_ID. */
const DEFAULT_VOICE_ID = 'eve';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_CHARS = 600;

export interface VoiceTtsOptions {
  apiKey?: string;
  voiceId?: string;
  language?: string;
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

export function isVoiceTtsConfigured(apiKey = resolveGrokApiKey()): boolean {
  return Boolean(apiKey && apiKey.length >= 8);
}

/** @deprecated Use synthesizeSpeechWithGrok — kept for older imports. */
export async function synthesizeSpeechWithElevenLabs(
  textRaw: string,
  options: VoiceTtsOptions = {}
): Promise<VoiceTtsResult> {
  return synthesizeSpeechWithGrok(textRaw, options);
}

export async function synthesizeSpeechWithGrok(
  textRaw: string,
  options: VoiceTtsOptions = {}
): Promise<VoiceTtsResult> {
  const started = Date.now();
  const apiKey = resolveGrokApiKey(options.apiKey);
  const text = textRaw.trim().slice(0, MAX_CHARS);
  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      latencyMs: Date.now() - started,
      error: 'Grok TTS is not configured.',
    };
  }
  if (!text) {
    return { ok: false, latencyMs: Date.now() - started, error: 'Empty TTS text.' };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = (options.baseUrl || process.env.GROK_API_BASE_URL || DEFAULT_BASE).replace(
    /\/$/,
    ''
  );
  const voiceId =
    (options.voiceId || process.env.GROK_TTS_VOICE_ID || '').trim() || DEFAULT_VOICE_ID;
  const language =
    (options.language || process.env.GROK_TTS_LANGUAGE || '').trim() || 'en';
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
    const res = await fetchImpl(`${baseUrl}/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        language,
        output_format: {
          codec: 'mp3',
          sample_rate: 24000,
          bit_rate: 128000,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const permissionDenied =
        res.status === 403 &&
        /lacks the permissions|voice endpoints|does not have permission/i.test(errText);
      return {
        ok: false,
        skipped: res.status === 401 || res.status === 402 || res.status === 429 || permissionDenied,
        latencyMs: Date.now() - started,
        error: permissionDenied
          ? 'Grok voice APIs are not enabled on this API key. In console.x.ai, edit the key and add Voice permissions, then retry.'
          : `Grok TTS ${res.status}: ${errText.replace(/\s+/g, ' ').slice(0, 160)}`,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: 'Grok TTS returned empty audio.',
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
        ? 'Grok TTS timed out.'
        : err instanceof Error
          ? err.message
          : 'Grok TTS failed.',
    };
  } finally {
    clearTimeout(timer);
  }
}
