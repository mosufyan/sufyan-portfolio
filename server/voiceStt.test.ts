import { describe, expect, it, vi } from 'vitest';
import { isVoiceSttConfigured, transcribeAudioWithGrok } from './voiceStt.ts';

describe('voiceStt', () => {
  it('reports configuration from api key presence', () => {
    expect(isVoiceSttConfigured('')).toBe(false);
    expect(isVoiceSttConfigured('short')).toBe(false);
    expect(isVoiceSttConfigured('grok_api_key_ok')).toBe(true);
  });

  it('returns error when key missing', async () => {
    const result = await transcribeAudioWithGrok(Buffer.from('abc'), { apiKey: '' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });

  it('transcribes when Grok returns text', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toMatch(/\/stt$/);
      expect(init?.method).toBe('POST');
      return new Response(JSON.stringify({ text: '  What is your Cisco role?  ' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await transcribeAudioWithGrok(Buffer.from('fake-audio'), {
      apiKey: 'grok_api_key_ok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      mimeType: 'audio/webm',
    });

    expect(result.ok).toBe(true);
    expect(result.transcript).toBe('What is your Cisco role?');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('maps missing Voice API permissions to a clear message', async () => {
    const denied = await transcribeAudioWithGrok(Buffer.from('x'), {
      apiKey: 'grok_api_key_ok',
      fetchImpl: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error:
                'The API key cannot be used to make a request against voice endpoints because it lacks the permissions to do so.',
            }),
            { status: 403 }
          )
      ) as unknown as typeof fetch,
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/console\.x\.ai/i);
    expect(denied.error).toMatch(/Voice permissions/i);
  });

  it('maps HTTP errors and empty transcripts', async () => {
    const fail = await transcribeAudioWithGrok(Buffer.from('x'), {
      apiKey: 'grok_api_key_ok',
      fetchImpl: vi.fn(async () => new Response('nope', { status: 429 })) as unknown as typeof fetch,
    });
    expect(fail.ok).toBe(false);
    expect(fail.error).toMatch(/429/);

    const empty = await transcribeAudioWithGrok(Buffer.from('x'), {
      apiKey: 'grok_api_key_ok',
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
