/**
 * Shared security helpers for portfolio lead-capture APIs.
 * CV unlock remains client-side lead telemetry — not authenticated access control.
 */

export const MAX_FIELD_LENGTHS = {
  name: 120,
  email: 254,
  phone: 40,
  subject: 200,
  message: 5000,
} as const;

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 15;
export const RATE_LIMIT_MAX_ENTRIES = 1000;

/** Strict email regex rejecting URI delimiter/control chars (?, #, &, spaces, brackets, etc.) */
const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

export function isValidEmailAddress(email: string): boolean {
  if (!email || email.length > MAX_FIELD_LENGTHS.email) return false;
  if (/[?#<>()[\]\\,;:\s]/.test(email)) return false;
  return STRICT_EMAIL_REGEX.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return true;
  if (phone.length > MAX_FIELD_LENGTHS.phone) return false;
  if (!/^[+\d\s().-]+$/.test(phone)) return false;
  const digitCount = phone.replace(/\D/g, '').length;
  return digitCount >= 7 && digitCount <= 15;
}

export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\u0000-\u001f\u007f]+/g, ' ').trim();
}

export function sanitizeDisplayName(value: string): string {
  return sanitizeHeaderValue(value).replace(/["<>\\]/g, '');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isHoneypotTriggered(website: unknown): boolean {
  return typeof website === 'string' && website.trim().length > 0;
}

export type RateLimitBucket = Map<string, { count: number; resetAt: number }>;

export function createRateLimitBucket(): RateLimitBucket {
  return new Map();
}

/**
 * Returns true when the client is over the limit.
 * In-memory only — fine for a single instance; use Redis/edge limits when scaling out.
 */
export function isRateLimited(
  clientIp: string,
  bucket: RateLimitBucket,
  options: {
    windowMs?: number;
    maxRequests?: number;
    maxEntries?: number;
    now?: number;
  } = {}
): boolean {
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? RATE_LIMIT_MAX_REQUESTS;
  const maxEntries = options.maxEntries ?? RATE_LIMIT_MAX_ENTRIES;
  const now = options.now ?? Date.now();

  if (bucket.size >= maxEntries) {
    for (const [ip, record] of bucket.entries()) {
      if (now > record.resetAt) {
        bucket.delete(ip);
      }
    }
  }

  const entry = bucket.get(clientIp);
  if (!entry || now > entry.resetAt) {
    bucket.set(clientIp, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= maxRequests) {
    return true;
  }
  entry.count += 1;
  return false;
}

export function rateLimitRetryAfterSeconds(
  clientIp: string,
  bucket: RateLimitBucket,
  now = Date.now()
): number {
  const entry = bucket.get(clientIp);
  if (!entry) return Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
  return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
}

export function isAiStudioPreviewHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase();
  return /^ais-(dev|pre)-[a-z0-9.-]+\.run\.app$/.test(hostname) || hostname.endsWith('.run.app');
}

export function shouldAllowPreviewIframe(
  options: { isDev: boolean; host?: string },
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const strictFlag = (env.STRICT_FRAME_DENY || '').toLowerCase();
  if (strictFlag === '1' || strictFlag === 'true' || strictFlag === 'yes') {
    return false;
  }
  const allowFlag = (env.ALLOW_PREVIEW_IFRAME || '').toLowerCase();
  if (allowFlag === '1' || allowFlag === 'true' || allowFlag === 'yes') {
    return true;
  }
  if (options.isDev) {
    return true;
  }
  return isAiStudioPreviewHost(options.host);
}

/** Build Content-Security-Policy matching production static assets + Google Fonts. */
export function buildContentSecurityPolicy(
  isDev: boolean,
  options: { allowPreviewIframe?: boolean } = {}
): string {
  const frameAncestors = options.allowPreviewIframe
    ? "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com"
    : "frame-ancestors 'none'";

  return [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    isDev
      ? "connect-src 'self' ws: wss: https://challenges.cloudflare.com"
      : "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    frameAncestors,
    "object-src 'none'",
  ].join('; ');
}

export function applySecurityHeaders(
  setHeader: (name: string, value: string) => void,
  options: { isDev: boolean; isHttps: boolean; allowPreviewIframe?: boolean }
): void {
  const allowPreviewIframe = Boolean(options.allowPreviewIframe);
  setHeader('X-Content-Type-Options', 'nosniff');
  setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  setHeader('Cross-Origin-Opener-Policy', allowPreviewIframe ? 'same-origin-allow-popups' : 'same-origin');
  if (!allowPreviewIframe) {
    setHeader('X-Frame-Options', 'DENY');
  }
  setHeader(
    'Content-Security-Policy',
    buildContentSecurityPolicy(options.isDev, { allowPreviewIframe })
  );
  if (options.isHttps) {
    setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

/**
 * Soft same-origin check for browser POSTs.
 * Missing Origin/Referer (curl, some privacy browsers) is allowed; mismatched hosts are rejected.
 */
export function isAllowedRequestOrigin(
  originOrReferer: string | undefined,
  allowedOrigins: string[]
): boolean {
  if (!originOrReferer) return true;
  let parsed: URL;
  try {
    parsed = new URL(originOrReferer);
  } catch {
    return false;
  }
  const candidate = `${parsed.protocol}//${parsed.host}`.toLowerCase();
  return allowedOrigins.some((allowed) => allowed.toLowerCase() === candidate);
}

export function resolveAllowedOrigins(appUrl: string | undefined, port: number): string[] {
  const origins = new Set<string>([
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    'https://www.mohammedsufyan.com',
    'https://mohammedsufyan.com',
  ]);
  if (appUrl) {
    try {
      const u = new URL(appUrl);
      origins.add(`${u.protocol}//${u.host}`);
    } catch {
      // ignore invalid APP_URL
    }
  }
  return Array.from(origins);
}

/** FormSubmit relays PII to a third party — only when explicitly enabled. */
export function isFormSubmitFallbackAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.ALLOW_FORMSUBMIT_FALLBACK || '').toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  // Dev convenience only
  return env.NODE_ENV !== 'production';
}

export async function verifyTurnstileToken(
  token: string | undefined,
  secret: string | undefined,
  remoteIp?: string
): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  if (!secret) {
    return { ok: true, skipped: true };
  }
  if (!token || typeof token !== 'string' || token.trim().length < 10) {
    return { ok: false, skipped: false, error: 'Bot verification failed. Please refresh and try again.' };
  }

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token.trim());
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    if (data.success) return { ok: true, skipped: false };
    return { ok: false, skipped: false, error: 'Bot verification failed. Please refresh and try again.' };
  } catch {
    return { ok: false, skipped: false, error: 'Bot verification unavailable. Please try again shortly.' };
  }
}
