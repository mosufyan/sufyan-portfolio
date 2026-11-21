import { describe, expect, it, vi, afterEach } from 'vitest';
import { HttpTurnTransport, createVoiceTransport } from './voiceTransport';

describe('voiceTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates http-turn transport by default', () => {
    const transport = createVoiceTransport();
    expect(transport.kind).toBe('http-turn');
  });

  it('posts multipart audio and returns parsed JSON', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeInstanceOf(FormData);
      const headers = init?.headers as Record<string, string>;
      expect(headers['X-Chat-Receipt']).toBe('receipt-1');
      return new Response(
        JSON.stringify({
          ok: true,
          transcript: 'What is your role?',
          answer: 'Software Engineer at Cisco.',
          ttsProvider: 'none',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const transport = new HttpTurnTransport();
    const result = await transport.submitUtterance({
      audio: new Blob(['fake'], { type: 'audio/webm' }),
      sessionId: 'sess-1',
      receipt: 'receipt-1',
      visitorId: 'vid-1',
    });

    expect(result.ok).toBe(true);
    expect(result.transcript).toMatch(/role/i);
    expect(result.answer).toMatch(/Cisco/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('maps HTTP errors into ok:false responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Voice agent is temporarily unavailable.' }), {
          status: 503,
        })
      )
    );
    const transport = new HttpTurnTransport();
    const result = await transport.submitUtterance({
      audio: new Blob(['x'], { type: 'audio/webm' }),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unavailable/i);
  });
});
