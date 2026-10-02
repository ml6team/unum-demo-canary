export type Impact = 'degraded' | 'partial-outage' | 'major-outage';

export type ServiceStatus = 'operational' | Impact;

export interface Service {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
}

export type IncidentKind = 'incident' | 'maintenance';

export type IncidentUpdateStatus =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved'
  | 'scheduled'
  | 'in-progress'
  | 'completed';

export interface IncidentUpdate {
  at: string;
  status: IncidentUpdateStatus;
  body: string;
}

/**
 * Times are ISO 8601 instants in UTC. For maintenance, startedAt and resolvedAt are the
 * planned window until it has happened, then the actual one. resolvedAt is null while an
 * incident is ongoing.
 */
export interface Incident {
  id: string;
  kind: IncidentKind;
  title: string;
  impact: Impact;
  affectedServiceIds: string[];
  startedAt: string;
  resolvedAt: string | null;
  updates: IncidentUpdate[];
}

export interface UptimeDay {
  /** The UTC day, as YYYY-MM-DD. */
  day: string;
  /** The worst impact of any incident covering the day; operational when there is none. */
  status: ServiceStatus;
}

export interface ServiceUptime {
  serviceId: string;
  /** One entry per day of the history window, oldest first; the last is the day of `now`. */
  days: UptimeDay[];
  /** Share of the window the service was not affected by an incident, from 0 to 1. */
  uptime: number;
}
