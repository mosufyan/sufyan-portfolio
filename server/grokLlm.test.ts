import { describe, expect, it, vi } from 'vitest';
import {
  enrichAnswerWithGrokLlm,
  isGrokLlmConfigured,
  shouldSkipGrokEnrichment,
} from './grokLlm.ts';
import type { ChatAnswer } from './chatKnowledge.ts';

function grounded(partial: Partial<ChatAnswer>): ChatAnswer {
  return {
    answer: 'Mohammed is a Software Engineer at Cisco.',
    sources: ['Experience — Cisco'],
    confidence: 0.8,
    suggestions: [],
    followUps: [],
    offerLiveAgent: false,
    retrieval: 'vector',
    retrievalContext: 'Experience — Cisco: Software Engineer building security platforms. '.repeat(4),
    ...partial,
  };
}

describe('grokLlm', () => {
  it('reports configuration from api key presence', () => {
    expect(isGrokLlmConfigured('')).toBe(false);
    expect(isGrokLlmConfigured('short')).toBe(false);
    expect(isGrokLlmConfigured('grok_api_key_value')).toBe(true);
  });

  it('skips Grok on high-confidence factual hits, but not synthesis / work-detail asks', () => {
    expect(shouldSkipGrokEnrichment('How can I contact him?', grounded({}))).toBe(true);
    expect(
      shouldSkipGrokEnrichment(
        'Summarize his security experience in detail',
        grounded({})
      )
    ).toBe(false);
    expect(shouldSkipGrokEnrichment('What did he focus on at TCS?', grounded({}))).toBe(false);
    expect(
      shouldSkipGrokEnrichment(
        'Cisco role?',
        grounded({
          answer: 'Cisco Systems Inc. · CURRENT ROLE · FULL-TIME. Tenure Aug 2026 — Present.',
        })
      )
    ).toBe(false);
    expect(
      shouldSkipGrokEnrichment('Cisco role?', grounded({ confidence: 0.4, sources: [] }))
    ).toBe(false);
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
