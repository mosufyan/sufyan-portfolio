import { afterEach, describe, expect, it } from 'vitest';
import {
  OWNER_SESSION_ABSOLUTE_TTL_MS,
  OWNER_SESSION_COOKIE_NAME,
  OWNER_SESSION_IDLE_TTL_MS,
} from './ownerSessionPolicy.ts';
import {
  assessOwnerSessionMeta,
  buildClearOwnerSessionCookieHeader,
  buildOwnerSessionCookieHeader,
  clearOwnerSessionMemoryForTests,
  ensureOwnerSessionMeta,
  hashOwnerSessionCookie,
  parseCookieHeader,
  saveOwnerSessionMeta,
  touchOwnerSessionMeta,
} from './ownerSession.ts';

describe('ownerSession helpers', () => {
  afterEach(() => {
    clearOwnerSessionMemoryForTests();
  });

  it('parses the owner session cookie from a Cookie header', () => {
    const header = `theme=dark; ${OWNER_SESSION_COOKIE_NAME}=abc%2Fdef; other=1`;
    expect(parseCookieHeader(header)).toBe('abc/def');
    expect(parseCookieHeader(undefined)).toBeNull();
    expect(parseCookieHeader('a=b')).toBeNull();
  });

  it('builds secure Set-Cookie headers', () => {
    const set = buildOwnerSessionCookieHeader('tok+1', { maxAgeSec: 100, secure: true });
    expect(set).toContain(`${OWNER_SESSION_COOKIE_NAME}=tok%2B1`);
    expect(set).toContain('HttpOnly');
    expect(set).toContain('SameSite=Strict');
    expect(set).toContain('Secure');
    expect(set).toContain('Max-Age=100');

    const clear = buildClearOwnerSessionCookieHeader(false);
    expect(clear).toContain('Max-Age=0');
    expect(clear).not.toContain('Secure');
  });

  it('hashes cookies stably', () => {
    expect(hashOwnerSessionCookie('a')).toBe(hashOwnerSessionCookie('a'));
    expect(hashOwnerSessionCookie('a')).not.toBe(hashOwnerSessionCookie('b'));
  });

  it('ensures metadata and detects idle expiry after touch window', async () => {
    const cookie = 'session-cookie-value';
    const issuedAt = 5_000_000;
    const { meta, timing } = await ensureOwnerSessionMeta({
      sessionCookie: cookie,
      uid: 'uid-1',
      email: 'owner@example.com',
      role: 'owner',
      issuedAt,
      now: issuedAt,
    });
    expect(timing.ok).toBe(true);
    expect(meta.sid).toBe(hashOwnerSessionCookie(cookie));

    const touched = touchOwnerSessionMeta(meta, issuedAt + 60_000);
    await saveOwnerSessionMeta(touched);

    const idleExpired = assessOwnerSessionMeta(
      touched,
      issuedAt + 60_000 + OWNER_SESSION_IDLE_TTL_MS + 1
    );
    expect(idleExpired.ok).toBe(false);
    expect(idleExpired.reason).toBe('idle');

    const absoluteExpired = assessOwnerSessionMeta(
      { ...touched, lastActivityAt: issuedAt + OWNER_SESSION_ABSOLUTE_TTL_MS - 1_000 },
      issuedAt + OWNER_SESSION_ABSOLUTE_TTL_MS + 1
    );
    expect(absoluteExpired.ok).toBe(false);
    expect(absoluteExpired.reason).toBe('absolute');
  });
});
