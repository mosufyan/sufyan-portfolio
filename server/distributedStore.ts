/**
 * Optional Upstash Redis-backed shared state for multi-instance deployments.
 * Falls back to in-process memory when UPSTASH_REDIS_REST_URL / TOKEN are unset.
 */
import { Redis } from '@upstash/redis';
import {
  RATE_LIMIT_MAX_ENTRIES,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  createRateLimitBucket,
  isRateLimited,
  rateLimitRetryAfterSeconds,
  type RateLimitBucket,
} from './security.ts';

export type RateLimitNamespace = 'contact' | 'cv-access' | 'cv-event' | 'otp-email' | 'telemetry';

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
  backend: 'memory' | 'redis';
}

export interface RuntimeOwnerPolicyPayload {
  rules: Array<{
    ruleType: 'allow' | 'block';
    matchType: 'email' | 'domain' | 'ip';
    value: string;
    note?: string;
  }>;
  strictOtpForAll: boolean;
  enableContactForm: boolean;
  enableCvDownloads: boolean;
  incidentMode: boolean;
  notifyOnNewInquiry: boolean;
}

function createUpstashClient(): Redis | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

const redis = createUpstashClient();

const memoryBuckets: Record<RateLimitNamespace, RateLimitBucket> = {
  contact: createRateLimitBucket(),
  'cv-access': createRateLimitBucket(),
  'cv-event': createRateLimitBucket(),
  'otp-email': createRateLimitBucket(),
  telemetry: createRateLimitBucket(),
};

export function isDistributedStoreEnabled(): boolean {
  return redis != null;
}

function checkMemoryRateLimit(
  namespace: RateLimitNamespace,
  cleanKey: string,
  options: { windowMs: number; maxRequests: number; now: number }
): RateLimitResult {
  const bucket = memoryBuckets[namespace];
  const limited = isRateLimited(cleanKey, bucket, {
    windowMs: options.windowMs,
    maxRequests: options.maxRequests,
    maxEntries: RATE_LIMIT_MAX_ENTRIES,
    now: options.now,
  });
  return {
    limited,
    retryAfterSeconds: limited ? rateLimitRetryAfterSeconds(cleanKey, bucket, options.now) : 0,
    backend: 'memory',
  };
}

export async function checkDistributedRateLimit(
  namespace: RateLimitNamespace,
  key: string,
  options: {
    windowMs?: number;
    maxRequests?: number;
    now?: number;
  } = {}
): Promise<RateLimitResult> {
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? RATE_LIMIT_MAX_REQUESTS;
  const now = options.now ?? Date.now();
  const cleanKey = key.trim().toLowerCase().slice(0, 200) || 'unknown';

  if (!redis) {
    return checkMemoryRateLimit(namespace, cleanKey, { windowMs, maxRequests, now });
  }

  const redisKey = `rl:${namespace}:${cleanKey}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    if (count > maxRequests) {
      const ttlMs = await redis.pttl(redisKey);
      return {
        limited: true,
        retryAfterSeconds: Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000)),
        backend: 'redis',
      };
    }
    return { limited: false, retryAfterSeconds: 0, backend: 'redis' };
  } catch (error) {
    console.error('Upstash rate-limit error; falling back to memory:', error);
    return checkMemoryRateLimit(namespace, cleanKey, { windowMs, maxRequests, now });
  }
}

const POLICY_REDIS_KEY = 'owner:runtime-policy';

export async function loadDistributedOwnerPolicy(
  fallback: RuntimeOwnerPolicyPayload
): Promise<RuntimeOwnerPolicyPayload> {
  if (!redis) return fallback;
  try {
    const raw = await redis.get<RuntimeOwnerPolicyPayload>(POLICY_REDIS_KEY);
    if (!raw || typeof raw !== 'object') return fallback;
    return {
      rules: Array.isArray(raw.rules) ? raw.rules.slice(0, 200) : fallback.rules,
      strictOtpForAll: Boolean(raw.strictOtpForAll),
      enableContactForm:
        typeof raw.enableContactForm === 'boolean' ? raw.enableContactForm : fallback.enableContactForm,
      enableCvDownloads:
        typeof raw.enableCvDownloads === 'boolean' ? raw.enableCvDownloads : fallback.enableCvDownloads,
      incidentMode: Boolean(raw.incidentMode),
      notifyOnNewInquiry:
        typeof raw.notifyOnNewInquiry === 'boolean'
          ? raw.notifyOnNewInquiry
          : fallback.notifyOnNewInquiry,
    };
  } catch (error) {
    console.error('Upstash policy load error; using local fallback:', error);
    return fallback;
  }
}

export async function saveDistributedOwnerPolicy(policy: RuntimeOwnerPolicyPayload): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(POLICY_REDIS_KEY, policy);
  } catch (error) {
    console.error('Upstash policy save error:', error);
  }
}
