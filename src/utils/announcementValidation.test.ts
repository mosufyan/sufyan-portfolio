import { describe, expect, it } from 'vitest';
import {
  ANNOUNCEMENT_CONSTRAINTS,
  generateAnnouncementId,
  isAnnouncementPubliclyVisible,
  isPortfolioOwner,
  validateAnnouncementDraft,
} from './announcementValidation';

describe('announcementValidation', () => {
  it('accepts a valid announcement draft with optional https link', () => {
    const result = validateAnnouncementDraft({
      date: '  NOVEMBER 2026 ',
      title: '  Published Zero Trust Security Blueprint  ',
      summary: 'Released architecture blueprint covering multi-cloud ingestion pipelines.',
      badge: 'PUBLICATION',
      linkUrl: 'https://www.mohammedsufyan.com/',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.normalized.date).toBe('NOVEMBER 2026');
    expect(result.normalized.badge).toBe('PUBLICATION');
  });

  it('rejects insecure javascript: or http:// reference URLs', () => {
    const jsUrl = validateAnnouncementDraft({
      date: 'NOVEMBER 2026',
      title: 'Test Title',
      summary: 'Valid summary description with sufficient characters.',
      linkUrl: 'javascript:alert(1)',
    });
    expect(jsUrl.valid).toBe(false);
    expect(jsUrl.errors.some((e) => e.includes('https://'))).toBe(true);

    const httpUrl = validateAnnouncementDraft({
      date: 'NOVEMBER 2026',
      title: 'Test Title',
      summary: 'Valid summary description with sufficient characters.',
      linkUrl: 'http://example.com',
    });
    expect(httpUrl.valid).toBe(false);
  });

  it('truncates oversized fields to blueprint boundaries and falls back unknown badges', () => {
    const result = validateAnnouncementDraft({
      date: 'NOVEMBER 2026',
      title: 'A'.repeat(250),
      summary: 'B'.repeat(700),
      badge: 'FAKE_BADGE',
      linkUrl: '',
    });
    expect(result.valid).toBe(true);
    expect(result.normalized.title.length).toBe(ANNOUNCEMENT_CONSTRAINTS.titleMaxLength);
    expect(result.normalized.summary.length).toBe(ANNOUNCEMENT_CONSTRAINTS.summaryMaxLength);
    expect(result.normalized.badge).toBe('VERIFIED');
  });

  it('verifies owner strictly by verified email match', () => {
    expect(isPortfolioOwner({ email: 'sufyan.net@gmail.com', emailVerified: true })).toBe(true);
    expect(isPortfolioOwner({ email: 'sufyan.net@gmail.com', emailVerified: false })).toBe(false);
    expect(isPortfolioOwner({ email: 'other@example.com', emailVerified: true })).toBe(false);
    expect(isPortfolioOwner(null)).toBe(false);
  });

  it('generates Firestore-safe IDs matching security rule regex', () => {
    const id = generateAnnouncementId();
    expect(ANNOUNCEMENT_CONSTRAINTS.idPattern.test(id)).toBe(true);
    expect(id.length).toBeLessThanOrEqual(ANNOUNCEMENT_CONSTRAINTS.idMaxLength);
  });

  it('defaults status to published and gates public visibility', () => {
    const published = validateAnnouncementDraft({
      date: 'NOVEMBER 2026',
      title: 'Test Title',
      summary: 'Valid summary description with sufficient characters.',
      linkUrl: '',
    });
    expect(published.normalized.status).toBe('published');
    expect(isAnnouncementPubliclyVisible(published.normalized)).toBe(true);

    const draft = validateAnnouncementDraft({
      date: 'NOVEMBER 2026',
      title: 'Draft Title',
      summary: 'Valid summary description with sufficient characters.',
      status: 'draft',
    });
    expect(isAnnouncementPubliclyVisible(draft.normalized)).toBe(false);

    const due = Date.now() - 1000;
    const scheduled = validateAnnouncementDraft({
      date: 'NOVEMBER 2026',
      title: 'Scheduled Title',
      summary: 'Valid summary description with sufficient characters.',
      status: 'scheduled',
      scheduledAtMs: due,
    });
    expect(scheduled.valid).toBe(true);
    expect(isAnnouncementPubliclyVisible(scheduled.normalized, due + 10)).toBe(true);
  });
});
