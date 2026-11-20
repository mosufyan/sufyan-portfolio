import { describe, expect, it } from 'vitest';
import {
  buildCsvFromContactLogs,
  sanitizeContactMessageLogPayload,
  type ContactMessageLogRecord,
} from './contactMessageLogValidation';

describe('contactMessageLogValidation', () => {
  it('sanitizes valid ContactMessageSummary payloads and clamps boundaries', () => {
    const clean = sanitizeContactMessageLogPayload({
      messageId: 'MSG-AABBCC11',
      senderName: 'Elena Vance',
      senderEmail: 'elena@cisco.com',
      senderPhone: '+1 408 839 4720',
      subject: 'Security Platform Role',
      message: 'We would like to schedule an architecture interview.',
      theme: 'dark',
      ipAddress: '203.0.113.10',
      country: 'United States',
      region: 'California',
      city: 'San Jose',
      isp: 'Cisco Systems',
      asn: 'AS109',
      timezone: 'America/Los_Angeles',
      clientTimezone: 'America/Los_Angeles',
      isVpnSuspected: false,
      riskLevel: 'low',
      riskReasons: '',
      referrer: 'https://www.linkedin.com/',
      userAgent: 'Mozilla/5.0',
    });

    expect(clean).not.toBeNull();
    expect(clean?.messageId).toBe('MSG-AABBCC11');
    expect(clean?.senderEmail).toBe('elena@cisco.com');

    expect(
      sanitizeContactMessageLogPayload({
        messageId: 'bad id!',
        senderName: 'Test',
        senderEmail: 'a@b.com',
        message: 'Hi',
      })
    ).toBeNull();

    expect(
      sanitizeContactMessageLogPayload({
        messageId: 'MSG-1234',
        senderName: '',
        senderEmail: 'a@b.com',
        message: 'Hi',
      })
    ).toBeNull();
  });

  it('escapes formula injection prefixes in CSV exports', () => {
    const record: ContactMessageLogRecord = {
      messageId: 'MSG-11223344',
      senderName: '=CMD("calc")',
      senderEmail: 'test@example.com',
      senderPhone: '',
      subject: '+SUM(A1:A2)',
      message: 'Hello world',
      theme: 'light',
      ipAddress: '1.1.1.1',
      country: 'US',
      region: 'CA',
      city: 'SJ',
      isp: 'ISP',
      asn: 'AS1',
      timezone: 'America/Los_Angeles',
      clientTimezone: 'America/Los_Angeles',
      isVpnSuspected: false,
      riskLevel: 'low',
      riskReasons: '',
      referrer: '',
      userAgent: 'UA',
      triageStatus: 'shortlisted',
      ownerNote: 'Strong match',
      triagedAtMs: 1700000005000,
      createdAtMs: 1700000000000,
      createdAtIso: '2026-11-20T00:00:00.000Z',
    };

    const csv = buildCsvFromContactLogs([record]);
    expect(csv).toContain(`"'=CMD(""calc"")"`);
    expect(csv).toContain(`"'+SUM(A1:A2)"`);
    expect(csv).toContain(`"shortlisted"`);
  });
});
