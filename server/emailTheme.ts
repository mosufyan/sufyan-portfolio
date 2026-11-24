/**
 * Inline-email palettes matched to the site dark / light themes + cyan / amber accents.
 * Colors are hex literals because most email clients ignore external CSS.
 */

export type EmailTheme = 'dark' | 'light';
export type EmailAccent = 'cyan' | 'amber';

export interface EmailPalette {
  theme: EmailTheme;
  accentId: EmailAccent;
  pageBg: string;
  cardBg: string;
  headerBg: string;
  footerBg: string;
  panelBg: string;
  border: string;
  text: string;
  textStrong: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accentDeep: string;
  accentSoftBg: string;
  accentSoftBorder: string;
  badgeSuccessBg: string;
  badgeSuccessBorder: string;
  badgeSuccessText: string;
  ctaBg: string;
  ctaText: string;
  accentAlt: string;
}

const BASE_DARK = {
  theme: 'dark' as const,
  pageBg: '#06080d',
  cardBg: '#0d121f',
  headerBg: '#080b13',
  footerBg: '#05070b',
  panelBg: '#090d16',
  border: '#1e293b',
  text: '#e2e8f0',
  textStrong: '#ffffff',
  textMuted: '#94a3b8',
  textSoft: '#64748b',
  badgeSuccessBg: '#064e3b',
  badgeSuccessBorder: '#10b981',
  badgeSuccessText: '#6ee7b7',
  accentAlt: '#34d399',
};

const BASE_LIGHT = {
  theme: 'light' as const,
  pageBg: '#f8fafc',
  cardBg: '#ffffff',
  headerBg: '#f1f5f9',
  footerBg: '#f1f5f9',
  panelBg: '#f8fafc',
  border: '#e2e8f0',
  text: '#334155',
  textStrong: '#0f172a',
  textMuted: '#64748b',
  textSoft: '#94a3b8',
  badgeSuccessBg: '#ecfdf5',
  badgeSuccessBorder: '#6ee7b7',
  badgeSuccessText: '#047857',
  accentAlt: '#059669',
};

const ACCENT_TONES: Record<
  EmailAccent,
  {
    dark: Pick<
      EmailPalette,
      'accent' | 'accentDeep' | 'accentSoftBg' | 'accentSoftBorder' | 'ctaBg' | 'ctaText'
    >;
    light: Pick<
      EmailPalette,
      'accent' | 'accentDeep' | 'accentSoftBg' | 'accentSoftBorder' | 'ctaBg' | 'ctaText'
    >;
  }
> = {
  cyan: {
    dark: {
      accent: '#38bdf8',
      accentDeep: '#06b6d4',
      accentSoftBg: '#083344',
      accentSoftBorder: '#0891b2',
      ctaBg: '#38bdf8',
      ctaText: '#020617',
    },
    light: {
      accent: '#0284c7',
      accentDeep: '#0369a1',
      accentSoftBg: '#e0f2fe',
      accentSoftBorder: '#7dd3fc',
      ctaBg: '#0284c7',
      ctaText: '#ffffff',
    },
  },
  amber: {
    dark: {
      accent: '#f59e0b',
      accentDeep: '#d97706',
      accentSoftBg: '#3b2a14',
      accentSoftBorder: '#b45309',
      ctaBg: '#f59e0b',
      ctaText: '#0f172a',
    },
    light: {
      accent: '#b45309',
      accentDeep: '#92400e',
      accentSoftBg: '#fffbeb',
      accentSoftBorder: '#fcd34d',
      ctaBg: '#d97706',
      ctaText: '#fffbeb',
    },
  },
};

/** Accept only explicit client themes; default to dark (site default). */
export function parseEmailTheme(value: unknown): EmailTheme {
  if (typeof value !== 'string') return 'dark';
  const normalized = value.trim().toLowerCase();
  return normalized === 'light' ? 'light' : 'dark';
}

/** Accept only explicit client accents; default to cyan (site default). */
export function parseEmailAccent(value: unknown): EmailAccent {
  if (typeof value !== 'string') return 'cyan';
  const normalized = value.trim().toLowerCase();
  return normalized === 'amber' ? 'amber' : 'cyan';
}

export function getEmailPalette(
  theme: EmailTheme,
  accent: EmailAccent = 'cyan'
): EmailPalette {
  const tones = ACCENT_TONES[accent][theme];
  const base = theme === 'light' ? BASE_LIGHT : BASE_DARK;
  return {
    ...base,
    accentId: accent,
    ...tones,
  };
}
