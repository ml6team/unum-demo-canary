import { addUtcDays, startOfUtcDay, utcDayKey } from './time';
import type { Incident, IncidentUpdate, Service } from './types';

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

/** True for incidents that count as downtime: kind 'incident' with a partial or major outage. */
export function isDowntime(incident: Incident): boolean {
  return (
    incident.kind === 'incident' &&
    (incident.impact === 'partial-outage' || incident.impact === 'major-outage')
  );
}

/**
 * Share of [max(now - days, trackedSince), now] the service was up, in percent, rounded to two
 * decimals. Returns null when that window has no length (no history). Never returns 100 when the
 * service had downtime in the window.
 */
export function serviceUptime(
  service: Service,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): number | null {
  const end = now.getTime();
  const windowStart = addUtcDays(now, -days).getTime();
  const start = service.trackedSince
    ? Math.max(windowStart, Date.parse(service.trackedSince))
    : windowStart;
  const windowMs = end - start;
  if (windowMs <= 0) return null;

  const intervals = incidents
    .filter(
      (i) =>
        isDowntime(i) &&
        i.affectedServiceIds.includes(service.id) &&
        incidentState(i, now) !== 'upcoming',
    )
    .map((i) => ({
      from: Math.max(Date.parse(i.startedAt), start),
      to: Math.min(i.resolvedAt === null ? end : Date.parse(i.resolvedAt), end),
    }))
    .filter((interval) => interval.to > interval.from)
    .sort((a, b) => a.from - b.from);

  let downMs = 0;
  let coveredTo = start;
  for (const { from, to } of intervals) {
    const clippedFrom = Math.max(from, coveredTo);
    if (to > clippedFrom) downMs += to - clippedFrom;
    coveredTo = Math.max(coveredTo, to);
  }

  const uptime = Math.round(((windowMs - downMs) / windowMs) * 10000) / 100;
  return downMs > 0 ? Math.min(uptime, 99.99) : uptime;
}
