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

/**
 * Progressive style CSP tighten. Default off — keep React/Motion `style={}` working.
 * When true: drop blanket style-src 'unsafe-inline', allow only style-src-attr 'unsafe-inline'
 * (style elements must come from 'self' / Google Fonts). Flip off instantly if anything breaks.
 */
export function isCspStrictStylesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.CSP_STRICT_STYLES || '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

/** Theme boot script in index.html — keep hash in sync if that inline block changes. */
export const THEME_BOOT_SCRIPT_HASH = "'sha256-O4CQilOGOhTnEIrcmOBIAfQx9jpXZpXwqN224L11mJs='";

function buildStyleDirectives(mode: 'compatible' | 'strict' | 'report'): string[] {
  if (mode === 'compatible') {
    // Safe default: React / Motion / CSS-in-JS may use inline styles or <style> tags.
    return ["style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"];
  }
  if (mode === 'strict') {
    // Enforce: no inline <style> elements; React style attributes still allowed.
    return [
      "style-src 'self' https://fonts.googleapis.com",
      "style-src-elem 'self' https://fonts.googleapis.com",
      "style-src-attr 'unsafe-inline'",
    ];
  }
  // Report-only: measure both element and attribute violations without breaking users.
  return [
    "style-src 'self' https://fonts.googleapis.com",
    "style-src-elem 'self' https://fonts.googleapis.com",
    "style-src-attr 'none'",
  ];
}

/** Build Content-Security-Policy matching production static assets + Google Fonts + Firebase. */
export function buildContentSecurityPolicy(
  isDev: boolean,
  options: { allowPreviewIframe?: boolean } = {},
  env: NodeJS.ProcessEnv = process.env
): string {
  const frameAncestors = options.allowPreviewIframe
    ? "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com"
    : "frame-ancestors 'none'";

  // IMPORTANT: do NOT combine a script hash with 'unsafe-inline' in Chrome.
  // When a hash/nonce is present, browsers ignore 'unsafe-inline', which blocks
  // Vite's React Refresh / PWA inline scripts and leaves localhost blank.
  const styleMode = isCspStrictStylesEnabled(env) ? 'strict' : 'compatible';

  return [
    "default-src 'self'",
    isDev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.gstatic.com/recaptcha/ https://www.recaptcha.net https://challenges.cloudflare.com`
      : `script-src 'self' ${THEME_BOOT_SCRIPT_HASH} https://apis.google.com https://www.gstatic.com https://www.google.com https://www.gstatic.com/recaptcha/ https://www.recaptcha.net https://challenges.cloudflare.com`,
    ...buildStyleDirectives(styleMode),
    "img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com https://www.recaptcha.net",
    // Push-to-talk Grok TTS plays as data:/blob: audio in the chat widget.
    "media-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    isDev
      ? "connect-src 'self' ws: wss: https://challenges.cloudflare.com https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseappcheck.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.googleapis.com https://accounts.google.com https://www.recaptcha.net"
      : "connect-src 'self' https://challenges.cloudflare.com https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseappcheck.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.googleapis.com https://accounts.google.com https://www.recaptcha.net",
    "frame-src 'self' https://challenges.cloudflare.com https://*.firebaseapp.com https://accounts.google.com https://www.google.com https://www.recaptcha.net https://recaptcha.google.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    frameAncestors,
    "object-src 'none'",
    "report-uri /api/csp-report",
  ].join('; ');
}

/**
 * Stricter report-only policy for migration telemetry.
 * Scripts: no unsafe-inline/eval (prod keeps the theme-boot hash).
 * Styles: style-src-elem/attr split with attr 'none' so /api/csp-report shows real impact
 * before flipping CSP_STRICT_STYLES on the enforcing header.
 */
export function buildContentSecurityPolicyReportOnly(
  isDev: boolean,
  options: { allowPreviewIframe?: boolean } = {},
  env: NodeJS.ProcessEnv = process.env
): string {
  // Build from a non-strict baseline so we control style directives explicitly,
  // then strip script unsafe-inline/eval for telemetry.
  const baselineEnv = { ...env, CSP_STRICT_STYLES: 'false' };
  const enforced = buildContentSecurityPolicy(isDev, options, baselineEnv);
  const withoutCompatibleStyles = enforced.replace(
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    buildStyleDirectives('report').join('; ')
  );
  return withoutCompatibleStyles
    .replace(" 'unsafe-inline'", '')
    .replace(" 'unsafe-eval'", '');
}

export function applySecurityHeaders(
  setHeader: (name: string, value: string) => void,
  options: { isDev: boolean; isHttps: boolean; allowPreviewIframe?: boolean }
): void {
  const allowPreviewIframe = Boolean(options.allowPreviewIframe);
  setHeader('X-Content-Type-Options', 'nosniff');
  setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // microphone=(self) required for chat speech-to-text; empty () blocks getUserMedia entirely.
  setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (!allowPreviewIframe) {
    setHeader('X-Frame-Options', 'DENY');
  }
  setHeader(
    'Content-Security-Policy',
    buildContentSecurityPolicy(options.isDev, { allowPreviewIframe })
  );
  setHeader(
    'Content-Security-Policy-Report-Only',
    buildContentSecurityPolicyReportOnly(options.isDev, { allowPreviewIframe })
  );
  if (options.isHttps) {
    setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

/**
 * Same-origin check for browser POSTs.
 * In production, missing Origin/Referer is rejected (CSRF-hardening).
 * In non-production, missing Origin/Referer is allowed for curl/local tooling.
 */
export function isAllowedRequestOrigin(
  originOrReferer: string | undefined,
  allowedOrigins: string[],
  options: { requireOrigin?: boolean } = {}
): boolean {
  const requireOrigin =
    options.requireOrigin ?? process.env.NODE_ENV === 'production';
  if (!originOrReferer) return !requireOrigin;
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
  // Never auto-enable: third-party PII relay must be an explicit opt-in.
  return false;
}

export async function verifyTurnstileToken(
  token: string | undefined,
  secret: string | undefined,
  remoteIp?: string,
  options: { failOpenWithoutSecret?: boolean } = {}
): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  if (!secret) {
    const failOpen =
      options.failOpenWithoutSecret ?? process.env.NODE_ENV !== 'production';
    if (failOpen) {
      return { ok: true, skipped: true };
    }
    return {
      ok: false,
      skipped: false,
      error: 'Bot verification is not configured. Please try again later.',
    };
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

/** AI dataset scrapers, agent crawlers, SEO bots, and vulnerability scanners — always blocked. */
const BLOCKED_CRAWLER_AND_SCANNER_UA_REGEX =
  /\b(gptbot|chatgpt-user|oai-searchbot|google-extended|ccbot|claudebot|claude-web|anthropic-ai|bytespider|perplexitybot|applebot-extended|amazonbot|meta-externalagent|facebookbot|diffbot|cohere-ai|omgilibot|omgili|youbot|imagesiftbot|timpibot|ai2bot|petalbot|dataforseobot|webzio|webz\.io|seekr|duckassistbot|icc-crawler|velenpublicwebcrawler|magpie-crawler|turnitinbot|whisper|scrapy|sqlmap|nikto|gobuster|dirbuster|masscan|nuclei|semrushbot|ahrefsbot|mj12bot|dotbot)\b/i;

/**
 * Headless browsers, HTTP libraries, and agentic automation frameworks.
 * Only enforced on sensitive POST mutations (contact / CV / chat) so legitimate
 * link-preview unfurlers and search crawlers are not collateral damage.
 */
const BLOCKED_POST_SCRIPT_UA_REGEX =
  /\b(headlesschrome|phantomjs|selenium|puppeteer|playwright|browser-use|crawl4ai|langchain|python-urllib|python-requests|go-http-client|java\/|httpclient|aiohttp|httpx|axios\/|node-fetch|undici|got\/|curl\/|wget|libwww|okhttp|postmanruntime|insomnia|httpie)\b/i;

/** Reject blatant AI scrapers, vulnerability scanners, and automated form-submission scripts. */
export function isBlockedBotUserAgent(
  userAgent: string | undefined,
  isPostMutation = false
): boolean {
  if (!userAgent || typeof userAgent !== 'string') {
    return isPostMutation;
  }
  const clean = userAgent.trim();
  if (!clean) return isPostMutation;
  if (BLOCKED_CRAWLER_AND_SCANNER_UA_REGEX.test(clean)) return true;
  if (isPostMutation && BLOCKED_POST_SCRIPT_UA_REGEX.test(clean)) return true;
  return false;
}

/** Detect Cloudflare edge proxy from request headers (no secrets). */
export function isCloudflareEdgeProxied(headers: {
  'cf-ray'?: string | string[];
  'cf-connecting-ip'?: string | string[];
}): boolean {
  const ray = headers['cf-ray'];
  const ip = headers['cf-connecting-ip'];
  const hasRay = typeof ray === 'string' ? ray.trim().length > 0 : Array.isArray(ray) && ray.length > 0;
  const hasIp = typeof ip === 'string' ? ip.trim().length > 0 : Array.isArray(ip) && ip.length > 0;
  return hasRay || hasIp;
}

/** Reject browser requests explicitly marked as cross-site via Fetch Metadata. */
export function isDisallowedFetchSite(
  secFetchSiteHeader: string | string[] | undefined
): boolean {
  if (!secFetchSiteHeader) return false;
  const raw = Array.isArray(secFetchSiteHeader)
    ? secFetchSiteHeader[0]
    : secFetchSiteHeader;
  if (typeof raw !== 'string') return false;
  return raw.trim().toLowerCase() === 'cross-site';
}

const SAFE_HOSTNAME_REGEX = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

/**
 * Resolve a safe canonical origin for dynamic OG tags without trusting arbitrary Host headers.
 */
export function resolveSafeBaseUrl(
  options: {
    appUrl?: string;
    protoHeader?: string | string[];
    hostHeader?: string | string[];
    protocol?: string;
  },
  allowedOrigins: string[]
): string {
  const defaultOrigin = 'https://www.mohammedsufyan.com';
  if (options.appUrl) {
    try {
      const parsed = new URL(options.appUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      /* ignore invalid APP_URL */
    }
  }

  const rawHost = Array.isArray(options.hostHeader)
    ? options.hostHeader[0]
    : options.hostHeader;
  const candidateHost = rawHost ? rawHost.split(',')[0].trim() : '';
  if (!candidateHost || !SAFE_HOSTNAME_REGEX.test(candidateHost)) {
    return defaultOrigin;
  }

  const rawProto = Array.isArray(options.protoHeader)
    ? options.protoHeader[0]
    : options.protoHeader;
  const protoCandidate = (rawProto || options.protocol || 'https')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const safeProto = protoCandidate === 'http' ? 'http' : 'https';
  const candidateOrigin = `${safeProto}://${candidateHost}`.toLowerCase();

  if (
    isAiStudioPreviewHost(candidateHost) ||
    candidateHost.startsWith('localhost:') ||
    candidateHost.startsWith('127.0.0.1:') ||
    allowedOrigins.some((origin) => origin.toLowerCase() === candidateOrigin)
  ) {
    return `${safeProto}://${candidateHost}`;
  }

  return defaultOrigin;
}

