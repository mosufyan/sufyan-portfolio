import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bumpMetric,
  evaluateBotProtection,
  evaluateGoldPathHardening,
  getObservabilitySnapshot,
  structuredLog,
} from './observability.ts';

describe('observability', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('tracks metrics and uptime snapshot', () => {
    const before = getObservabilitySnapshot().httpRequests;
    bumpMetric('httpRequests');
    const snap = getObservabilitySnapshot();
    expect(snap.httpRequests).toBe(before + 1);
    expect(snap.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it('emits structured JSON logs', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    structuredLog('info', 'unit_test_event', { requestId: 'abc' });
    expect(spy).toHaveBeenCalled();
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.msg).toBe('unit_test_event');
    expect(payload.requestId).toBe('abc');
    expect(payload.service).toBe('sufyan-portfolio');
  });

  it('evaluates gold-path checklist from env', () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'ts-secret');
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'ts-site');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', '{"type":"service_account"}');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('SENTRY_DSN', 'https://key@o0.ingest.sentry.io/1');
    vi.stubEnv('SLACK_ALERT_WEBHOOK_URL', 'https://hooks.slack.com/services/T/B/X');
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', 'recaptcha-site');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STRICT_PROD_HARDENING', 'true');

    const gold = evaluateGoldPathHardening();
    expect(gold.score).toBe(gold.max);
    expect(gold.productionReady).toBe(true);
    expect(gold.items.every((i) => i.ok)).toBe(true);

    const bots = evaluateBotProtection({ cloudflareEdge: true });
    expect(bots.uaBlocklist).toBe(true);
    expect(bots.honeypot).toBe(true);
    expect(bots.turnstile).toBe(true);
    expect(bots.redisSharedLimits).toBe(true);
    expect(bots.adminSdkWrites).toBe(true);
    expect(bots.appCheck).toBe(true);
    expect(bots.cloudflareEdge).toBe(true);
  });
});
