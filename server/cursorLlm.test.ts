import { describe, expect, it, vi } from 'vitest';
import { enrichAnswerWithCursorLlm, isCursorLlmConfigured } from './cursorLlm.ts';

describe('cursorLlm', () => {
  it('reports configuration from api key presence', () => {
    expect(isCursorLlmConfigured('')).toBe(false);
    expect(isCursorLlmConfigured('short')).toBe(false);
    expect(isCursorLlmConfigured('cursor_api_key_value')).toBe(true);
  });

  it('falls back to grounded answers when Cursor API is unavailable', async () => {
    const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const result = await enrichAnswerWithCursorLlm('What is Mohammed current role at Cisco?', {
      apiKey: 'cursor_api_key_value',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 3000,
    });
    expect(result.provider).toBe('grounded');
    expect(result.answer.answer.toLowerCase()).toMatch(/cisco|software|engineer|portfolio/);
    expect(result.error).toMatch(/401/);
  });

  it('returns Cursor assistant text when the run completes', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      calls += 1;
      if (String(url).endsWith('/v1/agents') && calls === 1) {
        return new Response(
          JSON.stringify({
            agent: { id: 'bc-agent-1' },
            run: { id: 'run-1' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          status: 'FINISHED',
          text: 'Mohammed is a Software Engineer at Cisco focused on security platforms.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await enrichAnswerWithCursorLlm('What is his Cisco role?', {
      apiKey: 'cursor_api_key_value',
      modelId: 'composer-2',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 5000,
    });

    expect(result.provider).toBe('cursor');
    expect(result.agentId).toBe('bc-agent-1');
    expect(result.runId).toBe('run-1');
    expect(result.answer.answer).toMatch(/Cisco/);
  });

  it('serves grounded answer without calling Cursor when key is empty', async () => {
    const fetchImpl = vi.fn();
    const result = await enrichAnswerWithCursorLlm('Is he open to roles?', {
      apiKey: '',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.provider).toBe('grounded');
    expect(result.answer.answer.length).toBeGreaterThan(10);
  });
});
