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

export const ALL_SERVICES = 'all';

/** Services that appear in at least one incident, in the order `services` lists them. */
export function servicesWithIncidents(incidents: Incident[], services: Service[]): Service[] {
  const ids = new Set(incidents.flatMap((i) => i.affectedServiceIds));
  return services.filter((s) => ids.has(s.id));
}

/** All incidents when serviceId is ALL_SERVICES, else those whose affectedServiceIds include it. */
export function filterByService(incidents: Incident[], serviceId: string): Incident[] {
  if (serviceId === ALL_SERVICES) return incidents;
  return incidents.filter((i) => i.affectedServiceIds.includes(serviceId));
}

export function incidentCountLabel(count: number): string {
  return count === 1 ? '1 incident' : `${count} incidents`;
}

/** Empty-state text for the history list, for one service or (null) for all of them. */
export function emptyHistoryMessage(serviceName: string | null): string {
  return serviceName === null
    ? `No incidents reported in the last ${HISTORY_DAYS} days.`
    : `No incidents reported for ${serviceName} in the last ${HISTORY_DAYS} days.`;
}
