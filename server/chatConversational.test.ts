import { describe, expect, it } from 'vitest';
import {
  answerConversationalUtterance,
  isConversationalUtterance,
} from './chatConversational.ts';

describe('chatConversational', () => {
  it('treats thanks / got-it closings as conversational', () => {
    expect(isConversationalUtterance('Okay, I got it. Thank you.')).toBe(true);
    expect(isConversationalUtterance('thanks!')).toBe(true);
    expect(isConversationalUtterance('Got it')).toBe(true);
    expect(isConversationalUtterance('bye')).toBe(true);
    expect(isConversationalUtterance('hi')).toBe(true);
  });

  it('does not treat real portfolio questions as conversational', () => {
    expect(isConversationalUtterance('What certifications does he hold?')).toBe(false);
    expect(isConversationalUtterance('Tell me more about recommendations')).toBe(false);
    expect(isConversationalUtterance('Thanks — what is his Cisco role?')).toBe(false);
  });

  it('returns a short welcome reply for thank-you, not RAG content', () => {
    const result = answerConversationalUtterance('Okay, I got it. Thank you.');
    expect(result).not.toBeNull();
    expect(result!.answer.toLowerCase()).toMatch(/welcome|glad|help/);
    expect(result!.answer.toLowerCase()).not.toMatch(/saifullah|recommendation|linkedin/);
    expect(result!.composed).toBe(true);
  });
});
