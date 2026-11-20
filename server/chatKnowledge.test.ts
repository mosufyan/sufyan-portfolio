import { describe, expect, it } from 'vitest';
import { answerPortfolioQuestion, listChatSuggestions } from './chatKnowledge.ts';

describe('chatKnowledge', () => {
  it('answers cisco role questions with sources', () => {
    const result = answerPortfolioQuestion('What is Mohammed current role at Cisco?');
    expect(result.answer.toLowerCase()).toMatch(/cisco|software engineer/);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0.15);
  });

  it('offers live agent when confidence is low', () => {
    const result = answerPortfolioQuestion('xyzzy unrelated quantum pineapple recipe 999');
    expect(result.offerLiveAgent).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('exposes starter suggestions', () => {
    expect(listChatSuggestions().length).toBeGreaterThanOrEqual(3);
  });
});
