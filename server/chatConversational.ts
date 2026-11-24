/**
 * Detect short social / closing utterances so chat + voice don't run portfolio RAG
 * (e.g. "okay I got it thank you" → unrelated recommendation chunk).
 */
import type { ChatAnswer } from './chatKnowledge.ts';

const SOCIAL_TOKENS = new Set([
  'a',
  'alright',
  'am',
  'appreciate',
  'bye',
  'cheers',
  'cool',
  'for',
  'glad',
  'good',
  'goodbye',
  'got',
  'great',
  'hello',
  'hey',
  'hi',
  'i',
  'im',
  "i'm",
  'it',
  'k',
  'makes',
  'much',
  'no',
  'nope',
  'nothing',
  'ok',
  'okay',
  'perfect',
  'see',
  'sense',
  'so',
  'sounds',
  'sure',
  'thank',
  'thanks',
  'that',
  "that's",
  'thats',
  'then',
  'thx',
  'ty',
  'understood',
  'very',
  'well',
  'ya',
  'yeah',
  'yep',
  'yes',
  'you',
  'your',
]);

function tokenizeSocial(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** True when the utterance is basically thanks / ack / greeting / goodbye — not a portfolio ask. */
export function isConversationalUtterance(questionRaw: string): boolean {
  const tokens = tokenizeSocial(questionRaw);
  if (tokens.length === 0 || tokens.length > 14) return false;
  const content = tokens.filter((t) => !SOCIAL_TOKENS.has(t));
  return content.length === 0;
}

function conversationalReply(questionRaw: string): string {
  const q = questionRaw.toLowerCase();
  if (/\b(bye|goodbye|see you|that'?s all|nothing else)\b/.test(q)) {
    return 'Glad I could help. Feel free to come back anytime with questions about Mohammed’s experience, skills, or how to reach him.';
  }
  if (/\b(hi|hello|hey)\b/.test(q) && !/\b(thank|thanks|got it|okay|ok)\b/.test(q)) {
    return 'Hi — ask me about Mohammed’s role at Cisco, experience, skills, certifications, awards, or how to contact him.';
  }
  if (/\b(thank|thanks|thx|appreciate)\b/.test(q)) {
    return 'You’re welcome! Happy to help — ask another question anytime about his background, or use the contact form if you’d like to reach Mohammed directly.';
  }
  return 'Glad that helped. What else would you like to know — experience, skills, certifications, or contact?';
}

export function answerConversationalUtterance(questionRaw: string): ChatAnswer | null {
  if (!isConversationalUtterance(questionRaw)) return null;
  const answer = conversationalReply(questionRaw);
  return {
    answer,
    confidence: 0.99,
    sources: [],
    suggestions: [
      'What is Mohammed’s current role at Cisco?',
      'What certifications does he hold?',
      'How can I contact him?',
    ],
    followUps: [
      'What is Mohammed’s current role at Cisco?',
      'What certifications does he hold?',
      'How can I contact him?',
    ],
    offerLiveAgent: false,
    composed: true,
    retrieval: 'keyword',
  };
}
