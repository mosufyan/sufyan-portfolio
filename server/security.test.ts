import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_FIELD_LENGTHS,
  applySecurityHeaders,
  buildContentSecurityPolicy,
  createRateLimitBucket,
  escapeHtml,
  isAiStudioPreviewHost,
  isAllowedRequestOrigin,
  isFormSubmitFallbackAllowed,
  isHoneypotTriggered,
  isRateLimited,
  isValidEmailAddress,
  isValidPhoneNumber,
  rateLimitRetryAfterSeconds,
  resolveAllowedOrigins,
  sanitizeDisplayName,
  sanitizeHeaderValue,
  shouldAllowPreviewIframe,
  verifyTurnstileToken,
} from './security';

describe('sanitizeHeaderValue / sanitizeDisplayName', () => {
  it('strips CR/LF and control chars to block header injection', () => {
    expect(sanitizeHeaderValue('hello\r\nBcc: evil@x.com')).toBe('hello Bcc: evil@x.com');
    expect(sanitizeDisplayName('Alice "Admin" <root>')).toBe('Alice Admin root');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special characters for email templates', () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;'
    );
  });
});

describe('isValidEmailAddress', () => {
  it('accepts normal addresses', () => {
    expect(isValidEmailAddress('sufyan.net@gmail.com')).toBe(true);
    expect(isValidEmailAddress('a.b+tag@example.co.uk')).toBe(true);
  });

  it('rejects delimiter / control abuse', () => {
    expect(isValidEmailAddress('a@b.com?cc=evil')).toBe(false);
    expect(isValidEmailAddress('a@b.com#frag')).toBe(false);
    expect(isValidEmailAddress('not-an-email')).toBe(false);
    expect(isValidEmailAddress('a@b')).toBe(false);
    expect(isValidEmailAddress('a b@c.com')).toBe(false);
  });
});

describe('isValidPhoneNumber', () => {
  it('allows empty and valid numbers', () => {
    expect(isValidPhoneNumber('')).toBe(true);
    expect(isValidPhoneNumber('+1 (408) 555-1212')).toBe(true);
  });

  it('rejects short or illegal phones', () => {
    expect(isValidPhoneNumber('123')).toBe(false);
    expect(isValidPhoneNumber('abc-defg-hijk')).toBe(false);
  });
});

describe('honeypot', () => {
  it('triggers only when website field is non-empty', () => {
    expect(isHoneypotTriggered('')).toBe(false);
    expect(isHoneypotTriggered('   ')).toBe(false);
    expect(isHoneypotTriggered('http://spam')).toBe(true);
    expect(isHoneypotTriggered(undefined)).toBe(false);
  });
});

describe('rate limiting', () => {
  it('allows up to max requests then blocks', () => {
    const bucket = createRateLimitBucket();
    const now = 1_000_000;
    for (let i = 0; i < 15; i++) {
      expect(isRateLimited('1.2.3.4', bucket, { maxRequests: 15, now })).toBe(false);
    }
    expect(isRateLimited('1.2.3.4', bucket, { maxRequests: 15, now })).toBe(true);
    expect(rateLimitRetryAfterSeconds('1.2.3.4', bucket, now)).toBeGreaterThan(0);
  });

  it('resets after the window', () => {
    const bucket = createRateLimitBucket();
    const now = 1_000_000;
    expect(isRateLimited('9.9.9.9', bucket, { maxRequests: 1, windowMs: 1000, now })).toBe(false);
    expect(isRateLimited('9.9.9.9', bucket, { maxRequests: 1, windowMs: 1000, now })).toBe(true);
    expect(isRateLimited('9.9.9.9', bucket, { maxRequests: 1, windowMs: 1000, now: now + 1001 })).toBe(false);
  });
});

describe('CSP / headers', () => {
  it('allows Google Fonts, Turnstile, and Firebase in production CSP', () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain('fonts.googleapis.com');
    expect(csp).toContain('fonts.gstatic.com');
    expect(csp).toContain('challenges.cloudflare.com');
    expect(csp).toContain('*.googleapis.com');
    expect(csp).toContain('*.firebaseapp.com');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
  });

  it('applies core security headers', () => {
    const headers: Record<string, string> = {};
    applySecurityHeaders((k, v) => {
      headers[k] = v;
    }, { isDev: false, isHttps: true });
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
  });

  it('allows AI Studio preview iframe in dev or on *.run.app while staying strict for custom domain prod', () => {
    expect(isAiStudioPreviewHost('ais-dev-abc-123.us-west2.run.app')).toBe(true);
    expect(isAiStudioPreviewHost('www.mohammedsufyan.com')).toBe(false);
    expect(shouldAllowPreviewIframe({ isDev: true, host: 'localhost:3000' }, {})).toBe(true);
    expect(shouldAllowPreviewIframe({ isDev: false, host: 'ais-pre-abc.us-west2.run.app' }, {})).toBe(true);
    expect(shouldAllowPreviewIframe({ isDev: false, host: 'www.mohammedsufyan.com' }, {})).toBe(false);

    const headers: Record<string, string> = {};
    applySecurityHeaders((k, v) => {
      headers[k] = v;
    }, { isDev: true, isHttps: true, allowPreviewIframe: true });
    expect(headers['X-Frame-Options']).toBeUndefined();
    expect(headers['Content-Security-Policy']).toContain('https://aistudio.google.com');
    expect(headers['Content-Security-Policy']).not.toContain("frame-ancestors 'none'");
  });
});

describe('origin allowlist', () => {
  it('allows missing origin (non-browser clients) and matching hosts', () => {
    const allowed = resolveAllowedOrigins('https://www.mohammedsufyan.com', 3000);
    expect(isAllowedRequestOrigin(undefined, allowed)).toBe(true);
    expect(isAllowedRequestOrigin('https://www.mohammedsufyan.com/contact', allowed)).toBe(true);
    expect(isAllowedRequestOrigin('https://evil.example', allowed)).toBe(false);
  });
});

describe('FormSubmit gate', () => {
  it('is disabled in production by default', () => {
    expect(isFormSubmitFallbackAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(
      isFormSubmitFallbackAllowed({ NODE_ENV: 'production', ALLOW_FORMSUBMIT_FALLBACK: 'true' })
    ).toBe(true);
    expect(isFormSubmitFallbackAllowed({ NODE_ENV: 'development' })).toBe(true);
  });
});

describe('Turnstile verify', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('skips when secret is not configured', async () => {
    await expect(verifyTurnstileToken(undefined, undefined)).resolves.toEqual({
      ok: true,
      skipped: true,
    });
  });

  it('rejects empty token when secret is set', async () => {
    const result = await verifyTurnstileToken('', 'secret');
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
  });

  it('accepts successful siteverify response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true }),
      })
    );
    const result = await verifyTurnstileToken('token-value-ok', 'secret');
    expect(result).toEqual({ ok: true, skipped: false });
  });
});

describe('field length constants', () => {
  it('keeps message cap large enough for portfolio inquiries', () => {
    expect(MAX_FIELD_LENGTHS.message).toBeGreaterThanOrEqual(2000);
    expect(MAX_FIELD_LENGTHS.email).toBe(254);
  });
});
