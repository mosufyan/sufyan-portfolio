/**
 * Per-visitor chat usage counters for bot Q&A, Grok LLM, live sessions,
 * push-to-talk voice turns, and live speech-to-speech (sessions + minutes).
 * When Upstash Redis is configured, quotas are shared across Cloud Run replicas.
 */
import crypto from 'crypto';
import {
  incrDistributedChatQuota,
  isDistributedStoreEnabled,
  peekDistributedChatQuota,
} from './distributedStore.ts';

export interface VisitorChatUsage {
  visitorKey: string;
  windowStartedAtMs: number;
  questions: number;
  llmCalls: number;
  liveSessions: number;
  voiceTurns: number;
  voiceRealtimeSessions: number;
  voiceRealtimeMinutes: number;
}

export interface ChatLimitPolicy {
  maxQuestionsPerVisitor: number;
  maxLlmPerVisitor: number;
  maxLiveSessionsPerVisitor: number;
  maxVoiceTurnsPerVisitor: number;
  maxVoiceRealtimeSessionsPerVisitor: number;
  maxVoiceRealtimeMinutesPerVisitor: number;
  rateWindowHours: number;
}

export type ChatLimitKind =
  | 'question'
  | 'llm'
  | 'live'
  | 'voice'
  | 'voiceRealtimeSession'
  | 'voiceRealtimeMinute';

export interface ChatLimitDecision {
  allowed: boolean;
  reason?: string;
  remaining: number;
  usage: VisitorChatUsage;
  resetAtMs: number;
}

const MAX_USAGE_ENTRIES = 5_000;
const usages = new Map<string, VisitorChatUsage>();

/** Soft cap for a single live S2S WebSocket (minutes prepaid on mint). */
export const MAX_VOICE_REALTIME_SESSION_MINUTES = 10;

export function resetChatUsageStoreForTests(): void {
  usages.clear();
}

export function exportChatUsageSnapshot(): VisitorChatUsage[] {
  return [...usages.values()];
}

export function importChatUsageSnapshot(rows: VisitorChatUsage[]): void {
  usages.clear();
  for (const row of rows.slice(-MAX_USAGE_ENTRIES)) {
    if (!row?.visitorKey) continue;
    usages.set(row.visitorKey, {
      visitorKey: row.visitorKey,
      windowStartedAtMs: Number(row.windowStartedAtMs) || Date.now(),
      questions: Number(row.questions) || 0,
      llmCalls: Number(row.llmCalls) || 0,
      liveSessions: Number(row.liveSessions) || 0,
      voiceTurns: Number(row.voiceTurns) || 0,
      voiceRealtimeSessions: Number(row.voiceRealtimeSessions) || 0,
      voiceRealtimeMinutes: Number(row.voiceRealtimeMinutes) || 0,
    });
  }
}

export function buildVisitorKey(input: {
  ipAddress: string;
  visitorId?: string;
  email?: string;
}): string {
  const ip = (input.ipAddress || 'unknown').slice(0, 64);
  const email = (input.email || '').trim().toLowerCase().slice(0, 254);
  // Client-supplied visitorId is intentionally ignored for quota keys (spoofable).
  // Prefer verified email after OTP; otherwise fall back to IP only.
  void input.visitorId;
  const material = email ? `email:${email}` : `ip:${ip}`;
  return crypto.createHash('sha256').update(material).digest('hex').slice(0, 32);
}

function windowMs(policy: ChatLimitPolicy): number {
  return Math.max(1, policy.rateWindowHours) * 60 * 60 * 1000;
}

function freshUsage(visitorKey: string, now: number): VisitorChatUsage {
  return {
    visitorKey,
    windowStartedAtMs: now,
    questions: 0,
    llmCalls: 0,
    liveSessions: 0,
    voiceTurns: 0,
    voiceRealtimeSessions: 0,
    voiceRealtimeMinutes: 0,
  };
}

function ensureUsage(visitorKey: string, policy: ChatLimitPolicy, now: number): VisitorChatUsage {
  const existing = usages.get(visitorKey);
  const span = windowMs(policy);
  if (!existing || now - existing.windowStartedAtMs >= span) {
    const next = freshUsage(visitorKey, now);
    usages.set(visitorKey, next);
    if (usages.size > MAX_USAGE_ENTRIES) {
      const oldest = [...usages.entries()].sort(
        (a, b) => a[1].windowStartedAtMs - b[1].windowStartedAtMs
      )[0];
      if (oldest) usages.delete(oldest[0]);
    }
    return next;
  }
  return existing;
}

function remainingFor(
  kind: ChatLimitKind,
  usage: VisitorChatUsage,
  policy: ChatLimitPolicy
): number {
  if (kind === 'question') return Math.max(0, policy.maxQuestionsPerVisitor - usage.questions);
  if (kind === 'llm') return Math.max(0, policy.maxLlmPerVisitor - usage.llmCalls);
  if (kind === 'voice') {
    return Math.max(0, policy.maxVoiceTurnsPerVisitor - (usage.voiceTurns || 0));
  }
  if (kind === 'voiceRealtimeSession') {
    return Math.max(
      0,
      policy.maxVoiceRealtimeSessionsPerVisitor - (usage.voiceRealtimeSessions || 0)
    );
  }
  if (kind === 'voiceRealtimeMinute') {
    return Math.max(
      0,
      policy.maxVoiceRealtimeMinutesPerVisitor - (usage.voiceRealtimeMinutes || 0)
    );
  }
  return Math.max(0, policy.maxLiveSessionsPerVisitor - usage.liveSessions);
}

function limitLabel(kind: ChatLimitKind): string {
  if (kind === 'question') return 'questions';
  if (kind === 'llm') return 'LLM answers';
  if (kind === 'voice') return 'push-to-talk voice turns';
  if (kind === 'voiceRealtimeSession') return 'live speech-to-speech sessions';
  if (kind === 'voiceRealtimeMinute') return 'live speech-to-speech minutes';
  return 'live chat sessions';
}

function redisKind(kind: ChatLimitKind): string {
  if (kind === 'voiceRealtimeSession') return 'voiceRtSess';
  if (kind === 'voiceRealtimeMinute') return 'voiceRtMin';
  return kind;
}

export function checkChatLimit(
  visitorKey: string,
  kind: ChatLimitKind,
  policy: ChatLimitPolicy,
  now = Date.now(),
  amount = 1
): ChatLimitDecision {
  const usage = ensureUsage(visitorKey, policy, now);
  const need = Math.max(1, Math.floor(amount));
  const remaining = remainingFor(kind, usage, policy);
  const resetAtMs = usage.windowStartedAtMs + windowMs(policy);
  if (remaining < need) {
    const label = limitLabel(kind);
    return {
      allowed: false,
      reason: `Per-visitor ${label} limit reached for this window. Try again later or contact Mohammed directly.`,
      remaining: Math.max(0, remaining),
      usage: { ...usage },
      resetAtMs,
    };
  }
  return { allowed: true, remaining, usage: { ...usage }, resetAtMs };
}

export function consumeChatLimit(
  visitorKey: string,
  kind: ChatLimitKind,
  policy: ChatLimitPolicy,
  now = Date.now(),
  amount = 1
): ChatLimitDecision {
  const need = Math.max(1, Math.floor(amount));
  const decision = checkChatLimit(visitorKey, kind, policy, now, need);
  if (!decision.allowed) return decision;
  const usage = ensureUsage(visitorKey, policy, now);
  if (kind === 'question') usage.questions += need;
  if (kind === 'llm') usage.llmCalls += need;
  if (kind === 'live') usage.liveSessions += need;
  if (kind === 'voice') usage.voiceTurns = (usage.voiceTurns || 0) + need;
  if (kind === 'voiceRealtimeSession') {
    usage.voiceRealtimeSessions = (usage.voiceRealtimeSessions || 0) + need;
  }
  if (kind === 'voiceRealtimeMinute') {
    usage.voiceRealtimeMinutes = (usage.voiceRealtimeMinutes || 0) + need;
  }
  usages.set(visitorKey, usage);
  return {
    allowed: true,
    remaining: remainingFor(kind, usage, policy),
    usage: { ...usage },
    resetAtMs: usage.windowStartedAtMs + windowMs(policy),
  };
}

function maxFor(kind: ChatLimitKind, policy: ChatLimitPolicy): number {
  if (kind === 'question') return policy.maxQuestionsPerVisitor;
  if (kind === 'llm') return policy.maxLlmPerVisitor;
  if (kind === 'voice') return policy.maxVoiceTurnsPerVisitor;
  if (kind === 'voiceRealtimeSession') return policy.maxVoiceRealtimeSessionsPerVisitor;
  if (kind === 'voiceRealtimeMinute') return policy.maxVoiceRealtimeMinutesPerVisitor;
  return policy.maxLiveSessionsPerVisitor;
}

function usageFromCounts(
  visitorKey: string,
  counts: {
    questions: number;
    llmCalls: number;
    liveSessions: number;
    voiceTurns: number;
    voiceRealtimeSessions: number;
    voiceRealtimeMinutes: number;
  },
  windowStartedAtMs: number
): VisitorChatUsage {
  return {
    visitorKey,
    windowStartedAtMs,
    questions: counts.questions,
    llmCalls: counts.llmCalls,
    liveSessions: counts.liveSessions,
    voiceTurns: counts.voiceTurns,
    voiceRealtimeSessions: counts.voiceRealtimeSessions,
    voiceRealtimeMinutes: counts.voiceRealtimeMinutes,
  };
}

function countsForKind(
  kind: ChatLimitKind,
  count: number
): {
  questions: number;
  llmCalls: number;
  liveSessions: number;
  voiceTurns: number;
  voiceRealtimeSessions: number;
  voiceRealtimeMinutes: number;
} {
  return {
    questions: kind === 'question' ? count : 0,
    llmCalls: kind === 'llm' ? count : 0,
    liveSessions: kind === 'live' ? count : 0,
    voiceTurns: kind === 'voice' ? count : 0,
    voiceRealtimeSessions: kind === 'voiceRealtimeSession' ? count : 0,
    voiceRealtimeMinutes: kind === 'voiceRealtimeMinute' ? count : 0,
  };
}

/**
 * Check chat limit using Redis when configured (shared across replicas).
 * Falls back to in-memory when Redis is unset. Fail-closed on Redis errors.
 */
export async function checkChatLimitAsync(
  visitorKey: string,
  kind: ChatLimitKind,
  policy: ChatLimitPolicy,
  now = Date.now(),
  amount = 1
): Promise<ChatLimitDecision> {
  if (!isDistributedStoreEnabled()) {
    return checkChatLimit(visitorKey, kind, policy, now, amount);
  }

  const need = Math.max(1, Math.floor(amount));
  const span = windowMs(policy);
  const peek = await peekDistributedChatQuota(visitorKey, redisKind(kind), span);
  const max = maxFor(kind, policy);
  const windowStartedAtMs = now + peek.ttlMs - span;
  const usage = usageFromCounts(visitorKey, countsForKind(kind, peek.count), windowStartedAtMs);
  const resetAtMs = now + Math.max(0, peek.ttlMs);
  const remaining = Math.max(0, max - peek.count);

  if (peek.error || remaining < need) {
    const label = limitLabel(kind);
    return {
      allowed: false,
      reason: peek.error
        ? 'Chat quota service temporarily unavailable. Try again shortly.'
        : `Per-visitor ${label} limit reached for this window. Try again later or contact Mohammed directly.`,
      remaining: peek.error ? 0 : remaining,
      usage,
      resetAtMs,
    };
  }

  return {
    allowed: true,
    remaining,
    usage,
    resetAtMs,
  };
}

/**
 * Consume chat limit using Redis when configured. Also updates local memory
 * for owner dashboard aggregates on this replica.
 */
export async function consumeChatLimitAsync(
  visitorKey: string,
  kind: ChatLimitKind,
  policy: ChatLimitPolicy,
  now = Date.now(),
  amount = 1
): Promise<ChatLimitDecision> {
  if (!isDistributedStoreEnabled()) {
    return consumeChatLimit(visitorKey, kind, policy, now, amount);
  }

  const need = Math.max(1, Math.floor(amount));
  const span = windowMs(policy);
  const max = maxFor(kind, policy);
  const incr = await incrDistributedChatQuota(visitorKey, redisKind(kind), span, need);
  const windowStartedAtMs = now + incr.ttlMs - span;
  const usage = usageFromCounts(visitorKey, countsForKind(kind, incr.count), windowStartedAtMs);
  const resetAtMs = now + Math.max(0, incr.ttlMs);

  // Mirror into local memory for approximate owner totals on this replica.
  if (!incr.error) {
    const local = ensureUsage(visitorKey, policy, now);
    if (kind === 'question') local.questions = Math.max(local.questions, incr.count);
    if (kind === 'llm') local.llmCalls = Math.max(local.llmCalls, incr.count);
    if (kind === 'live') local.liveSessions = Math.max(local.liveSessions, incr.count);
    if (kind === 'voice') local.voiceTurns = Math.max(local.voiceTurns || 0, incr.count);
    if (kind === 'voiceRealtimeSession') {
      local.voiceRealtimeSessions = Math.max(local.voiceRealtimeSessions || 0, incr.count);
    }
    if (kind === 'voiceRealtimeMinute') {
      local.voiceRealtimeMinutes = Math.max(local.voiceRealtimeMinutes || 0, incr.count);
    }
    usages.set(visitorKey, local);
  }

  if (incr.error || incr.count > max) {
    const label = limitLabel(kind);
    return {
      allowed: false,
      reason: incr.error
        ? 'Chat quota service temporarily unavailable. Try again shortly.'
        : `Per-visitor ${label} limit reached for this window. Try again later or contact Mohammed directly.`,
      remaining: 0,
      usage,
      resetAtMs,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, max - incr.count),
    usage,
    resetAtMs,
  };
}

/** Minutes to grant for one live S2S connection (prepaid against the visitor budget). */
export function planVoiceRealtimeSessionMinutes(
  remainingMinutes: number,
  policy: ChatLimitPolicy
): number {
  const budget = Math.max(0, Math.floor(remainingMinutes));
  if (budget < 1) return 0;
  const policyCap = Math.max(1, policy.maxVoiceRealtimeMinutesPerVisitor);
  return Math.min(budget, policyCap, MAX_VOICE_REALTIME_SESSION_MINUTES);
}

export function getChatUsageTotals(): {
  trackedVisitors: number;
  questions: number;
  llmCalls: number;
  liveSessions: number;
  voiceTurns: number;
  voiceRealtimeSessions: number;
  voiceRealtimeMinutes: number;
} {
  let questions = 0;
  let llmCalls = 0;
  let liveSessions = 0;
  let voiceTurns = 0;
  let voiceRealtimeSessions = 0;
  let voiceRealtimeMinutes = 0;
  for (const row of usages.values()) {
    questions += row.questions;
    llmCalls += row.llmCalls;
    liveSessions += row.liveSessions;
    voiceTurns += row.voiceTurns || 0;
    voiceRealtimeSessions += row.voiceRealtimeSessions || 0;
    voiceRealtimeMinutes += row.voiceRealtimeMinutes || 0;
  }
  return {
    trackedVisitors: usages.size,
    questions,
    llmCalls,
    liveSessions,
    voiceTurns,
    voiceRealtimeSessions,
    voiceRealtimeMinutes,
  };
}
