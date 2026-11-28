import { formatTenureDuration, monthsBetween } from '../utils/tenureDuration';

/** Exact employment windows used for day-aware tenure + total experience. */
export const EMPLOYMENT_TENURES = {
  tcs: {
    start: new Date(2013, 11, 26), // 26 Dec 2013
    end: new Date(2019, 7, 31), // 31 Aug 2019
  },
  hcl: {
    start: new Date(2019, 8, 5), // 5 Sep 2019
    end: new Date(2026, 7, 24), // 24 Aug 2026
  },
  cisco: {
    start: new Date(2026, 7, 25), // 25 Aug 2026
    end: null as Date | null, // open — Present
  },
} as const;

/** @deprecated Prefer EMPLOYMENT_TENURES.cisco.start */
export const CISCO_ROLE_START = EMPLOYMENT_TENURES.cisco.start;

/** Sum of TCS + HCL + Cisco (to now) whole months. */
export function getTotalExperienceMonths(now: Date = new Date()): number {
  const { tcs, hcl, cisco } = EMPLOYMENT_TENURES;
  return (
    monthsBetween(tcs.start, tcs.end) +
    monthsBetween(hcl.start, hcl.end) +
    monthsBetween(cisco.start, now)
  );
}

/** Marketing short form, e.g. "12+". */
export function getExperienceYearsPlus(now: Date = new Date()): string {
  return `${Math.floor(getTotalExperienceMonths(now) / 12)}+`;
}

/** Precise total, e.g. "12 yrs 10 mos". */
export function getExperienceDurationLabel(now: Date = new Date()): string {
  const months = getTotalExperienceMonths(now);
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (months < 12) return `${months} mos`;
  const yearLabel = years === 1 ? '1 yr' : `${years} yrs`;
  if (rem === 0) return yearLabel;
  return `${yearLabel} ${rem} mos`;
}

export function getCompanyDurationLabel(
  key: keyof typeof EMPLOYMENT_TENURES,
  now: Date = new Date()
): string {
  const window = EMPLOYMENT_TENURES[key];
  const end = window.end ?? now;
  return formatTenureDuration(window.start, end);
}
