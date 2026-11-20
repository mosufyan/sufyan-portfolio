/**
 * Per-visitor chat usage counters for bot Q&A, Cursor LLM, and live sessions.
 */
import crypto from 'crypto';

export interface VisitorChatUsage {
  visitorKey: string;
  windowStartedAtMs: number;
  questions: number;
  llmCalls: number;
  liveSessions: number;
}

export interface ChatLimitPolicy {
  maxQuestionsPerVisitor: number;
  maxLlmPerVisitor: number;
  maxLiveSessionsPerVisitor: number;
  rateWindowHours: number;
}

export type ChatLimitKind = 'question' | 'llm' | 'live';

export interface ChatLimitDecision {
  allowed: boolean;
  reason?: string;
  remaining: number;
  usage: VisitorChatUsage;
  resetAtMs: number;
}

const MAX_USAGE_ENTRIES = 5_000;
const usages = new Map<string, VisitorChatUsage>();

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

function ensureUsage(visitorKey: string, policy: ChatLimitPolicy, now: number): VisitorChatUsage {
  const existing = usages.get(visitorKey);
  const span = windowMs(policy);
  if (!existing || now - existing.windowStartedAtMs >= span) {
    const fresh: VisitorChatUsage = {
      visitorKey,
      windowStartedAtMs: now,
      questions: 0,
      llmCalls: 0,
      liveSessions: 0,
    };
    usages.set(visitorKey, fresh);
    if (usages.size > MAX_USAGE_ENTRIES) {
      const oldest = [...usages.entries()].sort(
        (a, b) => a[1].windowStartedAtMs - b[1].windowStartedAtMs
      )[0];
      if (oldest) usages.delete(oldest[0]);
    }
    return fresh;
  }
  return existing;
}

function remainingFor(kind: ChatLimitKind, usage: VisitorChatUsage, policy: ChatLimitPolicy): number {
  if (kind === 'question') return Math.max(0, policy.maxQuestionsPerVisitor - usage.questions);
  if (kind === 'llm') return Math.max(0, policy.maxLlmPerVisitor - usage.llmCalls);
  return Math.max(0, policy.maxLiveSessionsPerVisitor - usage.liveSessions);
}

export function checkChatLimit(
  visitorKey: string,
  kind: ChatLimitKind,
  policy: ChatLimitPolicy,
  now = Date.now()
): ChatLimitDecision {
  const usage = ensureUsage(visitorKey, policy, now);
  const remaining = remainingFor(kind, usage, policy);
  const resetAtMs = usage.windowStartedAtMs + windowMs(policy);
  if (remaining <= 0) {
    const label =
      kind === 'question' ? 'questions' : kind === 'llm' ? 'LLM answers' : 'live chat sessions';
    return {
      allowed: false,
      reason: `Per-visitor ${label} limit reached for this window. Try again later or contact Mohammed directly.`,
      remaining: 0,
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
  now = Date.now()
): ChatLimitDecision {
  const decision = checkChatLimit(visitorKey, kind, policy, now);
  if (!decision.allowed) return decision;
  const usage = ensureUsage(visitorKey, policy, now);
  if (kind === 'question') usage.questions += 1;
  if (kind === 'llm') usage.llmCalls += 1;
  if (kind === 'live') usage.liveSessions += 1;
  usages.set(visitorKey, usage);
  return {
    allowed: true,
    remaining: remainingFor(kind, usage, policy),
    usage: { ...usage },
    resetAtMs: usage.windowStartedAtMs + windowMs(policy),
  };
}

export function getChatUsageTotals(): {
  trackedVisitors: number;
  questions: number;
  llmCalls: number;
  liveSessions: number;
} {
  let questions = 0;
  let llmCalls = 0;
  let liveSessions = 0;
  for (const row of usages.values()) {
    questions += row.questions;
    llmCalls += row.llmCalls;
    liveSessions += row.liveSessions;
  }
  return { trackedVisitors: usages.size, questions, llmCalls, liveSessions };
}
