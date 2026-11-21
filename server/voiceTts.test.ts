import { describe, expect, it, vi } from 'vitest';
import { isVoiceTtsConfigured, synthesizeSpeechWithElevenLabs } from './voiceTts.ts';

describe('voiceTts', () => {
  it('reports configuration from api key presence', () => {
    expect(isVoiceTtsConfigured('')).toBe(false);
    expect(isVoiceTtsConfigured('eleven_key_ok')).toBe(true);
  });

  it('skips when key missing', async () => {
    const result = await synthesizeSpeechWithElevenLabs('Hello there.', { apiKey: '' });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it('returns base64 audio on success', async () => {
    const bytes = Buffer.from([1, 2, 3, 4, 5]);
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toMatch(/\/text-to-speech\//);
      const body = JSON.parse(String(init?.body || '{}')) as { model_id?: string; text?: string };
      expect(body.model_id).toBe('eleven_flash_v2_5');
      expect(body.text).toMatch(/Cisco/);
      return new Response(bytes, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    });

    const result = await synthesizeSpeechWithElevenLabs('Mohammed works at Cisco.', {
      apiKey: 'eleven_key_ok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.audioBase64).toBe(bytes.toString('base64'));
  });

  it('marks 429 as skipped for browser fallback', async () => {
    const result = await synthesizeSpeechWithElevenLabs('Quota test.', {
      apiKey: 'eleven_key_ok',
      fetchImpl: vi.fn(async () => new Response('limit', { status: 429 })) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.error).toMatch(/429/);
  });
});
