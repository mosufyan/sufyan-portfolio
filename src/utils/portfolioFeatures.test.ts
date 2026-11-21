/**
 * Cross-cutting unit coverage for portfolio website feature utilities.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  getEffectivePortfolioSettings,
  sanitizePortfolioSettings,
  evaluateAccessRules,
} from './ownerGovernance';
import {
  buildOwnerConsoleHash,
  composeOwnerReplySubject,
  parseOwnerConsoleHash,
} from './ownerConsoleRouting';
import {
  isAnnouncementPubliclyVisible,
  validateAnnouncementDraft,
} from './announcementValidation';
import { validateAndNormalizePhone } from './phoneValidation';
import { doesRoleMatchSkill, normalizeSelectedSkills } from './skillMatcher';
import { parseCvShareSearch, buildCvShareUrl, DEFAULT_CV_SECTION_ORDER } from './cvShareConfig';
import { sanitizeContactMessageLogPayload } from './contactMessageLogValidation';
import { sanitizeCvDownloadLogPayload } from './cvDownloadLogValidation';
import { buildOwnerAlerts, computeFunnelSnapshot } from './ownerTracking';
import type { ExperienceRole } from '../data/portfolioData';

describe('portfolio feature matrix', () => {
  describe('owner console routing', () => {
    it('opens chat, messages, announcements, and settings sections', () => {
      expect(parseOwnerConsoleHash('#owner/chat')).toEqual({ open: true, section: 'chat' });
      expect(parseOwnerConsoleHash('#owner/messages')).toEqual({ open: true, section: 'messages' });
      expect(parseOwnerConsoleHash('#owner/announcements')).toEqual({
        open: true,
        section: 'announcements',
      });
      expect(buildOwnerConsoleHash('settings')).toBe('#owner/settings');
      expect(composeOwnerReplySubject('Hello')).toBe('Re: Hello');
    });
  });

  describe('portfolio settings + incident mode', () => {
    it('disables chat/contact/CV when incident mode is on', () => {
      const effective = getEffectivePortfolioSettings(
        sanitizePortfolioSettings({
          ...DEFAULT_PORTFOLIO_SETTINGS,
          incidentMode: true,
          enablePortfolioChat: true,
          enableLiveChat: true,
          enableChatLlm: true,
          enableContactForm: true,
          enableCvDownloads: true,
        })
      );
      expect(effective.incidentMode).toBe(true);
      expect(effective.enablePortfolioChat).toBe(false);
      expect(effective.enableLiveChat).toBe(false);
      expect(effective.enableChatLlm).toBe(false);
      expect(effective.enableContactForm).toBe(false);
      expect(effective.enableCvDownloads).toBe(false);
      expect(effective.enableAnnouncements).toBe(false);
      expect(effective.enableResumeStudio).toBe(false);
      expect(effective.enableCommandPalette).toBe(false);
      expect(effective.enableSiteTelemetry).toBe(false);
    });

    it('allows owner to disable individual visitor features', () => {
      const sanitized = sanitizePortfolioSettings({
        enableAnnouncements: false,
        enableTerminal: false,
        enablePwaInstall: false,
        enableScrollHud: false,
      });
      expect(sanitized.enableAnnouncements).toBe(false);
      expect(sanitized.enableTerminal).toBe(false);
      expect(sanitized.enablePwaInstall).toBe(false);
      expect(sanitized.enableScrollHud).toBe(false);
      expect(sanitized.enableDigitalCard).toBe(true);
    });

    it('clamps chat rate window and live session caps', () => {
      const sanitized = sanitizePortfolioSettings({
        chatRateWindowHours: 999,
        chatMaxLiveSessionsPerVisitor: 999,
        chatOfferLiveAgent: false,
        chatShowSuggestions: false,
      });
      expect(sanitized.chatRateWindowHours).toBe(168);
      expect(sanitized.chatMaxLiveSessionsPerVisitor).toBe(50);
      expect(sanitized.chatOfferLiveAgent).toBe(false);
      expect(sanitized.chatShowSuggestions).toBe(false);
    });
  });

  describe('access rules', () => {
    it('blocks matching emails while allowing others', () => {
      const decision = evaluateAccessRules(
        [{ ruleType: 'block', matchType: 'email', value: 'spam@evil.com' }],
        { email: 'spam@evil.com', ipAddress: '1.2.3.4' }
      );
      expect(decision.blocked).toBe(true);
      const open = evaluateAccessRules(
        [{ ruleType: 'block', matchType: 'email', value: 'spam@evil.com' }],
        { email: 'recruiter@cisco.com', ipAddress: '1.2.3.4' }
      );
      expect(open.blocked).toBe(false);
    });
  });

  describe('announcements', () => {
    it('accepts published announcement drafts and hides drafts from public view', () => {
      const ok = validateAnnouncementDraft({
        date: 'Mar 2026',
        title: 'Portfolio chat live',
        summary: 'OTP-gated recruiter chat with grounded answers.',
        badge: 'VERIFIED',
        linkUrl: 'https://www.mohammedsufyan.com/',
        status: 'published',
        scheduledAtMs: null,
      });
      expect(ok.valid).toBe(true);
      expect(
        isAnnouncementPubliclyVisible({ status: 'draft', scheduledAtMs: null }, Date.now())
      ).toBe(false);
      expect(
        isAnnouncementPubliclyVisible({ status: 'published', scheduledAtMs: null }, Date.now())
      ).toBe(true);
    });
  });

  describe('CV share / phone / skills', () => {
    it('parses CV share links and validates phones', () => {
      const parsed = parseCvShareSearch('?cv=security&theme=light');
      expect(parsed.shouldOpen).toBe(true);
      expect(parsed.preset).toBe('security');
      const url = buildCvShareUrl({
        baseHref: 'https://www.mohammedsufyan.com/',
        preset: 'security',
        theme: 'dark',
        density: 'executive',
        accent: 'cyan',
        showInfographics: true,
        sectionOrder: DEFAULT_CV_SECTION_ORDER,
        sections: {
          overview: true,
          philosophy: true,
          experience: true,
          skills: true,
          certifications: true,
          awards: true,
          education: true,
        },
      });
      expect(url).toContain('cv=security');

      const phone = validateAndNormalizePhone('(408) 622-9481', 'US');
      expect(phone.valid).toBe(true);
      expect(phone.normalizedE164).toBe('+14086229481');
    });

    it('matches skills on experience roles', () => {
      const role: ExperienceRole = {
        role: 'Software Engineer',
        period: '2026',
        location: 'San Jose',
        highlights: ['Built Project Atlas'],
        technologies: ['Python (Programming Language)', 'Databricks'],
      };
      expect(normalizeSelectedSkills([' Python ', 'python'])).toEqual(['Python']);
      expect(doesRoleMatchSkill(role, 'Python')).toBe(true);
    });
  });

  describe('telemetry sanitizers + owner tracking', () => {
    it('rejects incomplete contact and CV logs', () => {
      expect(sanitizeContactMessageLogPayload({ messageId: 'MSG-1' })).toBeNull();
      expect(sanitizeCvDownloadLogPayload({ downloadId: 'CV-1' })).toBeNull();
    });

    it('builds funnel and alerts from empty inputs safely', () => {
      const now = Date.now();
      const funnel = computeFunnelSnapshot([], [], 30, now);
      expect(funnel.contactMessages).toBe(0);
      expect(funnel.cvExports).toBe(0);
      const alerts = buildOwnerAlerts({ messages: [], downloads: [], nowMs: now });
      expect(Array.isArray(alerts)).toBe(true);
    });
  });
});
