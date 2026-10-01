export type Impact = 'degraded' | 'partial-outage' | 'major-outage';

export type ServiceStatus = 'operational' | Impact;

export interface Service {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  /** ISO instant from which the service has been monitored. Absent means the whole window. */
  trackedSince?: string;
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
