import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildVisitorKey,
  checkChatLimit,
  consumeChatLimit,
  getChatUsageTotals,
  resetChatUsageStoreForTests,
  type ChatLimitPolicy,
} from './chatLimits.ts';

const policy: ChatLimitPolicy = {
  maxQuestionsPerVisitor: 10,
  maxLlmPerVisitor: 5,
  maxLiveSessionsPerVisitor: 3,
  rateWindowHours: 24,
};

describe('chatLimits', () => {
  beforeEach(() => {
    resetChatUsageStoreForTests();
  });

  it('builds stable visitor keys from email or visitor id', () => {
    const a = buildVisitorKey({ ipAddress: '1.2.3.4', email: 'A@Example.com' });
    const b = buildVisitorKey({ ipAddress: '9.9.9.9', email: 'a@example.com' });
    expect(a).toBe(b);
    const c = buildVisitorKey({ ipAddress: '1.2.3.4', visitorId: 'vid-1' });
    const d = buildVisitorKey({ ipAddress: '1.2.3.4', visitorId: 'vid-1' });
    expect(c).toBe(d);
    expect(c).not.toBe(a);
  });

  it('enforces per-visitor question caps (default 10)', () => {
    const key = buildVisitorKey({ ipAddress: '203.0.113.10', visitorId: 'u1' });
    for (let i = 0; i < 10; i += 1) {
      const d = consumeChatLimit(key, 'question', policy);
      expect(d.allowed).toBe(true);
    }
    const blocked = consumeChatLimit(key, 'question', policy);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.reason).toMatch(/limit reached/i);
  });

  it('tracks llm and live counters independently', () => {
    const key = buildVisitorKey({ ipAddress: '198.51.100.1', email: 'recruiter@cisco.com' });
    expect(consumeChatLimit(key, 'llm', policy).remaining).toBe(4);
    expect(consumeChatLimit(key, 'live', policy).remaining).toBe(2);
    expect(checkChatLimit(key, 'question', policy).remaining).toBe(10);
    const totals = getChatUsageTotals();
    expect(totals.llmCalls).toBe(1);
    expect(totals.liveSessions).toBe(1);
    expect(totals.trackedVisitors).toBe(1);
  });

  it('resets after the rate window elapses', () => {
    const key = buildVisitorKey({ ipAddress: '10.0.0.1' });
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 10; i += 1) {
      consumeChatLimit(key, 'question', policy, t0);
    }
    expect(checkChatLimit(key, 'question', policy, t0).allowed).toBe(false);
    const nextWindow = t0 + 24 * 60 * 60 * 1000 + 1;
    expect(checkChatLimit(key, 'question', policy, nextWindow).allowed).toBe(true);
    expect(checkChatLimit(key, 'question', policy, nextWindow).remaining).toBe(10);
  });
});
