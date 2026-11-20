import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  evaluateAccessRules,
  getEffectivePortfolioSettings,
  sanitizeAdminAuditPayload,
  sanitizePortfolioSettings,
  validateAccessRuleDraft,
  validateAdminDelegateDraft,
} from './ownerGovernance';

describe('ownerGovernance utilities', () => {
  it('validates and sanitizes admin audit payloads cleanly', () => {
    const valid = sanitizeAdminAuditPayload({
      eventType: 'owner_login',
      actorEmail: 'sufyan.net@gmail.com',
      actorUid: 'uid-123',
      summary: 'Owner signed in from Chrome on www.mohammedsufyan.com',
      timezone: 'America/Los_Angeles',
      hostname: 'www.mohammedsufyan.com',
      userAgent: 'Mozilla/5.0',
    });
    expect(valid).not.toBeNull();
    expect(valid?.eventType).toBe('owner_login');

    const invalid = sanitizeAdminAuditPayload({
      eventType: 'owner_login',
      actorEmail: 'sufyan.net@gmail.com',
      actorUid: '',
      summary: 'hi',
    });
    expect(invalid).toBeNull();
  });

  it('sanitizes portfolio settings with safe defaults', () => {
    const sanitized = sanitizePortfolioSettings({
      availabilityStatus: 'advisory',
      availabilityText: 'Available for Cloud Security Advisory',
      maintenanceMode: true,
      enableContactForm: false,
      strictOtpForAll: true,
      incidentMode: true,
      notifyOnNewInquiry: false,
    });
    expect(sanitized.availabilityStatus).toBe('advisory');
    expect(sanitized.maintenanceMode).toBe(true);
    expect(sanitized.enableContactForm).toBe(false);
    expect(sanitized.enableCvDownloads).toBe(DEFAULT_PORTFOLIO_SETTINGS.enableCvDownloads);
    expect(sanitized.incidentMode).toBe(true);
    expect(sanitized.notifyOnNewInquiry).toBe(false);

    const effective = getEffectivePortfolioSettings(sanitized);
    expect(effective.maintenanceMode).toBe(true);
    expect(effective.enableContactForm).toBe(false);
    expect(effective.enableCvDownloads).toBe(false);
    expect(effective.strictOtpForAll).toBe(true);
  });

  it('validates admin delegate drafts', () => {
    const ok = validateAdminDelegateDraft({
      uid: 'abc123UID',
      email: 'teammate@example.com',
    });
    expect(ok.valid).toBe(true);
    expect(ok.normalized?.email).toBe('teammate@example.com');

    const bad = validateAdminDelegateDraft({ uid: '', email: 'nope' });
    expect(bad.valid).toBe(false);
  });

  it('validates and evaluates allowlist and blocklist rules with block precedence', () => {
    const emailRule = validateAccessRuleDraft({
      ruleType: 'allow',
      matchType: 'domain',
      value: '@Cisco.com/recruiting',
      note: 'Trusted domain',
    });
    expect(emailRule.valid).toBe(true);
    expect(emailRule.normalized?.value).toBe('cisco.com');

    const badIp = validateAccessRuleDraft({
      ruleType: 'block',
      matchType: 'ip',
      value: 'not-an-ip!',
    });
    expect(badIp.valid).toBe(false);

    const rules = [
      { ruleType: 'allow' as const, matchType: 'domain' as const, value: 'cisco.com' },
      { ruleType: 'block' as const, matchType: 'ip' as const, value: '203.0.113.99' },
    ];

    const allowed = evaluateAccessRules(rules, {
      email: 'recruiter@cisco.com',
      ipAddress: '198.51.100.10',
    });
    expect(allowed.blocked).toBe(false);
    expect(allowed.allowlisted).toBe(true);

    const blockedOverAllow = evaluateAccessRules(rules, {
      email: 'recruiter@cisco.com',
      ipAddress: '203.0.113.99',
    });
    expect(blockedOverAllow.blocked).toBe(true);
    expect(blockedOverAllow.allowlisted).toBe(false);
  });
});
