/**
 * Chat session store with disk + Redis + Firestore durability.
 * Cloud Run disk is ephemeral; Redis is the hot cache; Firestore is the durable backup.
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
import {
  adminLoadChatCacheSnapshot,
  adminSaveChatCacheSnapshot,
  isFirebaseAdminConfigured,
} from './firebaseAdmin.ts';
import { VERIFIED_SESSION_TTL_MS } from './sessionPolicy.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, '..', '.owner-chat-cache.json');
/** Hot Redis snapshot (no TTL) — survives replica hops when Upstash is configured. */
const CHAT_CACHE_REDIS_KEY = 'owner:chat-cache';
/** Cap Firestore payload size (1 MiB doc limit). */
const FIRESTORE_MAX_SESSIONS = 100;
const FIRESTORE_MAX_MESSAGES = 40;

export type ChatMessageRole = 'visitor' | 'owner' | 'system' | 'bot';
/** How the utterance entered the thread (defaults to text when omitted). */
export type ChatMessageChannel = 'text' | 'ptt' | 's2s';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  text: string;
  createdAtMs: number;
  channel?: ChatMessageChannel;
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

function applyCachePayload(parsed: Partial<ChatCacheFile>, options?: { merge?: boolean }): void {
  const merge = Boolean(options?.merge);
  if (!merge) {
    sessions.clear();
  }
  ownerPresenceAtMs = Math.max(ownerPresenceAtMs, Number(parsed.ownerPresenceAtMs) || 0);
  botQuestions = Math.max(botQuestions, Number(parsed.botQuestions) || 0);
  liveRequests = Math.max(liveRequests, Number(parsed.liveRequests) || 0);
  liveSessions = Math.max(liveSessions, Number(parsed.liveSessions) || 0);
  llmCalls = Math.max(llmCalls, Number(parsed.llmCalls) || 0);
  llmFallbacks = Math.max(llmFallbacks, Number(parsed.llmFallbacks) || 0);
  voiceTurns = Math.max(voiceTurns, Number(parsed.voiceTurns) || 0);
  voiceRealtimeSessions = Math.max(
    voiceRealtimeSessions,
    Number(parsed.voiceRealtimeSessions) || 0
  );
  voiceRealtimeMinutes = Math.max(
    voiceRealtimeMinutes,
    Number(parsed.voiceRealtimeMinutes) || 0
  );
  if (Array.isArray(parsed.sessions)) {
    for (const s of parsed.sessions.slice(-MAX_SESSIONS)) {
      if (!s?.sessionId) continue;
      const existing = sessions.get(s.sessionId);
      if (existing && existing.updatedAtMs >= (Number(s.updatedAtMs) || 0)) continue;
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
}

function buildCachePayload(): ChatCacheFile {
  return {
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
}

/** Smaller snapshot for Firestore 1 MiB doc limit. */
function buildFirestoreCachePayload(): ChatCacheFile {
  const full = buildCachePayload();
  return {
    ...full,
    sessions: full.sessions.slice(0, FIRESTORE_MAX_SESSIONS).map((s) => ({
      ...s,
      messages: s.messages.slice(-FIRESTORE_MAX_MESSAGES),
    })),
  };
}

function loadCache(): void {
  try {
    if (!fs.existsSync(CACHE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Partial<ChatCacheFile>;
    applyCachePayload(parsed);
  } catch {
    /* ignore */
  }
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hydratePromise: Promise<boolean> | null = null;
let didDurableHydrate = false;

async function mergeRemoteChatIntoMemory(): Promise<void> {
  if (isDistributedStoreEnabled()) {
    const remote = await redisGetJson<Partial<ChatCacheFile>>(CHAT_CACHE_REDIS_KEY);
    if (!remote.error && remote.value) {
      applyCachePayload(remote.value, { merge: true });
    }
  }
  if (isFirebaseAdminConfigured()) {
    const fromFs = await adminLoadChatCacheSnapshot();
    if (fromFs) {
      applyCachePayload(fromFs as Partial<ChatCacheFile>, { merge: true });
    }
  }
}

function persistCacheNow(): void {
  void (async () => {
    try {
      await mergeRemoteChatIntoMemory();
      const payload = buildCachePayload();
      fs.writeFileSync(CACHE_PATH, JSON.stringify(payload), 'utf8');
      if (isDistributedStoreEnabled()) {
        await redisSetJson(CHAT_CACHE_REDIS_KEY, payload);
      }
      if (isFirebaseAdminConfigured()) {
        await adminSaveChatCacheSnapshot(
          buildFirestoreCachePayload() as unknown as Record<string, unknown>
        );
      }
    } catch {
      try {
        fs.writeFileSync(CACHE_PATH, JSON.stringify(buildCachePayload()), 'utf8');
      } catch {
        /* ignore */
      }
    }
  })();
}

async function persistCacheDurable(): Promise<void> {
  await mergeRemoteChatIntoMemory();
  const payload = buildCachePayload();
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(payload), 'utf8');
  } catch {
    /* ignore disk */
  }
  if (isDistributedStoreEnabled()) {
    await redisSetJson(CHAT_CACHE_REDIS_KEY, payload);
  }
  if (isFirebaseAdminConfigured()) {
    await adminSaveChatCacheSnapshot(buildFirestoreCachePayload() as unknown as Record<string, unknown>);
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    persistCacheNow();
  }, 400);
}

/** Immediate durable flush (session create/close/reply, process shutdown). */
export function flushChatCacheSync(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  persistCacheNow();
}

/** Await Redis + Firestore write (preferred on create/close/reply). */
export async function flushChatCacheDurable(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await persistCacheDurable();
}

loadCache();

/**
 * Rehydrate sessions/stats from Redis, then Firestore (Cloud Run cold start / new revision).
 * Safe to call often; no-ops after a successful durable hydrate unless local map is empty.
 */
export async function ensureChatCacheHydrated(): Promise<boolean> {
  if (didDurableHydrate && sessions.size > 0) return true;
  if (!isDistributedStoreEnabled() && !isFirebaseAdminConfigured()) {
    didDurableHydrate = true;
    return sessions.size > 0;
  }
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        if (isDistributedStoreEnabled()) {
          const remote = await redisGetJson<Partial<ChatCacheFile>>(CHAT_CACHE_REDIS_KEY);
          if (!remote.error && remote.value) {
            applyCachePayload(remote.value, { merge: true });
          }
        }
        // Firestore is the durable backup when Redis was empty or never written.
        if (isFirebaseAdminConfigured()) {
          const fromFs = await adminLoadChatCacheSnapshot();
          if (fromFs) {
            applyCachePayload(fromFs as Partial<ChatCacheFile>, { merge: true });
          }
        }
        didDurableHydrate = true;
        // Warm disk + Redis from the merged durable state.
        persistCacheNow();
        return sessions.size > 0 || botQuestions > 0 || liveSessions > 0;
      } catch {
        didDurableHydrate = true;
        return sessions.size > 0;
      } finally {
        hydratePromise = null;
      }
    })();
  }
  return hydratePromise;
}

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

function normalizeChannel(channel?: ChatMessageChannel): ChatMessageChannel | undefined {
  if (channel === 'ptt' || channel === 's2s' || channel === 'text') return channel;
  return undefined;
}

function pushSessionMessage(
  session: ChatSession,
  role: ChatMessageRole,
  text: string,
  channel?: ChatMessageChannel
): boolean {
  const now = Date.now();
  const clean = text.trim().slice(0, 2000);
  if (clean.length < 1) return false;

  const normalized = normalizeChannel(channel);
  const last = session.messages.at(-1);
  // Dedupe rapid identical voice captions (client transcript + tool echo).
  if (
    last &&
    last.role === role &&
    last.text === clean &&
    (last.channel || 'text') === (normalized || 'text') &&
    now - last.createdAtMs < 2500
  ) {
    return false;
  }

  const message: ChatMessage = {
    id: `m-${crypto.randomBytes(4).toString('hex')}`,
    role,
    text: clean,
    createdAtMs: now,
  };
  if (normalized && normalized !== 'text') {
    message.channel = normalized;
  }
  session.messages.push(message);
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
  session.updatedAtMs = now;
  if (role === 'visitor') session.lastVisitorAtMs = now;
  if (role === 'owner') {
    session.lastOwnerAtMs = now;
    session.status = 'active';
  }
  return true;
}

export function appendChatMessage(
  sessionId: string,
  role: Exclude<ChatMessageRole, 'system'>,
  text: string,
  options?: { channel?: ChatMessageChannel }
): ChatSession | null {
  const session = sessions.get(sessionId);
  if (!session || session.status === 'closed') return null;
  if (text.trim().length < 1) return null;
  // false = deduped identical caption; still a successful no-op for the caller.
  pushSessionMessage(session, role, text, options?.channel);
  scheduleFlush();
  mirrorSession(session);
  return session;
}

/** System notice (e.g. Live S2S started) — visible in owner + visitor threads. */
export function appendChatSystemNotice(
  sessionId: string,
  text: string,
  options?: { channel?: ChatMessageChannel }
): ChatSession | null {
  const session = sessions.get(sessionId);
  if (!session || session.status === 'closed') return null;
  if (text.trim().length < 1) return null;
  pushSessionMessage(session, 'system', text, options?.channel);
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
      ...(m.channel && m.channel !== 'text' ? { channel: m.channel } : {}),
    })),
  };
}
