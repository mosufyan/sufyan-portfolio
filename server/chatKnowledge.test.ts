import { describe, expect, it } from 'vitest';
import {
  answerPortfolioQuestion,
  listChatSuggestions,
  makeConciseAnswer,
} from './chatKnowledge.ts';

describe('chatKnowledge', () => {
  it('answers cisco role questions with sources and follow-ups', () => {
    const result = answerPortfolioQuestion('What is Mohammed current role at Cisco?');
    expect(result.answer.toLowerCase()).toMatch(/cisco|software engineer/);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0.15);
    expect(result.followUps.length).toBeGreaterThan(0);
    expect(result.answer.length).toBeLessThanOrEqual(400);
  });

  it('answers skills / cloud questions concisely', () => {
    const result = answerPortfolioQuestion('Which clouds and platforms has he worked with?');
    expect(result.answer.length).toBeGreaterThan(20);
    expect(result.answer.length).toBeLessThanOrEqual(400);
    expect(result.confidence).toBeGreaterThan(0.1);
    expect(result.followUps.length).toBeGreaterThan(0);
  });

  it('answers contact / open-to questions', () => {
    const contact = answerPortfolioQuestion('How can I contact Mohammed?');
    expect(contact.answer.toLowerCase()).toMatch(/email|linkedin|contact/);
    const open = answerPortfolioQuestion('Is he open to new opportunities?');
    expect(open.answer.length).toBeGreaterThan(10);
    expect(open.followUps.length).toBeGreaterThan(0);
  });

  it('offers live agent when confidence is low', () => {
    const result = answerPortfolioQuestion('xyzzy unrelated quantum pineapple recipe 999');
    expect(result.offerLiveAgent).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.followUps.length).toBeGreaterThan(0);
  });

  it('exposes starter suggestions', () => {
    expect(listChatSuggestions().length).toBeGreaterThanOrEqual(3);
  });

  it('truncates overly long questions safely', () => {
    const result = answerPortfolioQuestion(`Cisco role? ${'x'.repeat(2000)}`);
    expect(result.answer.length).toBeGreaterThan(0);
  });

  it('makeConciseAnswer keeps short multi-sentence text under the cap', () => {
    const long =
      'First sentence about Cisco work. Second sentence adds cloud detail. Third sentence is extra context that may be trimmed.';
    const concise = makeConciseAnswer(long, 160);
    expect(concise.length).toBeLessThanOrEqual(160);
    expect(concise.toLowerCase()).toContain('cisco');
  });
});
