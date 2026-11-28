import { describe, expect, it } from 'vitest';
import {
  getExperienceDurationLabel,
  getExperienceYearsPlus,
  getTotalExperienceMonths,
} from './employmentTenures';

describe('total experience from employment windows', () => {
  const asOf = new Date(2026, 10, 28); // 28 Nov 2026

  it('sums TCS + HCL + Cisco months', () => {
    // 68 + 83 + 3 = 154 → 12 yrs 10 mos
    expect(getTotalExperienceMonths(asOf)).toBe(154);
    expect(getExperienceDurationLabel(asOf)).toBe('12 yrs 10 mos');
    expect(getExperienceYearsPlus(asOf)).toBe('12+');
  });
});
