import { afterEach, describe, expect, it, vi } from 'vitest';

describe('distributedStore (memory fallback)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reports redis disabled when Upstash env is unset', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const mod = await import('./distributedStore.ts');
    expect(mod.isDistributedStoreEnabled()).toBe(false);
  });

  it('rate-limits in memory after maxRequests', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const mod = await import('./distributedStore.ts');
    const key = `test-ip-${Date.now()}`;
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      const result = await mod.checkDistributedRateLimit('contact', key, {
        maxRequests: 3,
        windowMs: 60_000,
        now,
      });
      expect(result.limited).toBe(false);
      expect(result.backend).toBe('memory');
    }

    const blocked = await mod.checkDistributedRateLimit('contact', key, {
      maxRequests: 3,
      windowMs: 60_000,
      now,
    });
    expect(blocked.limited).toBe(true);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('loadDistributedOwnerPolicy returns fallback without redis', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const mod = await import('./distributedStore.ts');
    const fallback = {
      rules: [],
      strictOtpForAll: false,
      enableContactForm: true,
      enableCvDownloads: true,
      incidentMode: false,
      notifyOnNewInquiry: true,
      enablePortfolioChat: true,
      enableLiveChat: true,
      enableChatLlm: false,
      chatMaxQuestionsPerVisitor: 10,
      chatMaxLlmPerVisitor: 5,
      chatMaxLiveSessionsPerVisitor: 3,
      chatRateWindowHours: 24,
      chatLlmModel: '',
      chatShowSuggestions: true,
      chatOfferLiveAgent: true,
    };
    await expect(mod.loadDistributedOwnerPolicy(fallback)).resolves.toEqual(fallback);
  });
});

describe('firebaseAdmin (unconfigured)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reports not configured without credentials', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', '');
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '');
    const mod = await import('./firebaseAdmin.ts');
    expect(mod.isFirebaseAdminConfigured()).toBe(false);
    await expect(mod.adminWriteCvDownload('CV-TEST', { downloadId: 'CV-TEST' })).resolves.toBe(false);
    await expect(mod.adminWriteContactMessage('MSG-TEST', { messageId: 'MSG-TEST' })).resolves.toBe(
      false
    );
  });
});
