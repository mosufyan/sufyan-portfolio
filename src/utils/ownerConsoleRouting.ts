export const OWNER_CONSOLE_SECTIONS = [
  'profile',
  'downloads',
  'messages',
  'announcements',
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

/** Parse `#owner/<section>` (also tolerates `#/owner/<section>`). */
export function parseOwnerConsoleHash(hash: string | null | undefined): {
  open: boolean;
  section: OwnerConsoleSectionId;
} {
  const raw = (hash || '').replace(/^#/, '').trim();
  if (!raw) return { open: false, section: DEFAULT_OWNER_CONSOLE_SECTION };

  const normalized = raw.replace(/^\/+/, '');
  if (!normalized.startsWith('owner')) {
    return { open: false, section: DEFAULT_OWNER_CONSOLE_SECTION };
  }

  const parts = normalized.split('/').filter(Boolean);
  // ["owner"] or ["owner", "messages"]
  if (parts[0] !== 'owner') {
    return { open: false, section: DEFAULT_OWNER_CONSOLE_SECTION };
  }

  const sectionPart = parts[1] || DEFAULT_OWNER_CONSOLE_SECTION;
  return {
    open: true,
    section: isOwnerConsoleSection(sectionPart) ? sectionPart : DEFAULT_OWNER_CONSOLE_SECTION,
  };
}

export function buildOwnerConsoleHash(section: OwnerConsoleSectionId = DEFAULT_OWNER_CONSOLE_SECTION): string {
  return `#owner/${section}`;
}

export function writeOwnerConsoleHash(
  section: OwnerConsoleSectionId | null,
  historyMode: 'push' | 'replace' = 'replace'
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
    url.hash = buildOwnerConsoleHash(section).slice(1);
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
    body: 'Thanks for reaching out — I received your note and will review it shortly.',
  },
  {
    id: 'schedule',
    label: 'Happy to schedule',
    body: 'Appreciate the interest. Happy to schedule a short call — feel free to share a few times that work for you.',
  },
  {
    id: 'not-fit',
    label: 'Not a fit right now',
    body: 'Thank you for thinking of me. This opportunity is not the right fit for me right now, but I appreciate you reaching out.',
  },
] as const;

export function composeOwnerReplySubject(originalSubject: string): string {
  const clean = originalSubject.trim() || 'Portfolio inquiry';
  if (/^re:/i.test(clean)) return clean.slice(0, 200);
  return `Re: ${clean}`.slice(0, 200);
}
