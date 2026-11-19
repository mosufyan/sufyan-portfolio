export type CvPresetKey =
  | 'summary'
  | 'concise'
  | 'full'
  | 'security'
  | 'platform'
  | 'fullstack';

export type CvPresetMode = CvPresetKey | 'custom';
export type CvPrintDensity = 'ultra' | 'compact' | 'executive' | 'relaxed' | 'editorial';
export type CvAccentId =
  | 'cyan'
  | 'cobalt'
  | 'emerald'
  | 'teal'
  | 'indigo'
  | 'violet'
  | 'amber'
  | 'copper'
  | 'rose'
  | 'slate';
export type CvSectionKey =
  | 'overview'
  | 'philosophy'
  | 'experience'
  | 'skills'
  | 'certifications'
  | 'awards'
  | 'education';

export const DEFAULT_CV_SECTION_ORDER: CvSectionKey[] = [
  'overview',
  'philosophy',
  'experience',
  'skills',
  'certifications',
  'awards',
  'education',
];

const VALID_PRESETS = new Set<CvPresetMode>([
  'summary',
  'concise',
  'full',
  'security',
  'platform',
  'fullstack',
  'custom',
]);
const VALID_THEMES = new Set<'dark' | 'light'>(['dark', 'light']);
const VALID_DENSITIES = new Set<CvPrintDensity>([
  'ultra',
  'compact',
  'executive',
  'relaxed',
  'editorial',
]);
const VALID_ACCENTS = new Set<CvAccentId>([
  'cyan',
  'cobalt',
  'emerald',
  'teal',
  'indigo',
  'violet',
  'amber',
  'copper',
  'rose',
  'slate',
]);
const VALID_SECTIONS = new Set<CvSectionKey>(DEFAULT_CV_SECTION_ORDER);

export interface ParsedCvShareConfig {
  shouldOpen: boolean;
  preset?: CvPresetMode;
  theme?: 'dark' | 'light';
  density?: CvPrintDensity;
  accent?: CvAccentId;
  showInfographics?: boolean;
  sectionOrder?: CvSectionKey[];
  enabledSections?: CvSectionKey[];
}

export function parseCvShareSearch(search: string): ParsedCvShareConfig {
  if (!search) return { shouldOpen: false };

  const params = new URLSearchParams(search);
  const rawCv = params.get('cv')?.trim().toLowerCase();
  const rawTheme = params.get('theme')?.trim().toLowerCase();
  const rawDensity = params.get('density')?.trim().toLowerCase();
  const rawAccent = params.get('accent')?.trim().toLowerCase();
  const rawRadars = params.get('radars')?.trim().toLowerCase();
  const rawOrder = params.get('order')?.trim().toLowerCase();
  const rawSections = params.get('sections')?.trim().toLowerCase();

  const preset =
    rawCv && VALID_PRESETS.has(rawCv as CvPresetMode)
      ? (rawCv as CvPresetMode)
      : undefined;

  const shouldOpen = preset !== undefined;
  if (!shouldOpen) {
    return { shouldOpen: false };
  }

  const theme =
    rawTheme && VALID_THEMES.has(rawTheme as 'dark' | 'light')
      ? (rawTheme as 'dark' | 'light')
      : undefined;

  const density =
    rawDensity && VALID_DENSITIES.has(rawDensity as CvPrintDensity)
      ? (rawDensity as CvPrintDensity)
      : undefined;

  const accent =
    rawAccent && VALID_ACCENTS.has(rawAccent as CvAccentId)
      ? (rawAccent as CvAccentId)
      : undefined;

  const showInfographics =
    rawRadars === '0' || rawRadars === 'false'
      ? false
      : rawRadars === '1' || rawRadars === 'true'
        ? true
        : undefined;

  let sectionOrder: CvSectionKey[] | undefined;
  if (rawOrder) {
    const parsed = rawOrder
      .split(',')
      .map((s) => s.trim() as CvSectionKey)
      .filter((s, idx, arr) => VALID_SECTIONS.has(s) && arr.indexOf(s) === idx);
    if (parsed.length > 0) {
      const missing = DEFAULT_CV_SECTION_ORDER.filter((s) => !parsed.includes(s));
      sectionOrder = [...parsed, ...missing];
    }
  }

  let enabledSections: CvSectionKey[] | undefined;
  if (rawSections) {
    const parsed = rawSections
      .split(',')
      .map((s) => s.trim() as CvSectionKey)
      .filter((s, idx, arr) => VALID_SECTIONS.has(s) && arr.indexOf(s) === idx);
    if (parsed.length > 0) {
      enabledSections = parsed;
    }
  }

  return {
    shouldOpen,
    preset,
    theme,
    density,
    accent,
    showInfographics,
    sectionOrder,
    enabledSections,
  };
}

export interface BuildCvShareUrlInput {
  baseHref: string;
  preset: CvPresetMode;
  theme: 'dark' | 'light';
  density: CvPrintDensity;
  accent: CvAccentId;
  showInfographics: boolean;
  sectionOrder: CvSectionKey[];
  sections: Record<CvSectionKey, boolean>;
}

export function buildCvShareUrl(input: BuildCvShareUrlInput): string {
  const url = new URL(input.baseHref);
  url.hash = '';

  url.searchParams.set('cv', input.preset);
  url.searchParams.set('theme', input.theme);
  url.searchParams.set('density', input.density);
  url.searchParams.set('accent', input.accent);

  if (!input.showInfographics) {
    url.searchParams.set('radars', '0');
  } else {
    url.searchParams.delete('radars');
  }

  const isCustomOrder = input.sectionOrder.some(
    (key, idx) => key !== DEFAULT_CV_SECTION_ORDER[idx]
  );
  if (isCustomOrder) {
    url.searchParams.set('order', input.sectionOrder.join(','));
  } else {
    url.searchParams.delete('order');
  }

  if (input.preset === 'custom') {
    const enabled = DEFAULT_CV_SECTION_ORDER.filter((k) => input.sections[k]);
    if (enabled.length > 0) {
      url.searchParams.set('sections', enabled.join(','));
    }
  } else {
    url.searchParams.delete('sections');
  }

  return url.toString();
}

export function clearCvShareQueryFromBrowser(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const cvKeys = ['cv', 'theme', 'density', 'accent', 'radars', 'order', 'sections'];
  let changed = false;
  for (const key of cvKeys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
}
