/**
 * Pure calendar-date helpers operating on `YYYY-MM-DD` strings.
 *
 * Due dates and transfer dates are plain calendar dates (no time, no zone).
 * We never construct a Date from a bare string in local time, because that
 * would shift the day for browsers/servers outside UTC. All math is done in
 * UTC and re-serialized to `YYYY-MM-DD`.
 */

export type ISODate = string; // "YYYY-MM-DD"

export function toISODate(date: Date): ISODate {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/**
 * Add whole months, clamping to the last valid day of the target month.
 * e.g. Jan 31 + 1 month = Feb 28 (or 29 in a leap year).
 */
export function addMonths(iso: ISODate, months: number): ISODate {
  const date = parseISODate(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDayOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDayOfMonth));
  return toISODate(date);
}

/** Negative if a < b, 0 if equal, positive if a > b. */
export function compareISODate(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
