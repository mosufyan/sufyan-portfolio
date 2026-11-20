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

export type RateLimitNamespace =
  | 'contact'
  | 'cv-access'
  | 'cv-event'
  | 'otp-email'
  | 'telemetry'
  | 'chat';

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
  enablePwaInstall: boolean;
  enableSiteTelemetry: boolean;
  incidentMode: boolean;
  notifyOnNewInquiry: boolean;
  enablePortfolioChat: boolean;
  enableLiveChat: boolean;
  enableChatLlm: boolean;
  chatMaxQuestionsPerVisitor: number;
  chatMaxLlmPerVisitor: number;
  chatMaxLiveSessionsPerVisitor: number;
  chatRateWindowHours: number;
  chatLlmModel: string;
  chatShowSuggestions: boolean;
  chatOfferLiveAgent: boolean;
  alertEmailEnabled: boolean;
  alertEmailUrgent: boolean;
  alertEmailWarning: boolean;
  alertEmailDigest: boolean;
  alertClassNewInquiry: 'urgent' | 'warning' | 'digest' | 'off';
  alertClassLiveChat: 'urgent' | 'warning' | 'digest' | 'off';
  alertClassRiskDownload: 'urgent' | 'warning' | 'digest' | 'off';
  alertClassUnusualTraffic: 'urgent' | 'warning' | 'digest' | 'off';
  alertClassChatLimit: 'urgent' | 'warning' | 'digest' | 'off';
  alertClassOverdueCrm: 'urgent' | 'warning' | 'digest' | 'off';
}

type AlertClass = RuntimeOwnerPolicyPayload['alertClassNewInquiry'];

function asAlertClass(value: unknown, fallback: AlertClass): AlertClass {
  return value === 'urgent' || value === 'warning' || value === 'digest' || value === 'off'
    ? value
    : fallback;
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
  chat: createRateLimitBucket(),
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
    // Fail closed when Redis is configured but unreachable — avoid per-replica bypass.
    console.error('Upstash rate-limit error; denying request (fail-closed):', error);
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
      backend: 'redis',
    };
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
    const clamp = (value: unknown, fb: number, min: number, max: number) => {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return fb;
      return Math.min(max, Math.max(min, Math.round(n)));
    };
    return {
      rules: Array.isArray(raw.rules) ? raw.rules.slice(0, 200) : fallback.rules,
      strictOtpForAll: Boolean(raw.strictOtpForAll),
      enableContactForm:
        typeof raw.enableContactForm === 'boolean' ? raw.enableContactForm : fallback.enableContactForm,
      enableCvDownloads:
        typeof raw.enableCvDownloads === 'boolean' ? raw.enableCvDownloads : fallback.enableCvDownloads,
      enablePwaInstall:
        typeof raw.enablePwaInstall === 'boolean' ? raw.enablePwaInstall : fallback.enablePwaInstall,
      enableSiteTelemetry:
        typeof raw.enableSiteTelemetry === 'boolean'
          ? raw.enableSiteTelemetry
          : fallback.enableSiteTelemetry,
      incidentMode: Boolean(raw.incidentMode),
      notifyOnNewInquiry:
        typeof raw.notifyOnNewInquiry === 'boolean'
          ? raw.notifyOnNewInquiry
          : fallback.notifyOnNewInquiry,
      enablePortfolioChat:
        typeof raw.enablePortfolioChat === 'boolean'
          ? raw.enablePortfolioChat
          : fallback.enablePortfolioChat,
      enableLiveChat:
        typeof raw.enableLiveChat === 'boolean' ? raw.enableLiveChat : fallback.enableLiveChat,
      enableChatLlm:
        typeof raw.enableChatLlm === 'boolean' ? raw.enableChatLlm : fallback.enableChatLlm,
      chatMaxQuestionsPerVisitor: clamp(
        raw.chatMaxQuestionsPerVisitor,
        fallback.chatMaxQuestionsPerVisitor,
        1,
        200
      ),
      chatMaxLlmPerVisitor: clamp(raw.chatMaxLlmPerVisitor, fallback.chatMaxLlmPerVisitor, 0, 100),
      chatMaxLiveSessionsPerVisitor: clamp(
        raw.chatMaxLiveSessionsPerVisitor,
        fallback.chatMaxLiveSessionsPerVisitor,
        0,
        50
      ),
      chatRateWindowHours: clamp(raw.chatRateWindowHours, fallback.chatRateWindowHours, 1, 168),
      chatLlmModel:
        typeof raw.chatLlmModel === 'string' ? raw.chatLlmModel.slice(0, 64) : fallback.chatLlmModel,
      chatShowSuggestions:
        typeof raw.chatShowSuggestions === 'boolean'
          ? raw.chatShowSuggestions
          : fallback.chatShowSuggestions,
      chatOfferLiveAgent:
        typeof raw.chatOfferLiveAgent === 'boolean'
          ? raw.chatOfferLiveAgent
          : fallback.chatOfferLiveAgent,
      alertEmailEnabled:
        typeof raw.alertEmailEnabled === 'boolean'
          ? raw.alertEmailEnabled
          : fallback.alertEmailEnabled,
      alertEmailUrgent:
        typeof raw.alertEmailUrgent === 'boolean' ? raw.alertEmailUrgent : fallback.alertEmailUrgent,
      alertEmailWarning:
        typeof raw.alertEmailWarning === 'boolean'
          ? raw.alertEmailWarning
          : fallback.alertEmailWarning,
      alertEmailDigest:
        typeof raw.alertEmailDigest === 'boolean' ? raw.alertEmailDigest : fallback.alertEmailDigest,
      alertClassNewInquiry: asAlertClass(raw.alertClassNewInquiry, fallback.alertClassNewInquiry),
      alertClassLiveChat: asAlertClass(raw.alertClassLiveChat, fallback.alertClassLiveChat),
      alertClassRiskDownload: asAlertClass(
        raw.alertClassRiskDownload,
        fallback.alertClassRiskDownload
      ),
      alertClassUnusualTraffic: asAlertClass(
        raw.alertClassUnusualTraffic,
        fallback.alertClassUnusualTraffic
      ),
      alertClassChatLimit: asAlertClass(raw.alertClassChatLimit, fallback.alertClassChatLimit),
      alertClassOverdueCrm: asAlertClass(raw.alertClassOverdueCrm, fallback.alertClassOverdueCrm),
    };
  } catch (error) {
    // Fail closed: when Redis is configured but unreachable, lock down visitor features
    // rather than applying a potentially stale in-process fallback.
    console.error('Upstash policy load error; failing closed (incident lockdown):', error);
    return {
      ...fallback,
      incidentMode: true,
      enableContactForm: false,
      enableCvDownloads: false,
      enablePwaInstall: false,
      enableSiteTelemetry: false,
      enablePortfolioChat: false,
      enableLiveChat: false,
      enableChatLlm: false,
      strictOtpForAll: true,
      notifyOnNewInquiry: fallback.notifyOnNewInquiry,
    };
  }
}

export async function saveDistributedOwnerPolicy(
  policy: RuntimeOwnerPolicyPayload
): Promise<boolean> {
  if (!redis) return true;
  try {
    await redis.set(POLICY_REDIS_KEY, policy);
    return true;
  } catch (error) {
    console.error('Upstash policy save error:', error);
    return false;
  }
}

export interface ChatQuotaIncrResult {
  count: number;
  ttlMs: number;
  backend: 'memory' | 'redis';
  error?: boolean;
}

/**
 * Shared per-visitor chat quota counter (fixed window bucket).
 * When Redis is configured, all Cloud Run replicas share the same counter.
 * On Redis errors, returns error:true so callers can fail closed.
 */
export async function incrDistributedChatQuota(
  visitorKey: string,
  kind: string,
  windowMs: number
): Promise<ChatQuotaIncrResult> {
  const cleanKey = visitorKey.trim().slice(0, 64) || 'unknown';
  const cleanKind = kind.trim().slice(0, 32) || 'question';
  const span = Math.max(1_000, windowMs);
  const now = Date.now();
  const bucket = Math.floor(now / span);
  const resetAtMs = (bucket + 1) * span;

  if (!redis) {
    return { count: 0, ttlMs: resetAtMs - now, backend: 'memory' };
  }

  const redisKey = `chatq:${cleanKind}:${cleanKey}:${bucket}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, span);
    }
    const ttlMs = await redis.pttl(redisKey);
    return {
      count,
      ttlMs: ttlMs > 0 ? ttlMs : resetAtMs - now,
      backend: 'redis',
    };
  } catch (error) {
    console.error('Upstash chat-quota error; fail-closed:', error);
    return { count: Number.MAX_SAFE_INTEGER, ttlMs: Math.ceil(span / 1000) * 1000, backend: 'redis', error: true };
  }
}

export async function peekDistributedChatQuota(
  visitorKey: string,
  kind: string,
  windowMs: number
): Promise<ChatQuotaIncrResult> {
  const cleanKey = visitorKey.trim().slice(0, 64) || 'unknown';
  const cleanKind = kind.trim().slice(0, 32) || 'question';
  const span = Math.max(1_000, windowMs);
  const now = Date.now();
  const bucket = Math.floor(now / span);
  const resetAtMs = (bucket + 1) * span;

  if (!redis) {
    return { count: 0, ttlMs: resetAtMs - now, backend: 'memory' };
  }

  const redisKey = `chatq:${cleanKind}:${cleanKey}:${bucket}`;
  try {
    const raw = await redis.get<number>(redisKey);
    const count = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    const ttlMs = await redis.pttl(redisKey);
    return {
      count,
      ttlMs: ttlMs > 0 ? ttlMs : resetAtMs - now,
      backend: 'redis',
    };
  } catch (error) {
    console.error('Upstash chat-quota peek error; fail-closed:', error);
    return { count: Number.MAX_SAFE_INTEGER, ttlMs: Math.ceil(span / 1000) * 1000, backend: 'redis', error: true };
  }
}
