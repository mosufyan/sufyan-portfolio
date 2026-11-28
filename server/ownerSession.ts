/**
 * Owner console session metadata (idle tracking) keyed by Firebase session cookie hash.
 * Memory fallback when Upstash Redis is unset; Redis when configured for multi-instance.
 */
import crypto from 'crypto';
import { redisDel, redisGetJson, redisSetJson } from './distributedStore.ts';
import {
  OWNER_SESSION_ABSOLUTE_TTL_MS,
  OWNER_SESSION_COOKIE_NAME,
  evaluateOwnerSessionTiming,
  type OwnerSessionTimingResult,
} from './ownerSessionPolicy.ts';

export interface OwnerSessionMeta {
  sid: string;
  uid: string;
  email: string;
  role: 'owner' | 'delegate';
  issuedAt: number;
  lastActivityAt: number;
}

const memorySessions = new Map<string, OwnerSessionMeta>();

function redisKey(sid: string): string {
  return `ownersess:${sid.slice(0, 64)}`;
}

export function hashOwnerSessionCookie(sessionCookie: string): string {
  return crypto.createHash('sha256').update(sessionCookie).digest('hex');
}

export function parseCookieHeader(
  cookieHeader: string | undefined,
  name: string = OWNER_SESSION_COOKIE_NAME
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    const raw = part.slice(idx + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export function buildOwnerSessionCookieHeader(
  sessionCookie: string,
  options: { maxAgeSec: number; secure: boolean }
): string {
  const parts = [
    `${OWNER_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionCookie)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(1, Math.floor(options.maxAgeSec))}`,
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearOwnerSessionCookieHeader(secure: boolean): string {
  const parts = [
    `${OWNER_SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export async function saveOwnerSessionMeta(meta: OwnerSessionMeta): Promise<void> {
  memorySessions.set(meta.sid, { ...meta });
  const ttlMs = Math.max(
    60_000,
    meta.issuedAt + OWNER_SESSION_ABSOLUTE_TTL_MS - Date.now() + 60_000
  );
  await redisSetJson(redisKey(meta.sid), meta, ttlMs);
}

export async function loadOwnerSessionMeta(sid: string): Promise<OwnerSessionMeta | null> {
  const local = memorySessions.get(sid);
  if (local) return { ...local };

  const remote = await redisGetJson<OwnerSessionMeta>(redisKey(sid));
  if (remote.value?.sid && remote.value.uid) {
    memorySessions.set(sid, remote.value);
    return { ...remote.value };
  }
  return null;
}

export async function deleteOwnerSessionMeta(sid: string): Promise<void> {
  memorySessions.delete(sid);
  await redisDel(redisKey(sid));
}

/** Test helper — wipe in-memory sessions between cases. */
export function clearOwnerSessionMemoryForTests(): void {
  memorySessions.clear();
}

export function touchOwnerSessionMeta(
  meta: OwnerSessionMeta,
  now = Date.now()
): OwnerSessionMeta {
  return { ...meta, lastActivityAt: now };
}

export function assessOwnerSessionMeta(
  meta: OwnerSessionMeta,
  now = Date.now()
): OwnerSessionTimingResult {
  return evaluateOwnerSessionTiming({
    issuedAt: meta.issuedAt,
    lastActivityAt: meta.lastActivityAt,
    now,
  });
}

/**
 * Ensure metadata exists for a verified cookie. Re-seeds lastActivity on Redis miss
 * while preserving absolute lifetime from issuedAt.
 */
export async function ensureOwnerSessionMeta(input: {
  sessionCookie: string;
  uid: string;
  email: string;
  role: 'owner' | 'delegate';
  issuedAt: number;
  now?: number;
}): Promise<{ meta: OwnerSessionMeta; timing: OwnerSessionTimingResult }> {
  const now = input.now ?? Date.now();
  const sid = hashOwnerSessionCookie(input.sessionCookie);
  let meta = await loadOwnerSessionMeta(sid);
  if (!meta) {
    meta = {
      sid,
      uid: input.uid,
      email: input.email,
      role: input.role,
      issuedAt: input.issuedAt,
      lastActivityAt: now,
    };
    await saveOwnerSessionMeta(meta);
  }
  const timing = assessOwnerSessionMeta(meta, now);
  return { meta, timing };
}
