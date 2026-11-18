/**
 * Inline-email palettes matched to the site dark / light themes.
 * Colors are hex literals because most email clients ignore external CSS.
 */

export type EmailTheme = 'dark' | 'light';

export interface EmailPalette {
  theme: EmailTheme;
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

const DARK_PALETTE: EmailPalette = {
  theme: 'dark',
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
  accent: '#38bdf8',
  accentDeep: '#06b6d4',
  accentSoftBg: '#083344',
  accentSoftBorder: '#0891b2',
  badgeSuccessBg: '#064e3b',
  badgeSuccessBorder: '#10b981',
  badgeSuccessText: '#6ee7b7',
  ctaBg: '#38bdf8',
  ctaText: '#020617',
  accentAlt: '#34d399',
};

const LIGHT_PALETTE: EmailPalette = {
  theme: 'light',
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
  accent: '#0284c7',
  accentDeep: '#0369a1',
  accentSoftBg: '#e0f2fe',
  accentSoftBorder: '#7dd3fc',
  badgeSuccessBg: '#ecfdf5',
  badgeSuccessBorder: '#6ee7b7',
  badgeSuccessText: '#047857',
  ctaBg: '#0284c7',
  ctaText: '#ffffff',
  accentAlt: '#059669',
};

/** Accept only explicit client themes; default to dark (site default). */
export function parseEmailTheme(value: unknown): EmailTheme {
  if (typeof value !== 'string') return 'dark';
  const normalized = value.trim().toLowerCase();
  return normalized === 'light' ? 'light' : 'dark';
}

export function getEmailPalette(theme: EmailTheme): EmailPalette {
  return theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}
