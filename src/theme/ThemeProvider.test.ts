import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  SITE_ACCENTS,
  SITE_THEMES,
  isSiteAccent,
  isSiteTheme,
} from './ThemeProvider';

const accentCss = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'accentThemes.css'),
  'utf8'
);

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

  it('does not remap hover/group-hover cyan text utilities at rest', () => {
    // Strip comments — the docblock may mention the forbidden pattern by name.
    const selectorsOnly = accentCss.replace(/\/\*[\s\S]*?\*\//g, '');
    // Substring [class*='text-cyan-'] also matches "hover:text-cyan-400" at rest.
    expect(selectorsOnly).not.toMatch(/\[class\*='text-cyan-'\]/);
    expect(selectorsOnly).not.toMatch(/\[class\*='text-sky-'\]/);
    expect(selectorsOnly).toMatch(/\[class\^='text-cyan-'\]/);
    expect(selectorsOnly).toMatch(/\[class\*=' text-cyan-'\]/);
    expect(selectorsOnly).toMatch(/\[class\*='hover:text-cyan-'\]:hover/);
  });
});
