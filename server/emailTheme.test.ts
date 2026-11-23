import { describe, expect, it } from 'vitest';
import { getEmailPalette, parseEmailAccent, parseEmailTheme } from './emailTheme';

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

describe('parseEmailAccent', () => {
  it('accepts cyan and amber, defaults everything else to cyan', () => {
    expect(parseEmailAccent('amber')).toBe('amber');
    expect(parseEmailAccent('AMBER')).toBe('amber');
    expect(parseEmailAccent(' cyan ')).toBe('cyan');
    expect(parseEmailAccent('violet')).toBe('cyan');
    expect(parseEmailAccent(undefined)).toBe('cyan');
    expect(parseEmailAccent(null)).toBe('cyan');
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

  it('switches CTA / accent chrome for amber while keeping paper tones', () => {
    const cyanDark = getEmailPalette('dark', 'cyan');
    const amberDark = getEmailPalette('dark', 'amber');
    const amberLight = getEmailPalette('light', 'amber');

    expect(amberDark.pageBg).toBe(cyanDark.pageBg);
    expect(amberDark.accent).toBe('#f59e0b');
    expect(amberDark.ctaBg).toBe('#f59e0b');
    expect(amberLight.accent).toBe('#b45309');
    expect(amberLight.ctaBg).toBe('#d97706');
    expect(cyanDark.accent).toBe('#38bdf8');
  });
});
