import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SiteTheme = 'dark' | 'light';
/** Accent packs layered on dark/light bases (option 1 theme expansion). */
export type SiteAccent = 'cyan' | 'amber';

export const SITE_THEMES: readonly SiteTheme[] = ['dark', 'light'] as const;
export const SITE_ACCENTS: readonly SiteAccent[] = ['cyan', 'amber'] as const;

export const SITE_THEME_LABELS: Record<SiteTheme, string> = {
  dark: 'Dark',
  light: 'Light',
};

export const SITE_ACCENT_LABELS: Record<SiteAccent, string> = {
  cyan: 'Cyan',
  amber: 'Amber',
};

const THEME_STORAGE_KEY = 'portfolio-site-theme';
const ACCENT_STORAGE_KEY = 'portfolio-site-accent';

interface ThemeContextValue {
  theme: SiteTheme;
  accent: SiteAccent;
  isLight: boolean;
  setTheme: (theme: SiteTheme) => void;
  setAccent: (accent: SiteAccent) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function isSiteTheme(value: unknown): value is SiteTheme {
  return value === 'light' || value === 'dark';
}

export function isSiteAccent(value: unknown): value is SiteAccent {
  return value === 'cyan' || value === 'amber';
}

function readStoredTheme(): SiteTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isSiteTheme(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'dark';
}

function readStoredAccent(): SiteAccent {
  if (typeof window === 'undefined') return 'cyan';
  try {
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isSiteAccent(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'cyan';
}

const FAVICON_VERSION = '1.1.29';

function syncDocumentFavicon(accent: SiteAccent) {
  const pngHref =
    accent === 'amber'
      ? `/favicon-32-amber.png?v=${FAVICON_VERSION}`
      : `/favicon-32.png?v=${FAVICON_VERSION}`;
  const svgHref =
    accent === 'amber'
      ? `/icon-amber.svg?v=${FAVICON_VERSION}`
      : `/icon.svg?v=${FAVICON_VERSION}`;

  let pngLink = document.querySelector<HTMLLinkElement>(
    'link[data-brand-favicon="png"]'
  );
  if (!pngLink) {
    pngLink = document.createElement('link');
    pngLink.rel = 'icon';
    pngLink.type = 'image/png';
    pngLink.sizes = '32x32';
    pngLink.setAttribute('data-brand-favicon', 'png');
    document.head.appendChild(pngLink);
  }
  if (pngLink.getAttribute('href') !== pngHref) {
    pngLink.setAttribute('href', pngHref);
  }

  let svgLink = document.querySelector<HTMLLinkElement>(
    'link[data-brand-favicon="svg"]'
  );
  if (!svgLink) {
    svgLink = document.createElement('link');
    svgLink.rel = 'icon';
    svgLink.type = 'image/svg+xml';
    svgLink.setAttribute('data-brand-favicon', 'svg');
    document.head.appendChild(svgLink);
  }
  if (svgLink.getAttribute('href') !== svgHref) {
    svgLink.setAttribute('href', svgHref);
  }
}

function applyThemeToDocument(theme: SiteTheme, accent: SiteAccent) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-accent', accent);
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#f8fafc' : '#06080d');
  }

  syncDocumentFavicon(accent);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SiteTheme>(() => readStoredTheme());
  const [accent, setAccentState] = useState<SiteAccent>(() => readStoredAccent());

  useEffect(() => {
    applyThemeToDocument(theme, accent);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    } catch {
      /* ignore */
    }
  }, [theme, accent]);

  const setTheme = useCallback((next: SiteTheme) => {
    setThemeState(next);
  }, []);

  const setAccent = useCallback((next: SiteAccent) => {
    setAccentState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      accent,
      isLight: theme === 'light',
      setTheme,
      setAccent,
      toggleTheme,
    }),
    [theme, accent, setTheme, setAccent, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
