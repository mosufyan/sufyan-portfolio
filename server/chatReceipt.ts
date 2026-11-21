/**
 * Helpers for authenticated live-chat session receipts.
 * Prefer request headers over body/query so tokens stay out of URLs and logs.
 */
import crypto from 'crypto';
import {
  SESSION_EXPIRED_CODE,
  SESSION_EXPIRED_MESSAGES,
  VERIFIED_SESSION_TTL_MS,
} from './sessionPolicy.ts';

export function signChatSessionReceipt(
  sessionId: string,
  email: string,
  secret: string,
  issuedAtMs = Date.now()
): string {
  const payload = Buffer.from(
    JSON.stringify({ sessionId, email: email.toLowerCase(), iat: issuedAtMs }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyChatSessionReceipt(
  receipt: string | undefined,
  sessionId: string,
  secret: string,
  maxAgeMs = VERIFIED_SESSION_TTL_MS
): { ok: true; email: string } | { ok: false; reason: 'expired' | 'invalid' } {
  if (!receipt || !receipt.includes('.')) return { ok: false, reason: 'invalid' };
  const [payload, sig] = receipt.split('.');
  if (!payload || !sig) return { ok: false, reason: 'invalid' };
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'invalid' };
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sessionId?: string;
      email?: string;
      iat?: number;
    };
    if (parsed.sessionId !== sessionId || typeof parsed.email !== 'string') {
      return { ok: false, reason: 'invalid' };
    }
    if (typeof parsed.iat === 'number' && Date.now() - parsed.iat > maxAgeMs) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, email: parsed.email.toLowerCase() };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export function chatSessionAuthError(auth: { ok: false; reason: 'expired' | 'invalid' }) {
  return {
    error:
      auth.reason === 'expired'
        ? SESSION_EXPIRED_MESSAGES.chat
        : SESSION_EXPIRED_MESSAGES.chatGeneric,
    code: SESSION_EXPIRED_CODE,
  };
}

export function extractChatReceipt(input: {
  headers?: Record<string, string | string[] | undefined>;
  bodyReceipt?: unknown;
  queryReceipt?: unknown;
  allowQuery?: boolean;
}): string | undefined {
  const headers = input.headers || {};
  const headerRaw = headers['x-chat-receipt'];
  const header =
    typeof headerRaw === 'string'
      ? headerRaw
      : Array.isArray(headerRaw)
        ? headerRaw[0]
        : undefined;
  if (typeof header === 'string' && header.trim()) return header.trim();

  const authRaw = headers.authorization;
  const auth =
    typeof authRaw === 'string'
      ? authRaw
      : Array.isArray(authRaw)
        ? authRaw[0]
        : undefined;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('chat-receipt ')) {
    const token = auth.slice('chat-receipt '.length).trim();
    if (token) return token;
  }

  if (typeof input.bodyReceipt === 'string' && input.bodyReceipt.trim()) {
    return input.bodyReceipt.trim();
  }

  // Query receipts leak via access logs / Referer — disabled by default.
  if (
    input.allowQuery &&
    typeof input.queryReceipt === 'string' &&
    input.queryReceipt.trim()
  ) {
    return input.queryReceipt.trim();
  }

  return undefined;
}
