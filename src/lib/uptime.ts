import { HISTORY_DAYS, historyStart } from './incidents';
import { worstStatus } from './status';
import { addUtcDays, DAY_MS, utcDayKey } from './time';
import type { Incident, ServiceStatus } from './types';

export interface UptimeDay {
  /** The UTC day, as YYYY-MM-DD. */
  day: string;
  /** Operational when no incident touches the day. */
  status: ServiceStatus;
}

export interface ServiceUptime {
  /** Oldest first; the last entry is the day of `now`. */
  days: UptimeDay[];
  /** 0 to 100, floored to two decimals, and 100 only when there was no incident time. */
  percent: number;
}

interface Interval {
  start: number;
  end: number;
}

/** Incidents (not maintenance) of one service that have started by `now`. */
export function incidentsForService(
  serviceId: string,
  incidents: Incident[],
  now: Date,
): Incident[] {
  return incidents.filter(
    (i) =>
      i.kind === 'incident' &&
      i.affectedServiceIds.includes(serviceId) &&
      Date.parse(i.startedAt) <= now.getTime(),
  );
}

/** The time an incident covers: from its start until it resolves or `now`, whichever is first. */
function interval(incident: Incident, now: Date): Interval {
  const end = incident.resolvedAt === null ? now.getTime() : Date.parse(incident.resolvedAt);
  return { start: Date.parse(incident.startedAt), end: Math.min(end, now.getTime()) };
}

export function uptimeDays(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): UptimeDay[] {
  const relevant = incidentsForService(serviceId, incidents, now).map((incident) => ({
    impact: incident.impact,
    ...interval(incident, now),
  }));
  const first = historyStart(now, days);
  return Array.from({ length: days }, (_, index) => {
    const dayStart = addUtcDays(first, index).getTime();
    const dayEnd = dayStart + DAY_MS;
    const touching = relevant.filter((i) => i.start < dayEnd && i.end > dayStart);
    return {
      day: utcDayKey(new Date(dayStart)),
      status: worstStatus(touching.map((i) => i.impact)),
    };
  });
}

export function uptimePercent(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): number {
  const windowStart = historyStart(now, days).getTime();
  const windowMs = now.getTime() - windowStart;
  const clipped = incidentsForService(serviceId, incidents, now)
    .map((incident) => interval(incident, now))
    .map((i) => ({ start: Math.max(i.start, windowStart), end: i.end }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  let down = 0;
  let mergedEnd = windowStart;
  for (const { start, end } of clipped) {
    const from = Math.max(start, mergedEnd);
    if (end > from) down += end - from;
    mergedEnd = Math.max(mergedEnd, end);
  }

  if (down === 0) return 100;
  const percent = Math.floor(((windowMs - down) * 10_000) / windowMs) / 100;
  return Math.min(percent, 99.99);
}

export function serviceUptime(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): ServiceUptime {
  return {
    days: uptimeDays(serviceId, incidents, now, days),
    percent: uptimePercent(serviceId, incidents, now, days),
  };
}
