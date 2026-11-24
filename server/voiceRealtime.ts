/**
 * Grok Voice 3.0 (speech-to-speech) helpers:
 * mint ephemeral client secrets + portfolio-grounded session config.
 */
import {
  CERTIFICATIONS,
  PERSONAL_INFO,
  WORK_EXPERIENCE,
} from '../src/data/portfolioData.ts';
import { resolveGrokApiKey } from './voiceStt.ts';

const DEFAULT_BASE = 'https://api.x.ai/v1';
const DEFAULT_MODEL = 'grok-voice-3.0';
const DEFAULT_VOICE = 'eve';

export interface RealtimeClientSecretResult {
  ok: boolean;
  token?: string;
  expiresAt?: number;
  model?: string;
  voice?: string;
  instructions?: string;
  tools?: unknown[];
  wsUrl?: string;
  error?: string;
  latencyMs: number;
}

export function isVoiceRealtimeConfigured(apiKey = resolveGrokApiKey()): boolean {
  return Boolean(apiKey && apiKey.length >= 8);
}

export function buildPortfolioVoiceInstructions(): string {
  const employers = WORK_EXPERIENCE.map(
    (c) => `${c.company} (${c.tenure}): ${c.roles.map((r) => r.role).join(' → ')}`
  ).join('; ');
  return [
    'You are the portfolio voice assistant for Mohammed Sufyan (mohammedsufyan.com).',
    'Speak in clear, concise English. Keep spoken answers under ~40 seconds unless asked for detail.',
    'Prefer facts from portfolio tools / briefing. Do not invent employers, titles, dates, or certifications.',
    'HCL work delivered on Cisco accounts is still HCL employment — distinct from his current Cisco Systems Inc. job.',
    `Identity: ${PERSONAL_INFO.name}, ${PERSONAL_INFO.title}, ${PERSONAL_INFO.experienceYears} years experience, ${CERTIFICATIONS.length} certifications.`,
    `Career: ${employers}.`,
    `Open to: ${PERSONAL_INFO.openTo}`,
    `Contact: ${PERSONAL_INFO.email}, LinkedIn ${PERSONAL_INFO.linkedin}.`,
    'When the visitor asks a factual portfolio question, call the portfolio_answer tool with their question before answering.',
    'Do not recite credential URLs. Offer live chat with Mohammed for hiring discussions when appropriate.',
  ].join('\n');
}

export function buildPortfolioVoiceTools() {
  return [
    {
      type: 'function',
      name: 'portfolio_answer',
      description:
        'Look up grounded facts from Mohammed Sufyan’s published portfolio (experience, skills, certifications, awards, education, contact).',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The visitor question to answer from portfolio knowledge.',
          },
        },
        required: ['question'],
      },
    },
  ];
}

export async function mintGrokRealtimeClientSecret(options?: {
  apiKey?: string;
  expiresSeconds?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  /** Owner Site Controls override; empty falls back to env / default. */
  model?: string;
  /** Prefer owner TTS voice id for live S2S when set. */
  voice?: string;
}): Promise<RealtimeClientSecretResult> {
  const started = Date.now();
  const apiKey = resolveGrokApiKey(options?.apiKey);
  if (!apiKey) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: 'Grok realtime voice is not configured (missing GROK_API_KEY).',
    };
  }

  const fetchImpl = options?.fetchImpl || fetch;
  const baseUrl = (options?.baseUrl || process.env.GROK_API_BASE_URL || DEFAULT_BASE).replace(
    /\/$/,
    ''
  );
  const expiresSeconds = Math.min(
    3600,
    Math.max(60, options?.expiresSeconds || Number(process.env.GROK_REALTIME_TOKEN_SECONDS) || 300)
  );
  const model =
    (options?.model || '').trim() ||
    (process.env.GROK_VOICE_MODEL || '').trim() ||
    DEFAULT_MODEL;
  const voice =
    (options?.voice || '').trim() ||
    (process.env.GROK_TTS_VOICE_ID || process.env.GROK_VOICE_ID || '').trim() ||
    DEFAULT_VOICE;

  try {
    const res = await fetchImpl(`${baseUrl}/realtime/client_secrets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { seconds: expiresSeconds },
      }),
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
          : `Grok realtime token ${res.status}: ${errText.replace(/\s+/g, ' ').slice(0, 160)}`,
      };
    }

    const body = (await res.json()) as { value?: string; expires_at?: number };
    const token = (body.value || '').trim();
    if (!token) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: 'Grok realtime token response missing value.',
      };
    }

    return {
      ok: true,
      token,
      expiresAt: typeof body.expires_at === 'number' ? body.expires_at : undefined,
      model,
      voice,
      instructions: buildPortfolioVoiceInstructions(),
      tools: buildPortfolioVoiceTools(),
      wsUrl: `wss://api.x.ai/v1/realtime?model=${encodeURIComponent(model)}`,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : 'Failed to mint Grok realtime token.',
    };
  }
}
