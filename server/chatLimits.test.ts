import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildVisitorKey,
  checkChatLimit,
  checkChatLimitAsync,
  consumeChatLimit,
  consumeChatLimitAsync,
  getChatUsageTotals,
  resetChatUsageStoreForTests,
  type ChatLimitPolicy,
} from './chatLimits.ts';

const policy: ChatLimitPolicy = {
  maxQuestionsPerVisitor: 10,
  maxLlmPerVisitor: 5,
  maxLiveSessionsPerVisitor: 3,
  maxVoiceTurnsPerVisitor: 8,
  maxVoiceRealtimeSessionsPerVisitor: 2,
  maxVoiceRealtimeMinutesPerVisitor: 5,
  rateWindowHours: 24,
};

describe('chatLimits', () => {
  beforeEach(() => {
    resetChatUsageStoreForTests();
  });

  it('builds stable visitor keys from email (ignores spoofable visitorId)', () => {
    const a = buildVisitorKey({ ipAddress: '1.2.3.4', email: 'A@Example.com' });
    const b = buildVisitorKey({ ipAddress: '9.9.9.9', email: 'a@example.com' });
    expect(a).toBe(b);
    const spoofA = buildVisitorKey({ ipAddress: '1.2.3.4', visitorId: 'vid-1' });
    const spoofB = buildVisitorKey({ ipAddress: '1.2.3.4', visitorId: 'vid-2' });
    expect(spoofA).toBe(spoofB);
    expect(spoofA).not.toBe(a);
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

  it('tracks llm, live, and voice counters independently', () => {
    const key = buildVisitorKey({ ipAddress: '198.51.100.1', email: 'recruiter@cisco.com' });
    expect(consumeChatLimit(key, 'llm', policy).remaining).toBe(4);
    expect(consumeChatLimit(key, 'live', policy).remaining).toBe(2);
    expect(consumeChatLimit(key, 'voice', policy).remaining).toBe(7);
    expect(checkChatLimit(key, 'question', policy).remaining).toBe(10);
    const totals = getChatUsageTotals();
    expect(totals.llmCalls).toBe(1);
    expect(totals.liveSessions).toBe(1);
    expect(totals.voiceTurns).toBe(1);
    expect(totals.trackedVisitors).toBe(1);
  });

  it('enforces per-visitor voice turn caps', () => {
    const key = buildVisitorKey({ ipAddress: '203.0.113.88' });
    const tight = { ...policy, maxVoiceTurnsPerVisitor: 2 };
    expect(consumeChatLimit(key, 'voice', tight).allowed).toBe(true);
    expect(consumeChatLimit(key, 'voice', tight).allowed).toBe(true);
    expect(consumeChatLimit(key, 'voice', tight).allowed).toBe(false);
    expect(consumeChatLimit(key, 'voice', tight).reason).toMatch(/voice turns/i);
  });

  it('enforces live S2S session and minute caps separately from push-to-talk', () => {
    const key = buildVisitorKey({ ipAddress: '203.0.113.91', email: 'rt@example.com' });
    expect(consumeChatLimit(key, 'voiceRealtimeSession', policy).allowed).toBe(true);
    expect(consumeChatLimit(key, 'voiceRealtimeSession', policy).allowed).toBe(true);
    expect(consumeChatLimit(key, 'voiceRealtimeSession', policy).allowed).toBe(false);
    expect(consumeChatLimit(key, 'voice', policy).allowed).toBe(true);

    const minKey = buildVisitorKey({ ipAddress: '203.0.113.92', email: 'mins@example.com' });
    expect(consumeChatLimit(minKey, 'voiceRealtimeMinute', policy, Date.now(), 3).remaining).toBe(2);
    expect(consumeChatLimit(minKey, 'voiceRealtimeMinute', policy, Date.now(), 3).allowed).toBe(
      false
    );
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

  it('keys anonymous visitors by IP only (same IP shares quota)', () => {
    const a = buildVisitorKey({ ipAddress: '203.0.113.50' });
    const b = buildVisitorKey({ ipAddress: '203.0.113.50', visitorId: 'spoofed' });
    expect(a).toBe(b);
    consumeChatLimit(a, 'question', { ...policy, maxQuestionsPerVisitor: 1 });
    expect(checkChatLimit(b, 'question', { ...policy, maxQuestionsPerVisitor: 1 }).allowed).toBe(
      false
    );
  });

  it('separates email-verified visitors from IP-only visitors', () => {
    const ipKey = buildVisitorKey({ ipAddress: '203.0.113.77' });
    const emailKey = buildVisitorKey({
      ipAddress: '203.0.113.77',
      email: 'recruiter@example.com',
    });
    expect(ipKey).not.toBe(emailKey);
  });

  it('async helpers fall back to memory when Redis is unset', async () => {
    const key = buildVisitorKey({ ipAddress: '203.0.113.99' });
    const tight = { ...policy, maxQuestionsPerVisitor: 2 };
    expect((await consumeChatLimitAsync(key, 'question', tight)).allowed).toBe(true);
    expect((await consumeChatLimitAsync(key, 'question', tight)).allowed).toBe(true);
    expect((await consumeChatLimitAsync(key, 'question', tight)).allowed).toBe(false);
    expect((await checkChatLimitAsync(key, 'question', tight)).allowed).toBe(false);
  });
});
