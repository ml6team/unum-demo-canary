import { worstStatus } from './status';
import { addUtcDays, DAY_MS, startOfUtcDay, utcDayKey } from './time';
import type { Incident, IncidentUpdate, Service, ServiceUptime, UptimeDay } from './types';

export const HISTORY_DAYS = 90;

export type IncidentState = 'upcoming' | 'active' | 'resolved';

export function incidentState(incident: Incident, now: Date): IncidentState {
  if (Date.parse(incident.startedAt) > now.getTime()) return 'upcoming';
  if (incident.resolvedAt === null || Date.parse(incident.resolvedAt) > now.getTime()) {
    return 'active';
  }
  return 'resolved';
}

function newestFirst(a: Incident, b: Incident): number {
  return Date.parse(b.startedAt) - Date.parse(a.startedAt);
}

/** The first UTC day of the history window that ends on the day of `now`. */
export function historyStart(now: Date, days = HISTORY_DAYS): Date {
  return addUtcDays(startOfUtcDay(now), -(days - 1));
}

/** Incidents that started inside the history window and are not upcoming, newest first. */
export function pastIncidents(incidents: Incident[], now: Date, days = HISTORY_DAYS): Incident[] {
  const from = historyStart(now, days).getTime();
  return incidents
    .filter((i) => incidentState(i, now) !== 'upcoming' && Date.parse(i.startedAt) >= from)
    .sort(newestFirst);
}

export function upcomingMaintenance(incidents: Incident[], now: Date): Incident[] {
  return incidents
    .filter((i) => i.kind === 'maintenance' && incidentState(i, now) === 'upcoming')
    .sort((a, b) => -newestFirst(a, b));
}

export function activeIncidents(incidents: Incident[], now: Date): Incident[] {
  return incidents.filter((i) => incidentState(i, now) === 'active').sort(newestFirst);
}

export interface DayGroup {
  day: string;
  incidents: Incident[];
}

/** Groups incidents by the UTC day they started on, newest day and incident first. */
export function groupByDay(incidents: Incident[]): DayGroup[] {
  const groups = new Map<string, Incident[]>();
  for (const incident of [...incidents].sort(newestFirst)) {
    const day = utcDayKey(incident.startedAt);
    const group = groups.get(day);
    if (group) group.push(incident);
    else groups.set(day, [incident]);
  }
  return [...groups].map(([day, list]) => ({ day, incidents: list }));
}

export function updatesNewestFirst(incident: Incident): IncidentUpdate[] {
  return [...incident.updates].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Names of the services an incident affects, in the order the services are listed. */
export function affectedServiceNames(incident: Incident, services: Service[]): string[] {
  return services.filter((s) => incident.affectedServiceIds.includes(s.id)).map((s) => s.name);
}

interface Interval {
  start: number;
  end: number;
  incident: Incident;
}

/**
 * The time ranges, as [start, end) in ms, during which incidents affect a service. An open
 * incident runs until `now`; upcoming and empty ranges are left out.
 */
function affectingIntervals(serviceId: string, incidents: Incident[], now: Date): Interval[] {
  return incidents
    .filter((i) => i.affectedServiceIds.includes(serviceId))
    .map((incident) => ({
      start: Date.parse(incident.startedAt),
      end: Math.min(
        incident.resolvedAt === null ? now.getTime() : Date.parse(incident.resolvedAt),
        now.getTime(),
      ),
      incident,
    }))
    .filter((interval) => interval.end > interval.start);
}

/** The status of a service on each UTC day of the history window, oldest first. */
export function dailyStatuses(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): UptimeDay[] {
  const intervals = affectingIntervals(serviceId, incidents, now);
  const first = historyStart(now, days);
  return Array.from({ length: days }, (_, index) => {
    const dayStart = addUtcDays(first, index);
    const from = dayStart.getTime();
    const to = from + DAY_MS;
    const impacts = intervals
      .filter((interval) => interval.start < to && interval.end > from)
      .map((interval) => interval.incident.impact);
    return { day: utcDayKey(dayStart), status: worstStatus(impacts) };
  });
}

/**
 * The share of the history window, from its first day until `now`, that no incident or
 * maintenance affecting the service covers. Overlapping incidents count once.
 */
export function uptimeRatio(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): number {
  const windowStart = historyStart(now, days).getTime();
  const windowEnd = now.getTime();
  const clipped = affectingIntervals(serviceId, incidents, now)
    .map((interval) => ({
      start: Math.max(interval.start, windowStart),
      end: Math.min(interval.end, windowEnd),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  let downtime = 0;
  let current: { start: number; end: number } | undefined;
  for (const interval of clipped) {
    if (current && interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
    } else {
      if (current) downtime += current.end - current.start;
      current = { ...interval };
    }
  }
  if (current) downtime += current.end - current.start;

  return 1 - downtime / (windowEnd - windowStart);
}

export function serviceUptime(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): ServiceUptime {
  return {
    serviceId,
    days: dailyStatuses(serviceId, incidents, now, days),
    uptime: uptimeRatio(serviceId, incidents, now, days),
  };
}
