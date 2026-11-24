/**
 * Chat session store with disk cache + optional Redis write-through for multi-replica.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  exportChatUsageSnapshot,
  importChatUsageSnapshot,
} from './chatLimits.ts';
import {
  isDistributedStoreEnabled,
  redisGetJson,
  redisSetJson,
} from './distributedStore.ts';
import { VERIFIED_SESSION_TTL_MS } from './sessionPolicy.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, '..', '.owner-chat-cache.json');

export type ChatMessageRole = 'visitor' | 'owner' | 'system' | 'bot';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  text: string;
  createdAtMs: number;
}

export interface ChatSession {
  sessionId: string;
  visitorName: string;
  visitorEmail: string;
  company: string;
  interest: string;
  status: 'queued' | 'active' | 'closed';
  createdAtMs: number;
  updatedAtMs: number;
  lastVisitorAtMs: number;
  lastOwnerAtMs: number;
  /** Visitor-visible thread start; earlier messages stay for the owner console. */
  threadStartedAtMs: number;
  messages: ChatMessage[];
  ipAddress: string;
  userAgent: string;
}

interface ChatCacheFile {
  sessions: ChatSession[];
  ownerPresenceAtMs: number;
  botQuestions: number;
  liveRequests: number;
  liveSessions: number;
  llmCalls: number;
  llmFallbacks: number;
  /** Lifetime push-to-talk turns (server process / cache). */
  voiceTurns: number;
  /** Lifetime live S2S sessions started. */
  voiceRealtimeSessions: number;
  /** Lifetime prepaid live S2S minutes granted. */
  voiceRealtimeMinutes: number;
  usages?: Array<{
    visitorKey: string;
    windowStartedAtMs: number;
    questions: number;
    llmCalls: number;
    liveSessions: number;
    voiceTurns: number;
    voiceRealtimeSessions?: number;
    voiceRealtimeMinutes?: number;
  }>;
}

const MAX_SESSIONS = 200;
const MAX_MESSAGES = 80;
const PRESENCE_ONLINE_MS = 90_000;

let ownerPresenceAtMs = 0;
let botQuestions = 0;
let liveRequests = 0;
let liveSessions = 0;
let llmCalls = 0;
let llmFallbacks = 0;
let voiceTurns = 0;
let voiceRealtimeSessions = 0;
let voiceRealtimeMinutes = 0;
const sessions = new Map<string, ChatSession>();

function loadCache(): void {
  try {
    if (!fs.existsSync(CACHE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Partial<ChatCacheFile>;
    ownerPresenceAtMs = Number(parsed.ownerPresenceAtMs) || 0;
    botQuestions = Number(parsed.botQuestions) || 0;
    liveRequests = Number(parsed.liveRequests) || 0;
    liveSessions = Number(parsed.liveSessions) || 0;
    llmCalls = Number(parsed.llmCalls) || 0;
    llmFallbacks = Number(parsed.llmFallbacks) || 0;
    voiceTurns = Number(parsed.voiceTurns) || 0;
    voiceRealtimeSessions = Number(parsed.voiceRealtimeSessions) || 0;
    voiceRealtimeMinutes = Number(parsed.voiceRealtimeMinutes) || 0;
    if (Array.isArray(parsed.sessions)) {
      for (const s of parsed.sessions.slice(-MAX_SESSIONS)) {
        if (!s?.sessionId) continue;
        sessions.set(s.sessionId, {
          ...s,
          company: typeof s.company === 'string' ? s.company : '',
          interest: typeof s.interest === 'string' ? s.interest : '',
          threadStartedAtMs:
            typeof s.threadStartedAtMs === 'number' && s.threadStartedAtMs > 0
              ? s.threadStartedAtMs
              : s.createdAtMs || 0,
        });
      }
    }
    if (Array.isArray(parsed.usages)) {
      importChatUsageSnapshot(
        parsed.usages.map((row) => ({
          ...row,
          voiceTurns: Number(row.voiceTurns) || 0,
          voiceRealtimeSessions: Number(row.voiceRealtimeSessions) || 0,
          voiceRealtimeMinutes: Number(row.voiceRealtimeMinutes) || 0,
        }))
      );
    }
  } catch {
    /* ignore */
  }
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      const payload: ChatCacheFile = {
        sessions: [...sessions.values()]
          .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
          .slice(0, MAX_SESSIONS),
        ownerPresenceAtMs,
        botQuestions,
        liveRequests,
        liveSessions,
        llmCalls,
        llmFallbacks,
        voiceTurns,
        voiceRealtimeSessions,
        voiceRealtimeMinutes,
        usages: exportChatUsageSnapshot(),
      };
      fs.writeFileSync(CACHE_PATH, JSON.stringify(payload), 'utf8');
    } catch {
      /* non-fatal */
    }
  }, 1500);
}

loadCache();

const CHAT_SESSION_TTL_MS = VERIFIED_SESSION_TTL_MS;

function chatRedisKey(sessionId: string): string {
  return `chatsess:${sessionId.slice(0, 64)}`;
}

function mirrorSession(session: ChatSession): void {
  if (!isDistributedStoreEnabled()) return;
  void redisSetJson(chatRedisKey(session.sessionId), session, CHAT_SESSION_TTL_MS);
}

export function bumpBotQuestion(): void {
  botQuestions += 1;
  scheduleFlush();
}

export function bumpVoiceTurn(): void {
  voiceTurns += 1;
  scheduleFlush();
}

export function bumpVoiceRealtimeSession(minutesGranted = 0): void {
  voiceRealtimeSessions += 1;
  voiceRealtimeMinutes += Math.max(0, Math.floor(minutesGranted));
  scheduleFlush();
}

export function bumpLiveRequest(): void {
  liveRequests += 1;
  scheduleFlush();
}

export function bumpLlmCall(success: boolean): void {
  if (success) llmCalls += 1;
  else llmFallbacks += 1;
  scheduleFlush();
}

export function touchOwnerPresence(now = Date.now()): void {
  ownerPresenceAtMs = now;
  scheduleFlush();
}

/** Explicit offline (logout / console close) — do not wait for presence TTL. */
export function clearOwnerPresence(): void {
  ownerPresenceAtMs = 0;
  scheduleFlush();
}

export function isOwnerOnline(now = Date.now()): boolean {
  return ownerPresenceAtMs > 0 && now - ownerPresenceAtMs <= PRESENCE_ONLINE_MS;
}

export function getChatStats() {
  const open = [...sessions.values()].filter((s) => s.status !== 'closed');
  return {
    botQuestions,
    liveRequests,
    liveSessions,
    llmCalls,
    llmFallbacks,
    voiceTurns,
    voiceRealtimeSessions,
    voiceRealtimeMinutes,
    openSessions: open.length,
    queuedSessions: open.filter((s) => s.status === 'queued').length,
    activeSessions: open.filter((s) => s.status === 'active').length,
    ownerOnline: isOwnerOnline(),
    ownerPresenceAtMs,
  };
}

export function createChatSession(input: {
  visitorName: string;
  visitorEmail: string;
  ipAddress: string;
  userAgent: string;
  openingMessage?: string;
  company?: string;
  interest?: string;
}): ChatSession {
  const now = Date.now();
  const sessionId = `CHAT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const visitorName = input.visitorName.slice(0, 120);
  const company = (input.company || '').trim().slice(0, 120);
  const interest = (input.interest || '').trim().slice(0, 160);
  const messages: ChatMessage[] = [
    {
      id: `m-${crypto.randomBytes(4).toString('hex')}`,
      role: 'system',
      text: `Welcome, ${visitorName}! You’re verified. Ask about experience, skills, certifications, or contact — or leave a note for Mohammed.`,
      createdAtMs: now,
    },
    {
      id: `m-${crypto.randomBytes(4).toString('hex')}`,
      role: 'bot',
      text: isOwnerOnline(now)
        ? 'Mohammed appears online and may reply live. Meanwhile I can answer portfolio questions concisely.'
        : 'Mohammed is offline right now — your chat is queued in the Owner Console. I can still answer portfolio questions.',
      createdAtMs: now,
    },
  ];
  if (input.openingMessage?.trim()) {
    messages.push({
      id: `m-${crypto.randomBytes(4).toString('hex')}`,
      role: 'visitor',
      text: input.openingMessage.trim().slice(0, 2000),
      createdAtMs: now,
    });
  }
  const session: ChatSession = {
    sessionId,
    visitorName,
    visitorEmail: input.visitorEmail.slice(0, 254).toLowerCase(),
    company,
    interest,
    status: isOwnerOnline(now) ? 'active' : 'queued',
    createdAtMs: now,
    updatedAtMs: now,
    lastVisitorAtMs: now,
    lastOwnerAtMs: 0,
    threadStartedAtMs: now,
    messages,
    ipAddress: input.ipAddress.slice(0, 64),
    userAgent: input.userAgent.slice(0, 220),
  };
  sessions.set(sessionId, session);
  liveSessions += 1;
  scheduleFlush();
  mirrorSession(session);
  return session;
}

export function getChatSession(sessionId: string): ChatSession | null {
  return sessions.get(sessionId) || null;
}

/** Prefer local memory; fall back to Redis when another replica owns the session. */
export async function getChatSessionAsync(sessionId: string): Promise<ChatSession | null> {
  const local = sessions.get(sessionId);
  if (local) return local;
  if (!isDistributedStoreEnabled()) return null;
  const remote = await redisGetJson<ChatSession>(chatRedisKey(sessionId));
  if (remote.error || !remote.value?.sessionId) return null;
  sessions.set(sessionId, remote.value);
  return remote.value;
}

export function listChatSessions(): ChatSession[] {
  return [...sessions.values()].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export function appendChatMessage(
  sessionId: string,
  role: Exclude<ChatMessageRole, 'system'>,
  text: string
): ChatSession | null {
  const session = sessions.get(sessionId);
  if (!session || session.status === 'closed') return null;
  const now = Date.now();
  const clean = text.trim().slice(0, 2000);
  if (clean.length < 1) return null;
  session.messages.push({
    id: `m-${crypto.randomBytes(4).toString('hex')}`,
    role,
    text: clean,
    createdAtMs: now,
  });
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
  session.updatedAtMs = now;
  if (role === 'visitor') session.lastVisitorAtMs = now;
  if (role === 'owner') {
    session.lastOwnerAtMs = now;
    session.status = 'active';
  }
  scheduleFlush();
  mirrorSession(session);
  return session;
}

export function closeChatSession(sessionId: string): ChatSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.status = 'closed';
  session.updatedAtMs = Date.now();
  session.messages.push({
    id: `m-${crypto.randomBytes(4).toString('hex')}`,
    role: 'system',
    text: 'This live chat session was closed by the portfolio owner.',
    createdAtMs: session.updatedAtMs,
  });
  scheduleFlush();
  mirrorSession(session);
  return session;
}

/**
 * Start a fresh visitor thread without closing verification.
 * Prior messages remain on the session for the owner console.
 */
export function startNewChatThread(sessionId: string): ChatSession | null {
  const session = sessions.get(sessionId);
  if (!session || session.status === 'closed') return null;
  const lastAt = session.messages.at(-1)?.createdAtMs || 0;
  // Ensure the new thread starts strictly after prior messages (same-ms Date.now() is common in tests).
  const now = Math.max(Date.now(), lastAt + 1);
  const firstName = session.visitorName.split(/\s+/)[0] || 'there';
  session.threadStartedAtMs = now;
  session.updatedAtMs = now;
  session.lastVisitorAtMs = now;
  session.messages.push({
    id: `m-${crypto.randomBytes(4).toString('hex')}`,
    role: 'system',
    text: 'New chat started.',
    createdAtMs: now,
  });
  session.messages.push({
    id: `m-${crypto.randomBytes(4).toString('hex')}`,
    role: 'bot',
    text: `Hi ${firstName} — fresh thread. Ask about experience, skills, certifications, or contact — or leave a note for Mohammed with @mohammed.`,
    createdAtMs: now,
  });
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
  scheduleFlush();
  mirrorSession(session);
  return session;
}

export function publicSessionView(
  session: ChatSession,
  options?: { threadOnly?: boolean }
) {
  const threadStart =
    typeof session.threadStartedAtMs === 'number' && session.threadStartedAtMs > 0
      ? session.threadStartedAtMs
      : session.createdAtMs;
  const sourceMessages = options?.threadOnly
    ? session.messages.filter((m) => m.createdAtMs >= threadStart)
    : session.messages;
  return {
    sessionId: session.sessionId,
    status: session.status,
    visitorName: session.visitorName,
    visitorEmail: session.visitorEmail,
    company: session.company || '',
    interest: session.interest || '',
    createdAtMs: session.createdAtMs,
    updatedAtMs: session.updatedAtMs,
    threadStartedAtMs: threadStart,
    messages: sourceMessages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      createdAtMs: m.createdAtMs,
    })),
  };
}
