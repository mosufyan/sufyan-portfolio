import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  evaluateAccessRules,
  getEffectivePortfolioSettings,
  sanitizeAdminAuditPayload,
  sanitizePortfolioSettings,
  summarizePortfolioSettingsChanges,
  toPublicPortfolioSettings,
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
      chatMaxQuestionsPerVisitor: 999,
      chatMaxLlmPerVisitor: -2,
      enableChatLlm: true,
      chatLlmModel: 'grok-4.7',
    });
    expect(sanitized.availabilityStatus).toBe('advisory');
    expect(sanitized.maintenanceMode).toBe(true);
    expect(sanitized.enableContactForm).toBe(false);
    expect(sanitized.enableCvDownloads).toBe(DEFAULT_PORTFOLIO_SETTINGS.enableCvDownloads);
    expect(sanitized.incidentMode).toBe(true);
    expect(sanitized.notifyOnNewInquiry).toBe(false);
    expect(sanitized.chatMaxQuestionsPerVisitor).toBe(200);
    expect(sanitized.chatMaxLlmPerVisitor).toBe(0);
    expect(sanitized.enableChatLlm).toBe(true);
    expect(sanitized.chatLlmModel).toBe('grok-4.7');

    const effective = getEffectivePortfolioSettings(sanitized);
    expect(effective.maintenanceMode).toBe(true);
    expect(effective.enableContactForm).toBe(false);
    expect(effective.enableCvDownloads).toBe(false);
    expect(effective.strictOtpForAll).toBe(true);
    expect(effective.requireOtpForChat).toBe(true);
    expect(effective.requireOtpForContact).toBe(true);
    expect(effective.requireOtpForCv).toBe(true);
    expect(effective.enablePortfolioChat).toBe(false);
    expect(effective.enableLiveChat).toBe(false);
    expect(effective.enableChatLlm).toBe(false);
    expect(effective.enableVoiceAgent).toBe(false);
    expect(effective.enableVoiceRealtime).toBe(false);
    expect(effective.enableAnnouncements).toBe(false);
    expect(effective.enableResumeStudio).toBe(false);
    expect(effective.enableDigitalCard).toBe(false);
    expect(effective.enableCommandPalette).toBe(false);
    expect(effective.enableTerminal).toBe(false);
    expect(effective.enablePwaInstall).toBe(false);
    expect(effective.enableSkillFilter).toBe(false);
    expect(effective.enableReadingModes).toBe(false);
    expect(effective.enableScrollHud).toBe(false);
    expect(effective.enableSiteTelemetry).toBe(false);
  });

  it('strips private policy fields from the public settings slice', () => {
    const full = sanitizePortfolioSettings({
      chatMaxQuestionsPerVisitor: 42,
      enableChatLlm: true,
      chatLlmModel: 'secret-model',
      alertEmailEnabled: true,
      alertClassLiveChat: 'urgent',
      enablePortfolioChat: true,
    });
    const pub = toPublicPortfolioSettings(full);
    expect(pub.enablePortfolioChat).toBe(true);
    expect(pub).not.toHaveProperty('chatMaxQuestionsPerVisitor');
    expect(pub).not.toHaveProperty('enableChatLlm');
    expect(pub).not.toHaveProperty('chatLlmModel');
    expect(pub).not.toHaveProperty('alertEmailEnabled');
    expect(pub).not.toHaveProperty('alertClassLiveChat');
  });

  it('defaults visitor feature switches to enabled', () => {
    const sanitized = sanitizePortfolioSettings({});
    expect(sanitized.enableAnnouncements).toBe(true);
    expect(sanitized.enableResumeStudio).toBe(true);
    expect(sanitized.enableDigitalCard).toBe(true);
    expect(sanitized.enableCommandPalette).toBe(true);
    expect(sanitized.enableTerminal).toBe(true);
    expect(sanitized.enablePwaInstall).toBe(true);
    expect(sanitized.enableSkillFilter).toBe(true);
    expect(sanitized.enableReadingModes).toBe(true);
    expect(sanitized.enableScrollHud).toBe(true);
    expect(sanitized.enableSiteTelemetry).toBe(true);
  });

  it('defaults chat caps to ten questions per visitor', () => {
    const sanitized = sanitizePortfolioSettings({});
    expect(sanitized.chatMaxQuestionsPerVisitor).toBe(10);
    expect(sanitized.chatMaxVoiceTurnsPerVisitor).toBe(8);
    expect(sanitized.chatMaxVoiceRealtimeSessionsPerVisitor).toBe(2);
    expect(sanitized.chatMaxVoiceRealtimeMinutesPerVisitor).toBe(5);
    expect(sanitized.enablePortfolioChat).toBe(true);
    expect(sanitized.enableLiveChat).toBe(true);
    expect(sanitized.enableChatLlm).toBe(false);
    expect(sanitized.enableVoiceAgent).toBe(false);
    expect(sanitized.enableVoiceRealtime).toBe(false);
    expect(sanitized.voiceSttModel).toBe('');
    expect(sanitized.voiceTtsVoiceId).toBe('');
    expect(sanitized.voiceRealtimeModel).toBe('');
  });

  it('sanitizes voice model and voice id fields', () => {
    const sanitized = sanitizePortfolioSettings({
      voiceSttModel: ' grok-voice-transcribe-2.0! ',
      voiceTtsVoiceId: 'eve<script>',
      voiceRealtimeModel: 'grok-voice-3.0',
    });
    expect(sanitized.voiceSttModel).toBe('grok-voice-transcribe-2.0');
    expect(sanitized.voiceTtsVoiceId).toBe('evescript');
    expect(sanitized.voiceRealtimeModel).toBe('grok-voice-3.0');
  });

  it('summarizes portfolio setting diffs for save toasts', () => {
    const before = sanitizePortfolioSettings({});
    const after = sanitizePortfolioSettings({
      ...before,
      enableVoiceAgent: true,
      enableVoiceRealtime: true,
      voiceTtsVoiceId: 'eve',
    });
    const summary = summarizePortfolioSettingsChanges(before, after);
    expect(summary).toMatch(/Enabled push-to-talk voice/i);
    expect(summary).toMatch(/Enabled live speech-to-speech/i);
    expect(summary).toMatch(/TTS voice → eve/);
    expect(summarizePortfolioSettingsChanges(before, before)).toMatch(/No setting changes/i);
  });

  it('defaults OTP require toggles on and migrates strictOtpForAll into requireOtpForCv', () => {
    const defaults = sanitizePortfolioSettings({});
    expect(defaults.requireOtpForChat).toBe(true);
    expect(defaults.requireOtpForContact).toBe(true);
    expect(defaults.requireOtpForCv).toBe(true);
    expect(defaults.strictOtpForAll).toBe(true);

    const fromLegacy = sanitizePortfolioSettings({ strictOtpForAll: false });
    expect(fromLegacy.requireOtpForCv).toBe(false);
    expect(fromLegacy.strictOtpForAll).toBe(false);

    const explicit = sanitizePortfolioSettings({
      requireOtpForChat: false,
      requireOtpForContact: false,
      requireOtpForCv: true,
      strictOtpForAll: false,
    });
    expect(explicit.requireOtpForChat).toBe(false);
    expect(explicit.requireOtpForContact).toBe(false);
    expect(explicit.requireOtpForCv).toBe(true);
    expect(explicit.strictOtpForAll).toBe(true);
  });

  it('defaults alert routing with urgent live chat and digest inquiries', () => {
    const sanitized = sanitizePortfolioSettings({
      alertClassLiveChat: 'nope' as unknown as 'urgent',
      alertEmailUrgent: false,
    });
    expect(sanitized.alertClassLiveChat).toBe('urgent');
    expect(sanitized.alertClassNewInquiry).toBe('digest');
    expect(sanitized.alertEmailEnabled).toBe(true);
    expect(sanitized.alertEmailUrgent).toBe(false);
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
