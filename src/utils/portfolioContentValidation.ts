import type { Award, Certification, Recommendation } from '../data/portfolioData';

export const PORTFOLIO_CERT_CATEGORIES = ['ai', 'cloud', 'data'] as const;
export type PortfolioCertCategory = (typeof PORTFOLIO_CERT_CATEGORIES)[number];

export const PORTFOLIO_REC_TYPES = ['manager', 'direct_report', 'peer'] as const;
export type PortfolioRecType = (typeof PORTFOLIO_REC_TYPES)[number];

export const PORTFOLIO_PUBLISH_TARGETS = [
  'announcements',
  'certifications',
  'awards',
  'recommendations',
  'disciplines',
  'ciscoRole',
] as const;
export type PortfolioPublishTarget = (typeof PORTFOLIO_PUBLISH_TARGETS)[number];

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function generatePortfolioEntityId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function cleanId(id: string): string {
  return id.trim().slice(0, 128);
}

function defaultBadgeColor(category: PortfolioCertCategory): string {
  if (category === 'cloud') return 'border-sky-500/40 text-sky-300';
  if (category === 'data') return 'border-emerald-500/40 text-emerald-300';
  return 'border-cyan-500/40 text-cyan-300';
}

export interface CertificationDraft {
  title: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  credentialId: string;
  credentialUrl: string;
  category: PortfolioCertCategory;
  skills: string[];
  sourceAnnouncementId?: string;
}

export interface AwardDraft {
  title: string;
  organization: string;
  date: string;
  category: string;
  description: string;
  associatedWith: string;
  sourceAnnouncementId?: string;
}

export interface RecommendationDraft {
  author: string;
  role: string;
  date: string;
  relationship: string;
  relationshipType: PortfolioRecType;
  quote: string;
  featured: boolean;
  sourceAnnouncementId?: string;
}

export interface DisciplineDraft {
  title: string;
  status: string;
  description: string;
  technologies: string[];
  level: number;
  sourceAnnouncementId?: string;
}

export interface CiscoRoleDraft {
  domain: string;
  proofMetric: string;
  recognitionBadge: string;
  highlights: string[];
  technologies: string[];
  sourceAnnouncementId?: string;
}

export function sanitizeCertificationDraft(input: Partial<CertificationDraft>): CertificationDraft {
  const category = (PORTFOLIO_CERT_CATEGORIES as readonly string[]).includes(input.category || '')
    ? (input.category as PortfolioCertCategory)
    : 'cloud';
  const skills = Array.isArray(input.skills)
    ? input.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 12)
    : [];
  return {
    title: String(input.title || '').trim().slice(0, 180),
    issuer: String(input.issuer || '').trim().slice(0, 120),
    issueDate: String(input.issueDate || '').trim().slice(0, 40),
    expiryDate: String(input.expiryDate || '').trim().slice(0, 40),
    credentialId: String(input.credentialId || '').trim().slice(0, 120),
    credentialUrl: String(input.credentialUrl || '').trim().slice(0, 300),
    category,
    skills,
    sourceAnnouncementId: input.sourceAnnouncementId
      ? cleanId(String(input.sourceAnnouncementId))
      : undefined,
  };
}

export function validateCertificationDraft(input: Partial<CertificationDraft>): {
  valid: boolean;
  errors: string[];
  normalized: CertificationDraft;
} {
  const normalized = sanitizeCertificationDraft(input);
  const errors: string[] = [];
  if (normalized.title.length < 3) errors.push('Certification title must be at least 3 characters.');
  if (normalized.issuer.length < 2) errors.push('Issuer is required.');
  if (normalized.issueDate.length < 3) errors.push('Issue date is required (e.g. NOV 2026).');
  if (
    normalized.credentialUrl &&
    !/^https:\/\/[^\s]+$/.test(normalized.credentialUrl)
  ) {
    errors.push('Credential URL must be https://… or empty.');
  }
  return { valid: errors.length === 0, errors, normalized };
}

export function certificationDraftToRecord(
  id: string,
  draft: CertificationDraft
): Certification & { sourceAnnouncementId?: string; source: 'cloud' } {
  return {
    id,
    title: draft.title,
    issuer: draft.issuer,
    issueDate: draft.issueDate,
    expiryDate: draft.expiryDate || undefined,
    credentialId: draft.credentialId || undefined,
    credentialUrl: draft.credentialUrl || undefined,
    category: draft.category,
    badgeColor: defaultBadgeColor(draft.category),
    skills: draft.skills,
    sourceAnnouncementId: draft.sourceAnnouncementId,
    source: 'cloud',
  };
}

export function sanitizeAwardDraft(input: Partial<AwardDraft>): AwardDraft {
  return {
    title: String(input.title || '').trim().slice(0, 180),
    organization: String(input.organization || '').trim().slice(0, 120),
    date: String(input.date || '').trim().slice(0, 40),
    category: String(input.category || '').trim().slice(0, 80),
    description: String(input.description || '').trim().slice(0, 600),
    associatedWith: String(input.associatedWith || '').trim().slice(0, 80),
    sourceAnnouncementId: input.sourceAnnouncementId
      ? cleanId(String(input.sourceAnnouncementId))
      : undefined,
  };
}

export function validateAwardDraft(input: Partial<AwardDraft>): {
  valid: boolean;
  errors: string[];
  normalized: AwardDraft;
} {
  const normalized = sanitizeAwardDraft(input);
  const errors: string[] = [];
  if (normalized.title.length < 3) errors.push('Award title must be at least 3 characters.');
  if (normalized.organization.length < 2) errors.push('Organization is required.');
  if (normalized.date.length < 3) errors.push('Date is required.');
  if (normalized.description.length < 10) errors.push('Description must be at least 10 characters.');
  return { valid: errors.length === 0, errors, normalized };
}

export function awardDraftToRecord(
  id: string,
  draft: AwardDraft
): Award & { sourceAnnouncementId?: string; source: 'cloud' } {
  return {
    id,
    title: draft.title,
    organization: draft.organization,
    date: draft.date,
    category: draft.category || 'Recognition',
    description: draft.description,
    associatedWith: draft.associatedWith || undefined,
    sourceAnnouncementId: draft.sourceAnnouncementId,
    source: 'cloud',
  };
}

export function sanitizeRecommendationDraft(
  input: Partial<RecommendationDraft>
): RecommendationDraft {
  const relationshipType = (PORTFOLIO_REC_TYPES as readonly string[]).includes(
    input.relationshipType || ''
  )
    ? (input.relationshipType as PortfolioRecType)
    : 'peer';
  return {
    author: String(input.author || '').trim().slice(0, 120),
    role: String(input.role || '').trim().slice(0, 160),
    date: String(input.date || '').trim().slice(0, 40),
    relationship: String(input.relationship || '').trim().slice(0, 160),
    relationshipType,
    quote: String(input.quote || '').trim().slice(0, 2000),
    featured: Boolean(input.featured),
    sourceAnnouncementId: input.sourceAnnouncementId
      ? cleanId(String(input.sourceAnnouncementId))
      : undefined,
  };
}

export function validateRecommendationDraft(input: Partial<RecommendationDraft>): {
  valid: boolean;
  errors: string[];
  normalized: RecommendationDraft;
} {
  const normalized = sanitizeRecommendationDraft(input);
  const errors: string[] = [];
  if (normalized.author.length < 2) errors.push('Author name is required.');
  if (normalized.role.length < 2) errors.push('Author role is required.');
  if (normalized.date.length < 3) errors.push('Date is required.');
  if (normalized.quote.length < 20) errors.push('Quote must be at least 20 characters.');
  return { valid: errors.length === 0, errors, normalized };
}

export function recommendationDraftToRecord(
  id: string,
  draft: RecommendationDraft
): Recommendation & { sourceAnnouncementId?: string; source: 'cloud' } {
  return {
    id,
    author: draft.author,
    role: draft.role,
    date: draft.date,
    relationship: draft.relationship || 'Worked with Mohammed',
    relationshipType: draft.relationshipType,
    quote: draft.quote,
    featured: draft.featured,
    sourceAnnouncementId: draft.sourceAnnouncementId,
    source: 'cloud',
  };
}

export function sanitizeDisciplineDraft(input: Partial<DisciplineDraft>): DisciplineDraft {
  const technologies = Array.isArray(input.technologies)
    ? input.technologies.map((t) => String(t).trim()).filter(Boolean).slice(0, 24)
    : [];
  const levelRaw = Number(input.level);
  const level = Number.isFinite(levelRaw) ? Math.min(100, Math.max(1, Math.round(levelRaw))) : 90;
  return {
    title: String(input.title || '').trim().slice(0, 120),
    status: String(input.status || '').trim().slice(0, 40) || 'CUSTOM',
    description: String(input.description || '').trim().slice(0, 400),
    technologies,
    level,
    sourceAnnouncementId: input.sourceAnnouncementId
      ? cleanId(String(input.sourceAnnouncementId))
      : undefined,
  };
}

export function validateDisciplineDraft(input: Partial<DisciplineDraft>): {
  valid: boolean;
  errors: string[];
  normalized: DisciplineDraft;
} {
  const normalized = sanitizeDisciplineDraft(input);
  const errors: string[] = [];
  if (normalized.title.length < 3) errors.push('Discipline title must be at least 3 characters.');
  if (normalized.description.length < 10) errors.push('Description must be at least 10 characters.');
  if (normalized.technologies.length < 1) errors.push('Add at least one technology tag.');
  return { valid: errors.length === 0, errors, normalized };
}

export function sanitizeCiscoRoleDraft(input: Partial<CiscoRoleDraft>): CiscoRoleDraft {
  const highlights = Array.isArray(input.highlights)
    ? input.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 12)
    : [];
  const technologies = Array.isArray(input.technologies)
    ? input.technologies.map((t) => String(t).trim()).filter(Boolean).slice(0, 24)
    : [];
  return {
    domain: String(input.domain || '').trim().slice(0, 200),
    proofMetric: String(input.proofMetric || '').trim().slice(0, 200),
    recognitionBadge: String(input.recognitionBadge || '').trim().slice(0, 160),
    highlights,
    technologies,
    sourceAnnouncementId: input.sourceAnnouncementId
      ? cleanId(String(input.sourceAnnouncementId))
      : undefined,
  };
}

export function validateCiscoRoleDraft(input: Partial<CiscoRoleDraft>): {
  valid: boolean;
  errors: string[];
  normalized: CiscoRoleDraft;
} {
  const normalized = sanitizeCiscoRoleDraft(input);
  const errors: string[] = [];
  if (normalized.highlights.length < 1 && !normalized.domain && !normalized.proofMetric) {
    errors.push('Add at least one highlight, domain, or proof metric.');
  }
  for (const h of normalized.highlights) {
    if (h.length < 10) errors.push('Each highlight must be at least 10 characters.');
  }
  return { valid: errors.length === 0, errors, normalized };
}

export function isValidPortfolioEntityId(id: string): boolean {
  return ID_PATTERN.test(id) && id.length >= 1 && id.length <= 128;
}

/** Map announcement fields into a certification starter draft. */
export function announcementToCertificationDraft(input: {
  title: string;
  summary: string;
  date: string;
  linkUrl?: string;
  announcementId?: string;
}): CertificationDraft {
  return sanitizeCertificationDraft({
    title: input.title,
    issuer: 'Pending issuer',
    issueDate: input.date,
    credentialUrl: input.linkUrl || '',
    category: 'cloud',
    skills: [],
    sourceAnnouncementId: input.announcementId,
  });
}

export function announcementToAwardDraft(input: {
  title: string;
  summary: string;
  date: string;
  announcementId?: string;
}): AwardDraft {
  return sanitizeAwardDraft({
    title: input.title,
    organization: 'Pending organization',
    date: input.date,
    category: 'Milestone',
    description: input.summary,
    associatedWith: '',
    sourceAnnouncementId: input.announcementId,
  });
}
