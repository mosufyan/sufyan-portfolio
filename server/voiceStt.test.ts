import { describe, expect, it, vi } from 'vitest';
import { isVoiceSttConfigured, transcribeAudioWithGroq } from './voiceStt.ts';

describe('voiceStt', () => {
  it('reports configuration from api key presence', () => {
    expect(isVoiceSttConfigured('')).toBe(false);
    expect(isVoiceSttConfigured('short')).toBe(false);
    expect(isVoiceSttConfigured('groq_api_key_ok')).toBe(true);
  });

  it('returns error when key missing', async () => {
    const result = await transcribeAudioWithGroq(Buffer.from('abc'), { apiKey: '' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });

  it('transcribes when Groq returns text', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toMatch(/\/audio\/transcriptions$/);
      expect(init?.method).toBe('POST');
      return new Response(JSON.stringify({ text: '  What is your Cisco role?  ' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await transcribeAudioWithGroq(Buffer.from('fake-audio'), {
      apiKey: 'groq_api_key_ok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      mimeType: 'audio/webm',
    });

    expect(result.ok).toBe(true);
    expect(result.transcript).toBe('What is your Cisco role?');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('maps HTTP errors and empty transcripts', async () => {
    const fail = await transcribeAudioWithGroq(Buffer.from('x'), {
      apiKey: 'groq_api_key_ok',
      fetchImpl: vi.fn(async () => new Response('nope', { status: 429 })) as unknown as typeof fetch,
    });
    expect(fail.ok).toBe(false);
    expect(fail.error).toMatch(/429/);

    const empty = await transcribeAudioWithGroq(Buffer.from('x'), {
      apiKey: 'groq_api_key_ok',
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ text: '   ' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
      ) as unknown as typeof fetch,
    });
    expect(empty.ok).toBe(false);
    expect(empty.error).toMatch(/empty/i);
  });
});
