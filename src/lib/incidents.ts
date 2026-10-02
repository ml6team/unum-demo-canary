import { worstStatus } from './status';
import { addUtcDays, startOfUtcDay, utcDayKey } from './time';
import type { Incident, IncidentUpdate, Service, ServiceStatus } from './types';

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

/** The `[start, end)` span in ms during which an incident affected a service, or null. */
function interval(
  incident: Incident,
  serviceId: string,
  now: Date,
  from: number,
): [number, number] | null {
  if (!incident.affectedServiceIds.includes(serviceId)) return null;
  if (incidentState(incident, now) === 'upcoming') return null;
  const start = Math.max(Date.parse(incident.startedAt), from);
  const end = Math.min(
    incident.resolvedAt === null ? now.getTime() : Date.parse(incident.resolvedAt),
    now.getTime(),
  );
  return start < end ? [start, end] : null;
}

export interface DayBar {
  day: string;
  /** 'operational' means no incident that day. */
  status: ServiceStatus;
}

/** One bar per UTC day of the window, oldest first; the last bar is the day of `now`. */
export function dailyBars(
  incidents: Incident[],
  serviceId: string,
  now: Date,
  days = HISTORY_DAYS,
): DayBar[] {
  const first = historyStart(now, days);
  const spans = incidents.flatMap((incident) => {
    const span = interval(incident, serviceId, now, first.getTime());
    return span ? [{ impact: incident.impact, span }] : [];
  });
  return Array.from({ length: days }, (_, index) => {
    const dayStart = addUtcDays(first, index);
    const from = dayStart.getTime();
    const to = addUtcDays(dayStart, 1).getTime();
    const impacts = spans
      .filter(({ span: [start, end] }) => start < to && end > from)
      .map(({ impact }) => impact);
    return { day: utcDayKey(dayStart), status: worstStatus(impacts) };
  });
}

/**
 * Uptime in percent of the window from the start of the first day to `now`, rounded down to two
 * decimals. Overlapping incidents count once; it is 100 only when nothing affected the service.
 */
export function uptimePercent(
  incidents: Incident[],
  serviceId: string,
  now: Date,
  days = HISTORY_DAYS,
): number {
  const from = historyStart(now, days).getTime();
  const spans = incidents
    .map((incident) => interval(incident, serviceId, now, from))
    .filter((span): span is [number, number] => span !== null)
    .sort((a, b) => a[0] - b[0]);
  let affected = 0;
  let reachedEnd = from;
  for (const [start, end] of spans) {
    affected += Math.max(0, end - Math.max(start, reachedEnd));
    reachedEnd = Math.max(reachedEnd, end);
  }
  if (affected === 0) return 100;
  const window = now.getTime() - from;
  return Math.floor(((window - affected) * 10000) / window) / 100;
}

/** Services that are affected by at least one of the incidents, in the order of `services`. */
export function servicesWithIncidents(incidents: Incident[], services: Service[]): Service[] {
  const affected = new Set(incidents.flatMap((i) => i.affectedServiceIds));
  return services.filter((s) => affected.has(s.id));
}

/**
 * Incidents that affect at least one of the selected services. An empty selection returns
 * all incidents. Keeps the input order. Unknown ids match nothing.
 */
export function filterByServices(incidents: Incident[], selectedServiceIds: string[]): Incident[] {
  if (selectedServiceIds.length === 0) return incidents;
  return incidents.filter((i) =>
    i.affectedServiceIds.some((id) => selectedServiceIds.includes(id)),
  );
}
