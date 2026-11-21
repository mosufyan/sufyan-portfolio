import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  assessVisitorRisk,
  createOtpChallenge,
  extractClientIp,
  hasTimezoneMismatch,
  isDisposableEmailDomain,
  isHostingOrVpnAsn,
  isPlausiblePhoneNumber,
  isPrivateOrLoopbackIp,
  maskEmailAddress,
  signSessionReceipt,
  verifyOtpChallenge,
  verifySessionReceipt,
  OTP_CHALLENGE_TTL_MS,
  VERIFIED_SESSION_TTL_MS,
  type IpIntelligence,
  type OtpChallengeRecord,
  type OtpPendingPayload,
} from './telemetry';
import { SESSION_EXPIRED_CODE, SESSION_EXPIRED_MESSAGES } from './sessionPolicy.ts';

describe('extractClientIp & private IP classification', () => {
  it('prefers proxy headers and normalizes IPv4-mapped IPv6 addresses', () => {
    const req = {
      headers: {
        'cf-connecting-ip': '203.0.113.45',
        'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      },
      ip: '::ffff:127.0.0.1',
    } as unknown as Request;
    expect(extractClientIp(req)).toBe('203.0.113.45');

    const forwardedReq = {
      headers: {
        'x-forwarded-for': '::ffff:198.51.100.22:54321, 10.0.0.2',
      },
      ip: '127.0.0.1',
    } as unknown as Request;
    expect(extractClientIp(forwardedReq)).toBe('198.51.100.22');
  });

  it('classifies loopback and RFC1918 ranges as private', () => {
    expect(isPrivateOrLoopbackIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackIp('::1')).toBe(true);
    expect(isPrivateOrLoopbackIp('10.20.1.5')).toBe(true);
    expect(isPrivateOrLoopbackIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrLoopbackIp('192.168.1.40')).toBe(true);
    expect(isPrivateOrLoopbackIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrLoopbackIp('172.32.0.1')).toBe(false);
  });
});

describe('disposable email & fake phone blockers', () => {
  it('blocks known disposable and placeholder domains', () => {
    expect(isDisposableEmailDomain('recruiter@mailinator.com')).toBe(true);
    expect(isDisposableEmailDomain('user@sub.yopmail.com')).toBe(true);
    expect(isDisposableEmailDomain('test@example.com')).toBe(true);
    expect(isDisposableEmailDomain('sufyan.net@gmail.com')).toBe(false);
    expect(isDisposableEmailDomain('hiring@cisco.com')).toBe(false);
  });

  it('blocks synthetic phone patterns while allowing genuine numbers', () => {
    expect(isPlausiblePhoneNumber('')).toBe(true);
    expect(isPlausiblePhoneNumber('0000000000')).toBe(false);
    expect(isPlausiblePhoneNumber('111-111-1111')).toBe(false);
    expect(isPlausiblePhoneNumber('1234567890')).toBe(false);
    expect(isPlausiblePhoneNumber('+1 (408) 555-0142')).toBe(false);
    expect(isPlausiblePhoneNumber('+1 (408) 622-9481')).toBe(true);
  });
});

describe('VPN / Proxy / Timezone risk heuristics', () => {
  it('detects significant browser vs IP timezone mismatch', () => {
    expect(hasTimezoneMismatch('America/Los_Angeles', 'America/Los_Angeles')).toBe(false);
    expect(hasTimezoneMismatch('Asia/Calcutta', 'Asia/Kolkata')).toBe(false);
    expect(hasTimezoneMismatch('America/Los_Angeles', 'Europe/Amsterdam')).toBe(true);
  });

  it('identifies datacenter and VPN ASNs', () => {
    expect(isHostingOrVpnAsn('M247 Europe SRL', 'NordVPN', 'AS9009')).toBe(true);
    expect(isHostingOrVpnAsn('Comcast Cable Communications', 'Comcast', 'AS7922')).toBe(false);
  });

  it('flags VPN/proxy/timezone anomalies as medium or high risk', () => {
    const cleanIntel: IpIntelligence = {
      ipAddress: '73.15.22.10',
      isPrivate: false,
      country: 'United States',
      countryCode: 'US',
      region: 'California',
      city: 'San Jose',
      isp: 'Comcast Cable',
      asn: 'AS7922',
      org: 'Comcast',
      timezone: 'America/Los_Angeles',
      isProxy: false,
      isHosting: false,
      isMobile: false,
      lookupProvider: 'ip-api',
    };
    const low = assessVisitorRisk(cleanIntel, {
      clientTimezone: 'America/Los_Angeles',
      hasEmail: true,
    });
    expect(low.riskLevel).toBe('low');
    expect(low.isVpnSuspected).toBe(false);

    const vpnIntel: IpIntelligence = {
      ...cleanIntel,
      ipAddress: '185.220.101.4',
      isp: 'M247 Ltd',
      timezone: 'Europe/Berlin',
      isProxy: true,
      isHosting: true,
    };
    const high = assessVisitorRisk(vpnIntel, {
      clientTimezone: 'America/Los_Angeles',
      hasEmail: true,
    });
    expect(high.riskLevel).toBe('high');
    expect(high.isVpnSuspected).toBe(true);
    expect(high.timezoneMismatch).toBe(true);
  });
});

describe('OTP challenge & signed session receipts', () => {
  const secret = 'test-hmac-secret-key';

  it('creates, verifies, and consumes single-use OTP challenges', () => {
    const store = new Map<string, OtpChallengeRecord>();
    const samplePayload: OtpPendingPayload = {
      name: 'Taylor',
      email: 'taylor@acme.io',
      phone: '',
      reason: 'Principal Security Architect evaluation',
      action: 'pdf',
      formatLabel: 'Security Track',
      theme: 'dark',
      clientTimezone: 'America/Los_Angeles',
      clientLanguage: 'en-US',
      clientScreen: '1440x900',
      referrer: 'linkedin.com',
      userAgent: 'Mozilla/5.0',
      ip: {
        ipAddress: '198.51.100.10',
        isPrivate: false,
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        city: 'San Jose',
        isp: 'Test Net',
        asn: 'AS64512',
        org: 'Test Net',
        timezone: 'America/Los_Angeles',
        isProxy: true,
        isHosting: false,
        isMobile: false,
        lookupProvider: 'ip-api',
      },
      risk: {
        riskScore: 60,
        riskLevel: 'high',
        isVpnSuspected: true,
        timezoneMismatch: false,
        asnVpnMatch: false,
        riskReasons: ['VPN / Proxy / Tor IP flagged'],
      },
    };

    const created = createOtpChallenge(store, samplePayload, secret, { fixedCode: '482913' });
    const badAttempt = verifyOtpChallenge(
      store,
      { challengeId: created.challengeId, challengeToken: created.challengeToken, code: '000000' },
      secret
    );
    expect(badAttempt.ok).toBe(false);

    const goodAttempt = verifyOtpChallenge(
      store,
      { challengeId: created.challengeId, challengeToken: created.challengeToken, code: '482913' },
      secret
    );
    expect(goodAttempt.ok).toBe(true);

    // Single-use replay rejected
    const replay = verifyOtpChallenge(
      store,
      { challengeId: created.challengeId, challengeToken: created.challengeToken, code: '482913' },
      secret
    );
    expect(replay.ok).toBe(false);
  });

  it('signs and verifies session receipts while rejecting tampering', () => {
    const receipt = signSessionReceipt(
      {
        sessionId: 'SES-123456',
        name: 'Alex',
        email: 'alex@company.com',
        phone: '',
        reason: 'Recruiting role',
        verificationStatus: 'otp_verified',
        issuedAt: Date.now(),
      },
      secret
    );

    const verified = verifySessionReceipt(receipt, secret);
    expect(verified?.sessionId).toBe('SES-123456');
    expect(verifySessionReceipt(`${receipt}x`, secret)).toBeNull();
    expect(maskEmailAddress('alex.rivera@company.com')).toBe('al*********@company.com');
  });

  it('rejects CV session receipts older than the verified-session TTL', () => {
    expect(VERIFIED_SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000);
    expect(OTP_CHALLENGE_TTL_MS).toBe(10 * 60 * 1000);

    const receipt = signSessionReceipt(
      {
        sessionId: 'SES-EXPIRED',
        name: 'Alex',
        email: 'alex@company.com',
        phone: '',
        reason: 'Recruiting role',
        verificationStatus: 'otp_verified',
        issuedAt: Date.now() - VERIFIED_SESSION_TTL_MS - 1_000,
      },
      secret
    );

    expect(verifySessionReceipt(receipt, secret)).toBeNull();
    expect(SESSION_EXPIRED_MESSAGES.cv).toMatch(/re-verify/i);
    expect(SESSION_EXPIRED_CODE).toBe('session_expired');
  });
});
