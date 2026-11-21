export const OWNER_EMAIL = 'sufyan.net@gmail.com';

export const ANNOUNCEMENT_BADGES = [
  'VERIFIED',
  'MILESTONE',
  'CERTIFICATION',
  'AWARD',
  'PUBLICATION',
] as const;

export type AnnouncementBadge = (typeof ANNOUNCEMENT_BADGES)[number];

export const ANNOUNCEMENT_CONSTRAINTS = {
  idMinLength: 1,
  idMaxLength: 128,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  dateMinLength: 3,
  dateMaxLength: 40,
  titleMinLength: 3,
  titleMaxLength: 180,
  summaryMinLength: 10,
  summaryMaxLength: 600,
  linkUrlMaxLength: 300,
  linkUrlPattern: /^$|^https:\/\/[^\s]+$/,
} as const;

export const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export interface AnnouncementDraft {
  date: string;
  title: string;
  summary: string;
  badge: AnnouncementBadge;
  linkUrl: string;
  status: AnnouncementStatus;
  /** Epoch ms when a scheduled item should become public; null when not scheduled. */
  scheduledAtMs: number | null;
}

export interface AnnouncementRecord extends AnnouncementDraft {
  id: string;
  source: 'starter' | 'cloud';
}

export function isPortfolioOwner(
  user: { email?: string | null; emailVerified?: boolean } | null | undefined
): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return user.email.toLowerCase() === OWNER_EMAIL;
}

export function sanitizeAnnouncementDraft(input: {
  date: string;
  title: string;
  summary: string;
  badge?: string;
  linkUrl?: string;
  status?: string;
  scheduledAtMs?: number | null;
}): AnnouncementDraft {
  const cleanBadge = (ANNOUNCEMENT_BADGES as readonly string[]).includes(input.badge || '')
    ? (input.badge as AnnouncementBadge)
    : 'VERIFIED';

  const cleanDate = input.date.trim().slice(0, ANNOUNCEMENT_CONSTRAINTS.dateMaxLength);
  const cleanTitle = input.title.trim().slice(0, ANNOUNCEMENT_CONSTRAINTS.titleMaxLength);
  const cleanSummary = input.summary.trim().slice(0, ANNOUNCEMENT_CONSTRAINTS.summaryMaxLength);
  const cleanLinkUrl = (input.linkUrl || '').trim().slice(0, ANNOUNCEMENT_CONSTRAINTS.linkUrlMaxLength);
  const status: AnnouncementStatus =
    input.status === 'draft' || input.status === 'scheduled' || input.status === 'published'
      ? input.status
      : 'published';
  const scheduledAtMs =
    status === 'scheduled' &&
    typeof input.scheduledAtMs === 'number' &&
    Number.isFinite(input.scheduledAtMs) &&
    input.scheduledAtMs > 0
      ? Math.floor(input.scheduledAtMs)
      : null;

  return {
    date: cleanDate,
    title: cleanTitle,
    summary: cleanSummary,
    badge: cleanBadge,
    linkUrl: cleanLinkUrl,
    status: status === 'scheduled' && !scheduledAtMs ? 'draft' : status,
    scheduledAtMs: status === 'scheduled' ? scheduledAtMs : null,
  };
}

export function validateAnnouncementDraft(input: {
  date: string;
  title: string;
  summary: string;
  badge?: string;
  linkUrl?: string;
  status?: string;
  scheduledAtMs?: number | null;
}): {
  valid: boolean;
  errors: string[];
  normalized: AnnouncementDraft;
} {
  const normalized = sanitizeAnnouncementDraft(input);
  const errors: string[] = [];

  if (normalized.date.length < ANNOUNCEMENT_CONSTRAINTS.dateMinLength) {
    errors.push(`Date must be at least ${ANNOUNCEMENT_CONSTRAINTS.dateMinLength} characters (e.g. NOVEMBER 2026).`);
  }
  if (normalized.title.length < ANNOUNCEMENT_CONSTRAINTS.titleMinLength) {
    errors.push(`Title must be at least ${ANNOUNCEMENT_CONSTRAINTS.titleMinLength} characters.`);
  }
  if (normalized.summary.length < ANNOUNCEMENT_CONSTRAINTS.summaryMinLength) {
    errors.push(`Summary must be at least ${ANNOUNCEMENT_CONSTRAINTS.summaryMinLength} characters.`);
  }
  if (
    normalized.linkUrl.length > 0 &&
    !ANNOUNCEMENT_CONSTRAINTS.linkUrlPattern.test(normalized.linkUrl)
  ) {
    errors.push('Reference URL must start with https:// and contain no spaces.');
  }
  if (normalized.status === 'scheduled' && !normalized.scheduledAtMs) {
    errors.push('Scheduled announcements require a future publish time.');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
}

/** Whether an announcement should appear on the public portfolio right now. */
export function isAnnouncementPubliclyVisible(
  item: Pick<AnnouncementDraft, 'status' | 'scheduledAtMs'>,
  nowMs = Date.now()
): boolean {
  if (item.status === 'published') return true;
  if (item.status === 'scheduled' && item.scheduledAtMs != null && item.scheduledAtMs <= nowMs) {
    return true;
  }
  return false;
}

export function generateAnnouncementId(): string {
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  return `ann-${Date.now()}-${randomSuffix}`;
}

export function defaultMonthYearLabel(now = new Date()): string {
  try {
    return now
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      .toUpperCase();
  } catch {
    return 'NOVEMBER 2026';
  }
}
