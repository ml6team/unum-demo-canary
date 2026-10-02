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
  /** UTC day, YYYY-MM-DD. */
  day: string;
  /** Worst impact of the incidents on this day; 'operational' when there was none. */
  status: ServiceStatus;
  incidentIds: string[];
}

export interface ServiceUptime {
  /** One entry per day, oldest first, the last one being the day of `now`. */
  days: UptimeDay[];
  /** 0 to 100, floored to two decimals; 100 only when there was no downtime. */
  uptimePercent: number;
}
