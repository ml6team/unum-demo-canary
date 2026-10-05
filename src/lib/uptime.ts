import { HISTORY_DAYS, historyStart, incidentState } from './incidents';
import { worstStatus } from './status';
import { addUtcDays, DAY_MS, utcDayKey } from './time';
import type { Incident, ServiceStatus } from './types';

export interface UptimeDay {
  /** The UTC day, as YYYY-MM-DD. */
  day: string;
  status: ServiceStatus;
}

export interface ServiceUptime {
  /** One entry per day of the window, oldest first, today last. */
  days: UptimeDay[];
  /** Share of the window without downtime, truncated to two decimals. */
  percent: number;
}

interface Interval {
  start: number;
  end: number;
  incident: Incident;
}

/** Incidents of a service as intervals clipped to the window, ignoring upcoming and maintenance. */
function downtimeIntervals(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  from: number,
): Interval[] {
  const to = now.getTime();
  return incidents
    .filter(
      (i) =>
        i.kind === 'incident' &&
        i.affectedServiceIds.includes(serviceId) &&
        incidentState(i, now) !== 'upcoming',
    )
    .map((incident) => ({
      start: Math.max(Date.parse(incident.startedAt), from),
      end: Math.min(incident.resolvedAt === null ? to : Date.parse(incident.resolvedAt), to),
      incident,
    }))
    .filter((interval) => interval.end > interval.start);
}

function unionMs(intervals: Interval[]): number {
  let total = 0;
  let coveredUntil = Number.NEGATIVE_INFINITY;
  for (const { start, end } of [...intervals].sort((a, b) => a.start - b.start)) {
    const from = Math.max(start, coveredUntil);
    if (end > from) total += end - from;
    coveredUntil = Math.max(coveredUntil, end);
  }
  return total;
}

/** Daily status bars and the uptime percentage of one service over the last `days` UTC days. */
export function serviceUptime(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): ServiceUptime {
  const first = historyStart(now, days);
  const from = first.getTime();
  const intervals = downtimeIntervals(serviceId, incidents, now, from);

  const bars = Array.from({ length: days }, (_, index): UptimeDay => {
    const dayStart = addUtcDays(first, index).getTime();
    const dayEnd = dayStart + DAY_MS;
    const impacts = intervals
      .filter((interval) => interval.start < dayEnd && interval.end > dayStart)
      .map((interval) => interval.incident.impact);
    return { day: utcDayKey(new Date(dayStart)), status: worstStatus(impacts) };
  });

  const windowMs = now.getTime() - from;
  const percent = Math.floor(((windowMs - unionMs(intervals)) * 10000) / windowMs) / 100;
  return { days: bars, percent };
}
