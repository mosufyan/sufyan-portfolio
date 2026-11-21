import { describe, expect, it } from 'vitest';
import { sanitizeLeadCrmFields } from './contactMessageLogValidation';
import {
  buildDigestText,
  buildOwnerAlerts,
  computeFunnelSnapshot,
  filterActivityTimeline,
} from './ownerTracking';

describe('ownerTracking', () => {
  it('computes funnel rates from messages and downloads', () => {
    const now = Date.now();
    const funnel = computeFunnelSnapshot(
      [
        {
          messageId: 'm1',
          senderName: 'A',
          senderEmail: 'a@ex.com',
          senderPhone: '',
          subject: 'Hi',
          message: 'Hello there friend',
          theme: 'dark',
          ipAddress: '',
          country: '',
          region: '',
          city: '',
          isp: '',
          asn: '',
          timezone: '',
          clientTimezone: '',
          isVpnSuspected: false,
          riskLevel: 'low',
          riskReasons: '',
          referrer: '',
          userAgent: '',
          triageStatus: 'replied',
          ownerNote: '',
          triagedAtMs: now,
          createdAtMs: now,
          createdAtIso: new Date(now).toISOString(),
          leadCompany: '',
          leadRole: '',
          leadSource: '',
          leadPriority: '',
          leadNextAction: '',
          leadNextActionDueAtMs: null,
          leadOutcome: '',
        },
      ],
      [],
      30,
      now
    );
    expect(funnel.contactMessages).toBe(1);
    expect(funnel.replyRate).toBe(1);
  });

  it('builds alerts for hot leads and sanitizes CRM fields', () => {
    const now = Date.now();
    const alerts = buildOwnerAlerts({
      nowMs: now,
      downloads: [],
      messages: [
        {
          messageId: 'm2',
          senderName: 'B',
          senderEmail: 'b@ex.com',
          senderPhone: '',
          subject: 'Role',
          message: 'Interested in chatting soon',
          theme: 'light',
          ipAddress: '',
          country: '',
          region: '',
          city: '',
          isp: '',
          asn: '',
          timezone: '',
          clientTimezone: '',
          isVpnSuspected: false,
          riskLevel: 'low',
          riskReasons: '',
          referrer: '',
          userAgent: '',
          triageStatus: 'new',
          ownerNote: '',
          triagedAtMs: null,
          createdAtMs: now,
          createdAtIso: new Date(now).toISOString(),
          leadCompany: 'Acme',
          leadRole: 'Staff',
          leadSource: 'linkedin',
          leadPriority: 'hot',
          leadNextAction: 'Reply',
          leadNextActionDueAtMs: now - 1000,
          leadOutcome: 'open',
        },
      ],
    });
    expect(alerts.some((a) => a.id.startsWith('hot-'))).toBe(true);
    expect(alerts.some((a) => a.id.startsWith('overdue-'))).toBe(true);

    const lead = sanitizeLeadCrmFields({
      leadCompany: '  Cisco  ',
      leadSource: 'linkedin',
      leadPriority: 'warm',
    });
    expect(lead.leadCompany).toBe('Cisco');
    expect(lead.leadSource).toBe('linkedin');
  });

  it('filters activity timeline and builds digest text', () => {
    const filtered = filterActivityTimeline(
      [
        {
          auditId: 'a1',
          eventType: 'owner_login',
          actorEmail: 'x@y.com',
          actorUid: 'u',
          summary: 'login event happened',
          userAgent: '',
          timezone: '',
          hostname: '',
          createdAtMs: 1,
          createdAtIso: '',
        },
        {
          auditId: 'a2',
          eventType: 'owner_reply_sent',
          actorEmail: 'x@y.com',
          actorUid: 'u',
          summary: 'replied to visitor',
          userAgent: '',
          timezone: '',
          hostname: '',
          createdAtMs: 2,
          createdAtIso: '',
        },
      ],
      'outreach'
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].eventType).toBe('owner_reply_sent');

    const digest = buildDigestText({
      funnel: {
        windowDays: 30,
        contactMessages: 2,
        contactReplied: 1,
        contactShortlisted: 0,
        cvExports: 3,
        cvOtpVerified: 2,
        cvHighRisk: 1,
        uniqueVisitorEmails: 4,
        replyRate: 0.5,
        otpShareOfExports: 0.66,
      },
      alerts: [],
      telemetry: { pageviews: 10, ogShares: 2, ogByTrack: { executive: 2 }, updatedAtIso: '' },
    });
    expect(digest).toContain('Inquiries: 2');
    expect(digest).toContain('Pageviews: 10');
  });
});
