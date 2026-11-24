import { describe, expect, it } from 'vitest';
import {
  SITE_ACCENTS,
  SITE_THEMES,
  isSiteAccent,
  isSiteTheme,
} from './ThemeProvider';

describe('theme accent packs', () => {
  it('accepts only dark/light themes and cyan/amber accents', () => {
    expect(SITE_THEMES).toEqual(['dark', 'light']);
    expect(SITE_ACCENTS).toEqual(['cyan', 'amber']);
    expect(isSiteTheme('dark')).toBe(true);
    expect(isSiteTheme('light')).toBe(true);
    expect(isSiteTheme('slate')).toBe(false);
    expect(isSiteAccent('cyan')).toBe(true);
    expect(isSiteAccent('amber')).toBe(true);
    expect(isSiteAccent('steel')).toBe(false);
  });
});
