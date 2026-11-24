import { describe, expect, it, vi } from 'vitest';
import { isVoiceTtsConfigured, synthesizeSpeechWithGrok } from './voiceTts.ts';

describe('voiceTts', () => {
  it('reports configuration from api key presence', () => {
    expect(isVoiceTtsConfigured('')).toBe(false);
    expect(isVoiceTtsConfigured('grok_api_key_ok')).toBe(true);
  });

  it('skips when key missing', async () => {
    const result = await synthesizeSpeechWithGrok('Hello there.', { apiKey: '' });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it('returns base64 audio on success', async () => {
    const bytes = Buffer.from([1, 2, 3, 4, 5]);
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toMatch(/\/tts$/);
      const body = JSON.parse(String(init?.body || '{}')) as {
        voice_id?: string;
        text?: string;
      };
      expect(body.voice_id).toBe('eve');
      expect(body.text).toMatch(/Cisco/);
      return new Response(bytes, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    });

    const result = await synthesizeSpeechWithGrok('Mohammed works at Cisco.', {
      apiKey: 'grok_api_key_ok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.audioBase64).toBe(bytes.toString('base64'));
  });

  it('marks 429 as skipped for browser fallback', async () => {
    const result = await synthesizeSpeechWithGrok('Quota test.', {
      apiKey: 'grok_api_key_ok',
      fetchImpl: vi.fn(async () => new Response('limit', { status: 429 })) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.error).toMatch(/429/);
  });
});
