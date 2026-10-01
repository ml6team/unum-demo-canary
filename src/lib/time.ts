export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export type Instant = string | Date;

function toDate(instant: Instant): Date {
  return typeof instant === 'string' ? new Date(instant) : instant;
}

/** The UTC calendar day of an instant, as YYYY-MM-DD. */
export function utcDayKey(instant: Instant): string {
  return toDate(instant).toISOString().slice(0, 10);
}

export function startOfUtcDay(instant: Instant): Date {
  return new Date(`${utcDayKey(instant)}T00:00:00Z`);
}

export function addUtcDays(instant: Instant, days: number): Date {
  return new Date(toDate(instant).getTime() + days * DAY_MS);
}

export function durationMs(start: Instant, end: Instant): number {
  return toDate(end).getTime() - toDate(start).getTime();
}
