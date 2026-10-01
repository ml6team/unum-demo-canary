import type { IncidentUpdateStatus, Service, ServiceStatus } from './types';
import type { DayTone } from './uptime';

const SEVERITY: Record<ServiceStatus, number> = {
  operational: 0,
  degraded: 1,
  'partial-outage': 2,
  'major-outage': 3,
};

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded performance',
  'partial-outage': 'Partial outage',
  'major-outage': 'Major outage',
};

export const DAY_TONE_LABEL: Record<DayTone, string> = {
  ...STATUS_LABEL,
  operational: 'No incident',
  maintenance: 'Maintenance',
};

const OVERALL_TITLE: Record<ServiceStatus, string> = {
  operational: 'All systems operational',
  degraded: 'Some systems are experiencing degraded performance',
  'partial-outage': 'Partial system outage',
  'major-outage': 'Major system outage',
};

export function compareSeverity(a: ServiceStatus, b: ServiceStatus): number {
  return SEVERITY[a] - SEVERITY[b];
}

/** The most severe of the given statuses; operational when there are none. */
export function worstStatus(statuses: Iterable<ServiceStatus>): ServiceStatus {
  let worst: ServiceStatus = 'operational';
  for (const status of statuses) {
    if (compareSeverity(status, worst) > 0) worst = status;
  }
  return worst;
}

export interface OverallStatus {
  status: ServiceStatus;
  title: string;
  affected: Service[];
}

export function overallStatus(services: Service[]): OverallStatus {
  const status = worstStatus(services.map((s) => s.status));
  return {
    status,
    title: OVERALL_TITLE[status],
    affected: services.filter((s) => s.status !== 'operational'),
  };
}

export const UPDATE_LABEL: Record<IncidentUpdateStatus, string> = {
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  completed: 'Completed',
};
