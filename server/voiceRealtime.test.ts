import { describe, expect, it, vi } from 'vitest';
import {
  buildPortfolioVoiceInstructions,
  buildPortfolioVoiceTools,
  isVoiceRealtimeConfigured,
  mintGrokRealtimeClientSecret,
} from './voiceRealtime.ts';

describe('voiceRealtime', () => {
  it('reports configuration from api key presence', () => {
    expect(isVoiceRealtimeConfigured('')).toBe(false);
    expect(isVoiceRealtimeConfigured('grok_api_key_ok')).toBe(true);
  });

  it('builds portfolio instructions and portfolio_answer tool', () => {
    const instructions = buildPortfolioVoiceInstructions();
    expect(instructions).toMatch(/Mohammed Sufyan/);
    expect(instructions).toMatch(/portfolio_answer/);
    const tools = buildPortfolioVoiceTools();
    expect(tools[0]).toMatchObject({ type: 'function', name: 'portfolio_answer' });
  });

  it('mints ephemeral client secret', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toMatch(/\/realtime\/client_secrets$/);
      expect(init?.method).toBe('POST');
      return new Response(
        JSON.stringify({ value: 'ephemeral-token-xyz', expires_at: 1_700_000_000 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await mintGrokRealtimeClientSecret({
      apiKey: 'grok_api_key_ok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      model: 'grok-voice-3.0-custom',
      voice: 'ara',
    });

    expect(result.ok).toBe(true);
    expect(result.token).toBe('ephemeral-token-xyz');
    expect(result.model).toBe('grok-voice-3.0-custom');
    expect(result.voice).toBe('ara');
    expect(result.wsUrl).toMatch(/model=grok-voice-3\.0-custom/);
    expect(result.tools?.[0]).toMatchObject({ name: 'portfolio_answer' });
  });

  it('surfaces mint failures', async () => {
    const missing = await mintGrokRealtimeClientSecret({ apiKey: '' });
    expect(missing.ok).toBe(false);
    expect(missing.error).toMatch(/not configured/i);

    const httpFail = await mintGrokRealtimeClientSecret({
      apiKey: 'grok_api_key_ok',
      fetchImpl: vi.fn(async () => new Response('denied', { status: 401 })) as unknown as typeof fetch,
    });
    expect(httpFail.ok).toBe(false);
    expect(httpFail.error).toMatch(/401/);
  });
});
