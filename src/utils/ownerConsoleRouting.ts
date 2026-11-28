export const OWNER_CMS_TABS = [
  'announcements',
  'credentials',
  'recognition',
  'recommendations',
  'disciplines',
  'experience',
] as const;

export type OwnerCmsTabId = (typeof OWNER_CMS_TABS)[number];

export const DEFAULT_OWNER_CMS_TAB: OwnerCmsTabId = 'announcements';

export const OWNER_CONSOLE_SECTIONS = [
  'profile',
  'funnel',
  'alerts',
  'chat',
  'downloads',
  'messages',
  'cms',
  'rules',
  'settings',
  'audit',
  'delegates',
] as const;

export type OwnerConsoleSectionId = (typeof OWNER_CONSOLE_SECTIONS)[number];

export const DEFAULT_OWNER_CONSOLE_SECTION: OwnerConsoleSectionId = 'profile';

export function isOwnerConsoleSection(value: string | null | undefined): value is OwnerConsoleSectionId {
  return Boolean(value && (OWNER_CONSOLE_SECTIONS as readonly string[]).includes(value));
}

export function isOwnerCmsTab(value: string | null | undefined): value is OwnerCmsTabId {
  return Boolean(value && (OWNER_CMS_TABS as readonly string[]).includes(value));
}

function normalizeLegacyCmsTab(value: string | null | undefined): OwnerCmsTabId | null {
  if (!value) return null;
  if (value === 'ciscoRole') return 'experience';
  if (isOwnerCmsTab(value)) return value;
  return null;
}

/** Parse `#owner/<section>` or `#owner/cms/<tab>` (also tolerates `#/owner/...`). */
export function parseOwnerConsoleHash(hash: string | null | undefined): {
  open: boolean;
  section: OwnerConsoleSectionId;
  cmsTab: OwnerCmsTabId;
} {
  const raw = (hash || '').replace(/^#/, '').trim();
  if (!raw) {
    return {
      open: false,
      section: DEFAULT_OWNER_CONSOLE_SECTION,
      cmsTab: DEFAULT_OWNER_CMS_TAB,
    };
  }

  const normalized = raw.replace(/^\/+/, '');
  if (!normalized.startsWith('owner')) {
    return {
      open: false,
      section: DEFAULT_OWNER_CONSOLE_SECTION,
      cmsTab: DEFAULT_OWNER_CMS_TAB,
    };
  }

  const parts = normalized.split('/').filter(Boolean);
  if (parts[0] !== 'owner') {
    return {
      open: false,
      section: DEFAULT_OWNER_CONSOLE_SECTION,
      cmsTab: DEFAULT_OWNER_CMS_TAB,
    };
  }

  const sectionPart = parts[1] || DEFAULT_OWNER_CONSOLE_SECTION;

  // New hub: #owner/cms or #owner/cms/experience
  if (sectionPart === 'cms') {
    return {
      open: true,
      section: 'cms',
      cmsTab: normalizeLegacyCmsTab(parts[2]) || DEFAULT_OWNER_CMS_TAB,
    };
  }

  // Legacy deep links: #owner/announcements, #owner/credentials, #owner/ciscoRole, …
  const legacyTab = normalizeLegacyCmsTab(sectionPart);
  if (legacyTab) {
    return { open: true, section: 'cms', cmsTab: legacyTab };
  }

  return {
    open: true,
    section: isOwnerConsoleSection(sectionPart) ? sectionPart : DEFAULT_OWNER_CONSOLE_SECTION,
    cmsTab: DEFAULT_OWNER_CMS_TAB,
  };
}

export function buildOwnerConsoleHash(
  section: OwnerConsoleSectionId = DEFAULT_OWNER_CONSOLE_SECTION,
  cmsTab: OwnerCmsTabId = DEFAULT_OWNER_CMS_TAB
): string {
  if (section === 'cms') {
    return `#owner/cms/${cmsTab}`;
  }
  return `#owner/${section}`;
}

export function writeOwnerConsoleHash(
  section: OwnerConsoleSectionId | null,
  historyMode: 'push' | 'replace' = 'replace',
  cmsTab: OwnerCmsTabId = DEFAULT_OWNER_CMS_TAB
): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!section) {
    if (url.hash.startsWith('#owner')) {
      url.hash = '';
    } else {
      return;
    }
  } else {
    url.hash = buildOwnerConsoleHash(section, cmsTab).slice(1);
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  if (historyMode === 'push') {
    window.history.pushState({}, '', next);
  } else {
    window.history.replaceState({}, '', next);
  }
}

export const OWNER_REPLY_TEMPLATES = [
  {
    id: 'thanks',
    label: 'Thanks — reviewing',
    body: 'Thanks for reaching out — I am reviewing your note and will follow up shortly.',
  },
  {
    id: 'chat',
    label: 'Prefer live chat',
    body: 'Happy to continue over the portfolio live chat if that is easier for a quick sync.',
  },
  {
    id: 'role',
    label: 'Role fit',
    body: 'Thanks for sharing the role details. I am interested and would welcome a deeper conversation on scope and timeline.',
  },
] as const;

export function composeOwnerReplySubject(subject: string): string {
  const trimmed = subject.trim();
  if (!trimmed) return 'Re: Portfolio inquiry';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}
