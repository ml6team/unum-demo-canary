import { addUtcDays, DAY_MS, startOfUtcDay, utcDayKey } from './time';
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

/** Milliseconds of the window ending at `now` that the service spent in an incident. Overlaps count once. */
export function serviceDowntimeMs(
  incidents: Incident[],
  serviceId: string,
  now: Date,
  days = HISTORY_DAYS,
): number {
  const end = now.getTime();
  const start = end - days * DAY_MS;
  const spans = incidents
    .filter((i) => i.kind === 'incident' && i.affectedServiceIds.includes(serviceId))
    .map((i): [number, number] => [
      Math.max(Date.parse(i.startedAt), start),
      Math.min(i.resolvedAt === null ? end : Date.parse(i.resolvedAt), end),
    ])
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let coveredUntil = start;
  for (const [from, to] of spans) {
    if (to <= coveredUntil) continue;
    total += to - Math.max(from, coveredUntil);
    coveredUntil = to;
  }
  return total;
}

/** Uptime over the last `days` days as a percentage, rounded DOWN to one decimal (99.56 -> 99.5). 100 only when downtime is zero. */
export function serviceUptime(
  incidents: Incident[],
  serviceId: string,
  now: Date,
  days = HISTORY_DAYS,
): number {
  const windowMs = days * DAY_MS;
  const downtime = serviceDowntimeMs(incidents, serviceId, now, days);
  const tenths = Math.floor(((windowMs - downtime) * 1000) / windowMs);
  return tenths / 10;
}
