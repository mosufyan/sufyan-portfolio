import { describe, expect, it } from 'vitest';
import {
  buildCvShareUrl,
  DEFAULT_CV_SECTION_ORDER,
  parseCvShareSearch,
} from './cvShareConfig';

describe('cvShareConfig', () => {
  it('parses valid preset, theme, density, accent, radars, and custom order', () => {
    const parsed = parseCvShareSearch(
      '?cv=security&theme=light&density=compact&accent=emerald&radars=0&order=awards,experience'
    );
    expect(parsed.shouldOpen).toBe(true);
    expect(parsed.preset).toBe('security');
    expect(parsed.theme).toBe('light');
    expect(parsed.density).toBe('compact');
    expect(parsed.accent).toBe('emerald');
    expect(parsed.showInfographics).toBe(false);
    expect(parsed.sectionOrder?.slice(0, 2)).toEqual(['awards', 'experience']);
    expect(parsed.sectionOrder?.length).toBe(DEFAULT_CV_SECTION_ORDER.length);
  });

  it('ignores unknown or tampered query parameters cleanly', () => {
    const parsed = parseCvShareSearch('?cv=evil&theme=neon&density=huge&accent=pink');
    expect(parsed.shouldOpen).toBe(false);
  });

  it('builds deterministic shareable links and drops redundant default params', () => {
    const url = buildCvShareUrl({
      baseHref: 'https://www.mohammedsufyan.com/?skill=Python',
      preset: 'security',
      theme: 'light',
      density: 'executive',
      accent: 'cyan',
      showInfographics: true,
      sectionOrder: DEFAULT_CV_SECTION_ORDER,
      sections: {
        overview: true,
        philosophy: true,
        experience: true,
        skills: true,
        certifications: true,
        awards: true,
        education: true,
      },
    });
    expect(url).toBe(
      'https://www.mohammedsufyan.com/?skill=Python&cv=security&theme=light&density=executive&accent=cyan'
    );
  });

  it('encodes custom section selection cleanly when preset is custom', () => {
    const url = buildCvShareUrl({
      baseHref: 'https://www.mohammedsufyan.com/',
      preset: 'custom',
      theme: 'dark',
      density: 'compact',
      accent: 'indigo',
      showInfographics: false,
      sectionOrder: ['experience', 'skills', 'overview', 'philosophy', 'certifications', 'awards', 'education'],
      sections: {
        overview: true,
        philosophy: false,
        experience: true,
        skills: true,
        certifications: false,
        awards: false,
        education: false,
      },
    });
    expect(url).toContain('cv=custom');
    expect(url).toContain('density=compact');
    expect(url).toContain('accent=indigo');
    expect(url).toContain('radars=0');
    expect(url).toContain('order=experience%2Cskills');
    expect(url).toContain('sections=overview%2Cexperience%2Cskills');
  });

  it('supports extended densities and accent palettes while enforcing 6 presets', () => {
    const parsed = parseCvShareSearch('?cv=platform&density=ultra&accent=violet&theme=light');
    expect(parsed.shouldOpen).toBe(true);
    expect(parsed.preset).toBe('platform');
    expect(parsed.density).toBe('ultra');
    expect(parsed.accent).toBe('violet');

    const fullstackParsed = parseCvShareSearch('?cv=fullstack&density=editorial&accent=amber&theme=dark');
    expect(fullstackParsed.shouldOpen).toBe(true);
    expect(fullstackParsed.preset).toBe('fullstack');
    expect(fullstackParsed.density).toBe('editorial');
    expect(fullstackParsed.accent).toBe('amber');

    expect(parseCvShareSearch('?cv=summary&accent=teal').accent).toBe('teal');
    expect(parseCvShareSearch('?cv=summary&accent=rose').accent).toBe('rose');
    expect(parseCvShareSearch('?cv=summary&accent=cobalt').accent).toBe('cobalt');
    expect(parseCvShareSearch('?cv=summary&accent=copper').accent).toBe('copper');
    expect(parseCvShareSearch('?cv=cloud').shouldOpen).toBe(false);
    expect(parseCvShareSearch('?cv=leadership').shouldOpen).toBe(false);
  });
});
