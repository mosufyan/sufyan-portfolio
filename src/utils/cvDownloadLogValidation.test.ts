import { describe, expect, it } from 'vitest';
import {
  CV_DOWNLOAD_CONSTRAINTS,
  buildCsvFromDownloadLogs,
  sanitizeCvDownloadLogPayload,
  type CvDownloadLogRecord,
} from './cvDownloadLogValidation';

describe('sanitizeCvDownloadLogPayload', () => {
  it('enforces Firestore blueprint boundaries and rejects missing email+phone', () => {
    expect(
      sanitizeCvDownloadLogPayload({
        downloadId: 'CV-1234',
        sessionId: 'SES-5678',
        visitorEmail: '',
        visitorPhone: '',
      })
    ).toBeNull();

    const oversized = sanitizeCvDownloadLogPayload({
      downloadId: 'CV AB$12',
      sessionId: 'SES_9999',
      visitorName: 'A'.repeat(200),
      visitorEmail: 'recruiter@company.com',
      visitorPhone: '',
      reason: 'X'.repeat(800),
      action: 'pdf',
      formatLabel: 'Security Track',
      theme: 'dark',
      verificationStatus: 'otp_verified',
      ipAddress: '203.0.113.10',
      country: 'United States',
      region: 'California',
      city: 'San Jose',
      isp: 'Acme Fiber',
      asn: 'AS12345',
      timezone: 'America/Los_Angeles',
      clientTimezone: 'America/Los_Angeles',
      isVpnSuspected: false,
      isProxy: false,
      isHosting: false,
      timezoneMismatch: false,
      riskLevel: 'low',
      riskReasons: '',
      referrer: 'Direct',
      userAgent: 'Mozilla/5.0',
      isSubsequent: false,
    });

    expect(oversized).not.toBeNull();
    expect(CV_DOWNLOAD_CONSTRAINTS.idPattern.test(oversized!.downloadId)).toBe(true);
    expect(oversized!.visitorName.length).toBe(CV_DOWNLOAD_CONSTRAINTS.visitorNameMaxLength);
    expect(oversized!.reason.length).toBe(CV_DOWNLOAD_CONSTRAINTS.reasonMaxLength);
  });
});

describe('buildCsvFromDownloadLogs', () => {
  it('neutralizes CSV spreadsheet formula injection characters', () => {
    const row: CvDownloadLogRecord = {
      downloadId: 'CV-ABCD',
      sessionId: 'SES-1111',
      visitorName: '=CMD("calc")',
      visitorEmail: 'test@company.com',
      visitorPhone: '+14085551234',
      reason: 'Evaluating candidate',
      action: 'pdf',
      formatLabel: 'Executive Summary',
      theme: 'light',
      verificationStatus: 'mx_verified',
      ipAddress: '198.51.100.2',
      country: 'United States',
      region: 'CA',
      city: 'San Jose',
      isp: 'ISP',
      asn: 'AS1',
      timezone: 'America/Los_Angeles',
      clientTimezone: 'America/Los_Angeles',
      isVpnSuspected: false,
      isProxy: false,
      isHosting: false,
      timezoneMismatch: false,
      riskLevel: 'low',
      riskReasons: '',
      referrer: 'Direct',
      userAgent: 'UA',
      isSubsequent: false,
      createdAtMs: 1700000000000,
      createdAtIso: '2026-11-19T12:00:00.000Z',
    };

    const csv = buildCsvFromDownloadLogs([row]);
    expect(csv).toContain(`"'=CMD(""calc"")"`);
    expect(csv).toContain(`"'+14085551234"`);
  });
});
