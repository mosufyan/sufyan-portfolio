import { describe, expect, it } from 'vitest';
import { getEmailPalette, parseEmailTheme } from './emailTheme';

describe('parseEmailTheme', () => {
  it('accepts light and dark, defaults everything else to dark', () => {
    expect(parseEmailTheme('light')).toBe('light');
    expect(parseEmailTheme('DARK')).toBe('dark');
    expect(parseEmailTheme(' Light ')).toBe('light');
    expect(parseEmailTheme('neon')).toBe('dark');
    expect(parseEmailTheme(undefined)).toBe('dark');
    expect(parseEmailTheme(null)).toBe('dark');
    expect(parseEmailTheme(1)).toBe('dark');
  });
});

describe('getEmailPalette', () => {
  it('returns distinct dark and light paper palettes', () => {
    const dark = getEmailPalette('dark');
    const light = getEmailPalette('light');

    expect(dark.pageBg).toBe('#06080d');
    expect(light.pageBg).toBe('#f8fafc');
    expect(dark.cardBg).not.toBe(light.cardBg);
    expect(dark.ctaText).toBe('#020617');
    expect(light.ctaText).toBe('#ffffff');
  });
});
