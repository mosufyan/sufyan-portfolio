import { describe, expect, it, vi } from 'vitest';
import { enrichAnswerWithGrokLlm, isGrokLlmConfigured } from './grokLlm.ts';

describe('grokLlm', () => {
  it('reports configuration from api key presence', () => {
    expect(isGrokLlmConfigured('')).toBe(false);
    expect(isGrokLlmConfigured('short')).toBe(false);
    expect(isGrokLlmConfigured('grok_api_key_value')).toBe(true);
  });

  it('falls back to grounded answers when Grok API is unavailable', async () => {
    const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const result = await enrichAnswerWithGrokLlm('What is Mohammed current role at Cisco?', {
      apiKey: 'grok_api_key_value',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 3000,
    });
    expect(result.provider).toBe('grounded');
    expect(result.answer.answer.toLowerCase()).toMatch(/cisco|software|engineer|portfolio/);
    expect(result.error).toMatch(/401/);
  });

  it('returns Grok assistant text when completions succeed', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toMatch(/\/chat\/completions$/);
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string };
      expect(body.model).toBe('grok-4.3');
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'Mohammed is a Software Engineer at Cisco focused on security platforms.',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await enrichAnswerWithGrokLlm('What is his Cisco role?', {
      apiKey: 'grok_api_key_value',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 5000,
    });

    expect(result.provider).toBe('grok');
    expect(result.answer.answer).toMatch(/Cisco/);
  });

  it('uses chatLlmModel override when provided', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string };
      expect(body.model).toBe('grok-4.5');
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'Short answer.' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await enrichAnswerWithGrokLlm('Contact?', {
      apiKey: 'grok_api_key_value',
      modelId: 'grok-4.5',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.provider).toBe('grok');
  });

  it('serves grounded answer without calling Grok when key is empty', async () => {
    const fetchImpl = vi.fn();
    const result = await enrichAnswerWithGrokLlm('Is he open to roles?', {
      apiKey: '',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.provider).toBe('grounded');
    expect(result.answer.answer.length).toBeGreaterThan(10);
  });
});
