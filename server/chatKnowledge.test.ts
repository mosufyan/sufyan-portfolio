import { describe, expect, it } from 'vitest';
import {
  answerPortfolioQuestion,
  listChatSuggestions,
  listKnowledgeChunks,
  makeConciseAnswer,
} from './chatKnowledge.ts';

describe('chatKnowledge', () => {
  it('indexes a full portfolio corpus (experience, certs, awards, edu, etc.)', () => {
    const chunks = listKnowledgeChunks();
    expect(chunks.length).toBeGreaterThanOrEqual(40);
    const ids = chunks.map((c) => c.id).join(' ');
    expect(ids).toMatch(/exp-/);
    expect(ids).toMatch(/cert-/);
    expect(ids).toMatch(/award-/);
    expect(ids).toMatch(/edu-/);
    expect(ids).toMatch(/skill-/);
    expect(ids).toMatch(/rec-/);
  });

  it('answers cisco role questions with sources and follow-ups', () => {
    const result = answerPortfolioQuestion('What is Mohammed current role at Cisco?');
    expect(result.answer.toLowerCase()).toMatch(/cisco|software engineer/);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0.15);
    expect(result.followUps.length).toBeGreaterThan(0);
    expect(result.answer.length).toBeLessThanOrEqual(720);
    expect((result.retrievalContext || '').length).toBeGreaterThan(80);
  });

  it('does not return the same company tenure banner for different Cisco questions', () => {
    const role = answerPortfolioQuestion('What is Mohammed current role at Cisco?');
    const security = answerPortfolioQuestion(
      'What security or Zero Trust work has he done at Cisco?'
    );
    const before = answerPortfolioQuestion('What did he do before Cisco?');
    const tcs = answerPortfolioQuestion('What did he focus on at TCS?');

    expect(security.answer.toLowerCase()).toMatch(/atlas|security|sto|zero trust|pipeline|databricks/);
    expect(security.answer).not.toMatch(/^Cisco Systems Inc\. · CURRENT ROLE/);
    expect(before.answer.toLowerCase()).toMatch(/hcl/);
    expect(before.answer.toLowerCase()).toMatch(/tata|tcs/);
    expect(before.answer.toLowerCase()).not.toMatch(/covers only hcl|no details appear on any prior/i);
    expect(before.answer.toLowerCase()).not.toMatch(/aug 2026 — present · 3 mos/);
    expect(before.sources.join(' ').toLowerCase()).toMatch(/hcl/);
    expect(before.sources.join(' ').toLowerCase()).toMatch(/tata|tcs/);
    expect(tcs.answer.toLowerCase()).toMatch(/tata|tcs|analyst|engineer|delivery|ilp|london/);
    expect(tcs.sources.join(' ').toLowerCase()).not.toMatch(/recommendation/);
    expect(role.answer).not.toEqual(before.answer);
    expect(security.answer).not.toEqual(tcs.answer);
  });

  it('composes a chronological before-Cisco career answer with follow-ups', () => {
    const before = answerPortfolioQuestion('What did he do before Cisco?');
    expect(before.confidence).toBeGreaterThanOrEqual(0.9);
    expect(before.followUps.length).toBeGreaterThanOrEqual(2);
    expect(before.followUps.join(' ').toLowerCase()).toMatch(/hcl|tcs|security|zero trust|cloud/);
    expect(before.retrievalContext || '').toMatch(/HCL|Tata/i);
  });

  it('keeps Cisco follow-ups inclined to that answer, not the question just asked', () => {
    const result = answerPortfolioQuestion('What is Mohammed current role at Cisco?');
    expect(result.followUps.length).toBeGreaterThanOrEqual(2);
    expect(result.followUps.join(' ').toLowerCase()).not.toMatch(/current role at cisco/);
    expect(result.followUps.join(' ').toLowerCase()).toMatch(/cisco|before cisco|hcl|tcs|zero trust|security/);
  });

  it('varies follow-ups by the previous question topic', () => {
    const cisco = answerPortfolioQuestion('What is Mohammed current role at Cisco?');
    const clouds = answerPortfolioQuestion('Which clouds and platforms has he worked with?');
    const certs = answerPortfolioQuestion('What certifications does he hold?');
    expect(cisco.followUps).not.toEqual(clouds.followUps);
    expect(clouds.followUps).not.toEqual(certs.followUps);
    expect(certs.followUps.join(' ').toLowerCase()).toMatch(/cert|award|cloud|aws|azure/);
    expect(clouds.followUps.join(' ').toLowerCase()).toMatch(/cert|zero trust|security|databricks|cisco/);
  });

  it('answers skills / cloud questions concisely', () => {
    const result = answerPortfolioQuestion('Which clouds and platforms has he worked with?');
    expect(result.answer.length).toBeGreaterThan(20);
    expect(result.answer.length).toBeLessThanOrEqual(720);
    expect(result.confidence).toBeGreaterThan(0.1);
    expect(result.answer.toLowerCase()).toMatch(/aws|azure|gcp|cloud|databricks|multi-cloud/);
    expect(result.answer.toLowerCase()).not.toMatch(/visvesvaraya|bachelor/);
    expect(result.followUps.length).toBeGreaterThan(0);
  });

  it('answers certification questions without ranking TCS experience', () => {
    const result = answerPortfolioQuestion('What certifications does he hold?');
    expect(result.answer.toLowerCase()).toMatch(/certif|aws|azure|ai|databricks|cloud/);
    expect(result.sources.some((s) => /certification/i.test(s))).toBe(true);
    expect(result.answer.toLowerCase()).not.toMatch(/tata consultancy|5 yrs 9 mos/);
    expect(result.sources.join(' ').toLowerCase()).not.toMatch(/tata consultancy/);
    expect(result.answer).not.toMatch(/https?:\/\//i);
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.followUps.length).toBeGreaterThan(0);
    expect(result.composed).toBe(true);
  });

  it('answers certification count and brief-explain questions clearly', () => {
    const count = answerPortfolioQuestion('How many certifications does he have?');
    expect(count.answer).toMatch(/\b20\b/);
    expect(count.answer.toLowerCase()).toMatch(/ai|cloud|devops/);
    expect(count.answer).not.toMatch(/https?:\/\//i);

    const brief = answerPortfolioQuestion('Can you explain briefly about his certifications?');
    expect(brief.answer.toLowerCase()).toMatch(/20|certif/);
    expect(brief.answer.toLowerCase()).toMatch(/aws|azure|databricks|cloud/);
    expect(brief.answer).not.toMatch(/credential: https?/i);
    expect(brief.composed).toBe(true);
  });

  it('answers awards, education, and career overview from portfolio data', () => {
    const awards = answerPortfolioQuestion('How many awards has he received?');
    expect(awards.answer).toMatch(/\b20\b/);
    expect(awards.answer.toLowerCase()).toMatch(/award|cisco|hcl/);

    const edu = answerPortfolioQuestion('What is his education background?');
    expect(edu.answer.toLowerCase()).toMatch(/visvesvaraya|bachelor|computer science|9\.5/);

    const career = answerPortfolioQuestion('Give me a brief overview of his experience');
    expect(career.answer.toLowerCase()).toMatch(/cisco|hcl|tata|tcs/);
    expect(career.composed).toBe(true);
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
