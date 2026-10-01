import { addUtcDays, DAY_MS, startOfUtcDay, utcDayKey } from './time';
import type { Impact, Incident, IncidentUpdate, Service } from './types';

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

/** Impacts that count as downtime. 'degraded' and maintenance do not. */
export const OUTAGE_IMPACTS: Impact[] = ['partial-outage', 'major-outage'];

/**
 * Uptime of one service over [max(now - days * DAY_MS, trackedSince), now], as a percentage
 * truncated (not rounded) to 2 decimals, so only a service with zero downtime reads 100.
 */
export function serviceUptime(
  service: Service,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): number {
  const to = now.getTime();
  const windowStart = to - days * DAY_MS;
  const from = service.trackedSince
    ? Math.max(windowStart, Date.parse(service.trackedSince))
    : windowStart;
  if (to <= from) return 100;

  const intervals = incidents
    .filter(
      (i) =>
        i.kind === 'incident' &&
        i.affectedServiceIds.includes(service.id) &&
        OUTAGE_IMPACTS.includes(i.impact),
    )
    .map((i): [number, number] => [
      Math.max(from, Date.parse(i.startedAt)),
      Math.min(to, i.resolvedAt === null ? to : Date.parse(i.resolvedAt)),
    ])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  let downMs = 0;
  let coveredUntil = from;
  for (const [start, end] of intervals) {
    const begin = Math.max(start, coveredUntil);
    if (end > begin) downMs += end - begin;
    coveredUntil = Math.max(coveredUntil, end);
  }

  const periodMs = to - from;
  return Math.floor(((periodMs - downMs) * 10000) / periodMs) / 100;
}
