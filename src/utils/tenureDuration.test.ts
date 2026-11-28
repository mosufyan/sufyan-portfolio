import { describe, expect, it } from 'vitest';
import {
  formatCurrentTenureLabel,
  formatTenureDuration,
  monthsBetween,
} from './tenureDuration';

describe('monthsBetween', () => {
  it('uses day-aware whole months for employment windows', () => {
    // Cisco: 25 Aug 2026 → 28 Nov 2026 = 3 mos
    expect(monthsBetween(new Date(2026, 7, 25), new Date(2026, 10, 28))).toBe(3);
    // TCS: 26 Dec 2013 → 31 Aug 2019 = 5 yrs 8 mos
    expect(monthsBetween(new Date(2013, 11, 26), new Date(2019, 7, 31))).toBe(68);
    // HCL: 5 Sep 2019 → 24 Aug 2026 = 6 yrs 11 mos
    expect(monthsBetween(new Date(2019, 8, 5), new Date(2026, 7, 24))).toBe(83);
  });

  it('drops a month when end day is before start day', () => {
    expect(monthsBetween(new Date(2019, 8, 5), new Date(2026, 7, 4))).toBe(82);
  });
});

describe('formatTenureDuration', () => {
  it('formats under one year as months', () => {
    expect(formatTenureDuration(new Date(2026, 7, 25), new Date(2026, 10, 28))).toBe('3 mos');
  });

  it('formats whole years and year+month mixes', () => {
    expect(formatTenureDuration(new Date(2019, 8, 5), new Date(2026, 7, 24))).toBe('6 yrs 11 mos');
    expect(formatTenureDuration(new Date(2013, 11, 26), new Date(2019, 7, 31))).toBe('5 yrs 8 mos');
  });
});

describe('formatCurrentTenureLabel', () => {
  it('prefixes Current', () => {
    expect(formatCurrentTenureLabel(new Date(2026, 7, 25), new Date(2026, 10, 28))).toBe(
      'Current · 3 mos'
    );
  });
});
