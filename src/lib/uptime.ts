import { formatDay } from './format';
import { HISTORY_DAYS, historyStart, incidentState } from './incidents';
import { compareSeverity, STATUS_LABEL, worstStatus } from './status';
import { addUtcDays, DAY_MS, utcDayKey } from './time';
import type { Incident, ServiceStatus } from './types';

export interface UptimeDay {
  /** YYYY-MM-DD, UTC. */
  day: string;
  /** The worst impact on that day; operational when no incident affected the service. */
  status: ServiceStatus;
  /** The worst incident of the day; the earliest start wins a tie. */
  incident: Incident | null;
}

/** Incidents and started maintenance windows that list the service. */
function affecting(serviceId: string, incidents: Incident[], now: Date): Incident[] {
  return incidents.filter(
    (i) => incidentState(i, now) !== 'upcoming' && i.affectedServiceIds.includes(serviceId),
  );
}

function worseThan(a: Incident, b: Incident): boolean {
  const bySeverity = compareSeverity(a.impact, b.impact);
  if (bySeverity !== 0) return bySeverity > 0;
  return Date.parse(a.startedAt) < Date.parse(b.startedAt);
}

/** One entry per UTC day, oldest first, the last one being the day of `now`. */
export function uptimeDays(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): UptimeDay[] {
  const relevant = affecting(serviceId, incidents, now);
  const first = historyStart(now, days);
  return Array.from({ length: days }, (_, index) => {
    const dayStart = addUtcDays(first, index).getTime();
    const dayEnd = dayStart + DAY_MS;
    let worst: Incident | null = null;
    for (const i of relevant) {
      const covers =
        Date.parse(i.startedAt) < dayEnd &&
        (i.resolvedAt === null || Date.parse(i.resolvedAt) > dayStart);
      if (covers && (worst === null || worseThan(i, worst))) worst = i;
    }
    return {
      day: utcDayKey(new Date(dayStart)),
      status: worstStatus(worst ? [worst.impact] : []),
      incident: worst,
    };
  });
}

/**
 * The share of the window, from the first day's start until `now`, in which no incident
 * affected the service. Overlapping incidents are only counted once.
 */
export function uptimePercent(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): number {
  const from = historyStart(now, days).getTime();
  const to = now.getTime();
  const intervals = affecting(serviceId, incidents, now)
    .map((i) => ({
      start: Math.max(Date.parse(i.startedAt), from),
      end: Math.min(i.resolvedAt === null ? to : Date.parse(i.resolvedAt), to),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  let down = 0;
  let current: { start: number; end: number } | null = null;
  for (const range of intervals) {
    if (current !== null && range.start <= current.end) {
      current.end = Math.max(current.end, range.end);
    } else {
      if (current !== null) down += current.end - current.start;
      current = { ...range };
    }
  }
  if (current !== null) down += current.end - current.start;

  const window = to - from;
  return (100 * (window - down)) / window;
}

/** "Sep 10, 2026: Search errors (Partial outage)" or "Sep 10, 2026: No incident". */
export function describeUptimeDay(d: UptimeDay): string {
  const what = d.incident ? `${d.incident.title} (${STATUS_LABEL[d.status]})` : 'No incident';
  return `${formatDay(d.day)}: ${what}`;
}
