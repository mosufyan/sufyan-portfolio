/**
 * Whole months completed between two dates (day-aware).
 * If the end day-of-month is before the start day-of-month, that partial month is excluded.
 */
export function monthsBetween(start: Date, end: Date = new Date()): number {
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/** Formats a tenure like "3 mos", "1 yr", "1 yr 2 mos", "7 yrs". */
export function formatTenureDuration(start: Date, end: Date = new Date()): string {
  const totalMonths = monthsBetween(start, end);
  if (totalMonths < 12) {
    return `${totalMonths} mos`;
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const yearLabel = years === 1 ? '1 yr' : `${years} yrs`;
  if (months === 0) return yearLabel;
  return `${yearLabel} ${months} mos`;
}

/** Short label for open roles, e.g. "Current · 3 mos". */
export function formatCurrentTenureLabel(start: Date, now: Date = new Date()): string {
  return `Current · ${formatTenureDuration(start, now)}`;
}
