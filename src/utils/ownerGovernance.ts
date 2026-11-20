export const ADMIN_AUDIT_EVENTS = [
  'owner_login',
  'owner_logout',
  'settings_updated',
  'rule_created',
  'rule_deleted',
  'triage_updated',
  'announcement_mutated',
] as const;

export type AdminAuditEventType = (typeof ADMIN_AUDIT_EVENTS)[number];

export const ADMIN_AUDIT_CONSTRAINTS = {
  idMinLength: 4,
  idMaxLength: 64,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  emailMinLength: 3,
  emailMaxLength: 254,
  uidMinLength: 1,
  uidMaxLength: 128,
  summaryMinLength: 3,
  summaryMaxLength: 240,
  userAgentMaxLength: 220,
  timezoneMaxLength: 64,
  hostnameMaxLength: 120,
} as const;

export interface AdminAuditLogPayload {
  auditId: string;
  eventType: AdminAuditEventType;
  actorEmail: string;
  actorUid: string;
  summary: string;
  userAgent: string;
  timezone: string;
  hostname: string;
}

export interface AdminAuditLogRecord extends AdminAuditLogPayload {
  createdAtMs: number;
  createdAtIso: string;
}

export const PORTFOLIO_AVAILABILITY_STATUSES = ['open', 'advisory', 'unavailable'] as const;
export type AvailabilityStatus = (typeof PORTFOLIO_AVAILABILITY_STATUSES)[number];

export const PORTFOLIO_SETTINGS_CONSTRAINTS = {
  availabilityTextMaxLength: 140,
  maintenanceMessageMaxLength: 300,
  uidMinLength: 1,
  uidMaxLength: 128,
} as const;

export interface PortfolioSettings {
  availabilityStatus: AvailabilityStatus;
  availabilityText: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enableContactForm: boolean;
  enableCvDownloads: boolean;
  strictOtpForAll: boolean;
  showAnnouncementsBadge: boolean;
}

export const DEFAULT_PORTFOLIO_SETTINGS: PortfolioSettings = {
  availabilityStatus: 'open',
  availabilityText: '',
  maintenanceMode: false,
  maintenanceMessage:
    'Scheduled portfolio enhancements are currently in progress. Direct email outreach remains active.',
  enableContactForm: true,
  enableCvDownloads: true,
  strictOtpForAll: false,
  showAnnouncementsBadge: true,
};

export const ACCESS_RULE_TYPES = ['allow', 'block'] as const;
export type AccessRuleType = (typeof ACCESS_RULE_TYPES)[number];

export const ACCESS_RULE_MATCH_TYPES = ['email', 'domain', 'ip'] as const;
export type AccessRuleMatchType = (typeof ACCESS_RULE_MATCH_TYPES)[number];

export const ACCESS_RULE_CONSTRAINTS = {
  idMinLength: 4,
  idMaxLength: 64,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  valueMinLength: 2,
  valueMaxLength: 254,
  noteMaxLength: 200,
  uidMinLength: 1,
  uidMaxLength: 128,
} as const;

export interface AccessRuleDraft {
  ruleType: AccessRuleType;
  matchType: AccessRuleMatchType;
  value: string;
  note?: string;
}

export interface AccessRuleRecord {
  ruleId: string;
  ruleType: AccessRuleType;
  matchType: AccessRuleMatchType;
  value: string;
  note: string;
  createdByUid: string;
  createdAtMs: number;
  createdAtIso: string;
}

function clampString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

export function generateAuditId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AUD-${Date.now().toString(36).toUpperCase()}-${rand}`.slice(0, 64);
}

export function generateRuleId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RULE-${Date.now().toString(36).toUpperCase()}-${rand}`.slice(0, 64);
}

export function sanitizeAdminAuditPayload(input: {
  auditId?: string;
  eventType: AdminAuditEventType;
  actorEmail: string;
  actorUid: string;
  summary: string;
  userAgent?: string;
  timezone?: string;
  hostname?: string;
}): AdminAuditLogPayload | null {
  const auditId = clampString(input.auditId || generateAuditId(), ADMIN_AUDIT_CONSTRAINTS.idMaxLength);
  if (
    auditId.length < ADMIN_AUDIT_CONSTRAINTS.idMinLength ||
    !ADMIN_AUDIT_CONSTRAINTS.idPattern.test(auditId)
  ) {
    return null;
  }

  const actorEmail = clampString(input.actorEmail, ADMIN_AUDIT_CONSTRAINTS.emailMaxLength);
  const actorUid = clampString(input.actorUid, ADMIN_AUDIT_CONSTRAINTS.uidMaxLength);
  const summary = clampString(input.summary, ADMIN_AUDIT_CONSTRAINTS.summaryMaxLength);

  if (
    actorEmail.length < ADMIN_AUDIT_CONSTRAINTS.emailMinLength ||
    actorUid.length < ADMIN_AUDIT_CONSTRAINTS.uidMinLength ||
    summary.length < ADMIN_AUDIT_CONSTRAINTS.summaryMinLength
  ) {
    return null;
  }

  const eventType: AdminAuditEventType = ADMIN_AUDIT_EVENTS.includes(input.eventType)
    ? input.eventType
    : 'owner_login';

  return {
    auditId,
    eventType,
    actorEmail,
    actorUid,
    summary,
    userAgent: clampString(input.userAgent || '', ADMIN_AUDIT_CONSTRAINTS.userAgentMaxLength),
    timezone: clampString(input.timezone || '', ADMIN_AUDIT_CONSTRAINTS.timezoneMaxLength),
    hostname: clampString(input.hostname || '', ADMIN_AUDIT_CONSTRAINTS.hostnameMaxLength),
  };
}

export function sanitizePortfolioSettings(input: Partial<PortfolioSettings> | null | undefined): PortfolioSettings {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_PORTFOLIO_SETTINGS };
  }

  const availabilityStatus: AvailabilityStatus =
    input.availabilityStatus === 'advisory' || input.availabilityStatus === 'unavailable'
      ? input.availabilityStatus
      : 'open';

  return {
    availabilityStatus,
    availabilityText: clampString(
      input.availabilityText ?? DEFAULT_PORTFOLIO_SETTINGS.availabilityText,
      PORTFOLIO_SETTINGS_CONSTRAINTS.availabilityTextMaxLength
    ),
    maintenanceMode: Boolean(input.maintenanceMode),
    maintenanceMessage:
      clampString(
        input.maintenanceMessage ?? DEFAULT_PORTFOLIO_SETTINGS.maintenanceMessage,
        PORTFOLIO_SETTINGS_CONSTRAINTS.maintenanceMessageMaxLength
      ) || DEFAULT_PORTFOLIO_SETTINGS.maintenanceMessage,
    enableContactForm:
      typeof input.enableContactForm === 'boolean'
        ? input.enableContactForm
        : DEFAULT_PORTFOLIO_SETTINGS.enableContactForm,
    enableCvDownloads:
      typeof input.enableCvDownloads === 'boolean'
        ? input.enableCvDownloads
        : DEFAULT_PORTFOLIO_SETTINGS.enableCvDownloads,
    strictOtpForAll: Boolean(input.strictOtpForAll),
    showAnnouncementsBadge:
      typeof input.showAnnouncementsBadge === 'boolean'
        ? input.showAnnouncementsBadge
        : DEFAULT_PORTFOLIO_SETTINGS.showAnnouncementsBadge,
  };
}

export function normalizeRuleValue(matchType: AccessRuleMatchType, rawValue: string): string {
  const trimmed = rawValue.trim().toLowerCase().slice(0, ACCESS_RULE_CONSTRAINTS.valueMaxLength);
  if (matchType === 'domain') {
    return trimmed.replace(/^@+/, '').replace(/^https?:\/\//, '').split('/')[0] || '';
  }
  return trimmed;
}

export function validateAccessRuleDraft(draft: AccessRuleDraft): {
  valid: boolean;
  error?: string;
  normalized?: {
    ruleType: AccessRuleType;
    matchType: AccessRuleMatchType;
    value: string;
    note: string;
  };
} {
  const ruleType: AccessRuleType = draft.ruleType === 'allow' ? 'allow' : 'block';
  const matchType: AccessRuleMatchType =
    draft.matchType === 'email' || draft.matchType === 'domain' || draft.matchType === 'ip'
      ? draft.matchType
      : 'domain';
  const value = normalizeRuleValue(matchType, draft.value || '');
  const note = clampString(draft.note || '', ACCESS_RULE_CONSTRAINTS.noteMaxLength);

  if (value.length < ACCESS_RULE_CONSTRAINTS.valueMinLength) {
    return { valid: false, error: 'Rule target must be at least 2 characters.' };
  }
  if (/\s/.test(value)) {
    return { valid: false, error: 'Rule value cannot contain whitespace.' };
  }
  if (matchType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  if (matchType === 'domain' && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) {
    return { valid: false, error: 'Please enter a valid domain name (e.g. cisco.com).' };
  }
  if (matchType === 'ip' && !/^[0-9a-fA-F:.]+$/.test(value)) {
    return { valid: false, error: 'Please enter a valid IPv4 or IPv6 address.' };
  }

  return {
    valid: true,
    normalized: { ruleType, matchType, value, note },
  };
}

export interface CompactAccessRule {
  ruleType: AccessRuleType;
  matchType: AccessRuleMatchType;
  value: string;
  note?: string;
}

export function evaluateAccessRules(
  rules: CompactAccessRule[],
  context: { email?: string; ipAddress?: string }
): {
  blocked: boolean;
  allowlisted: boolean;
  matchedRule: CompactAccessRule | null;
} {
  const cleanEmail = (context.email || '').trim().toLowerCase();
  const emailDomain = cleanEmail.includes('@') ? cleanEmail.split('@').pop() || '' : '';
  const cleanIp = (context.ipAddress || '').trim().toLowerCase();

  const matches = (rule: CompactAccessRule): boolean => {
    const val = rule.value.trim().toLowerCase();
    if (!val) return false;
    if (rule.matchType === 'ip') return Boolean(cleanIp && cleanIp === val);
    if (rule.matchType === 'email') return Boolean(cleanEmail && cleanEmail === val);
    if (rule.matchType === 'domain') {
      return Boolean(emailDomain && (emailDomain === val || emailDomain.endsWith(`.${val}`)));
    }
    return false;
  };

  // Block rules take precedence over allow rules
  for (const rule of rules) {
    if (rule.ruleType === 'block' && matches(rule)) {
      return { blocked: true, allowlisted: false, matchedRule: rule };
    }
  }

  for (const rule of rules) {
    if (rule.ruleType === 'allow' && matches(rule)) {
      return { blocked: false, allowlisted: true, matchedRule: rule };
    }
  }

  return { blocked: false, allowlisted: false, matchedRule: null };
}
