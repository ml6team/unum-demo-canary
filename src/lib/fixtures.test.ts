import { describe, expect, it } from 'vitest';
import { incidents, NOW, services } from '../data';
import {
  activeIncidents,
  buildTimeline,
  dailyStatuses,
  historyStart,
  incidentState,
  pastIncidents,
  serviceUptime,
} from './incidents';
import { STATUS_LABEL } from './status';
import { utcDayKey } from './time';

const IMPACTS = ['degraded', 'partial-outage', 'major-outage'];
const INCIDENT_UPDATES = ['investigating', 'identified', 'monitoring', 'resolved'];
const MAINTENANCE_UPDATES = ['scheduled', 'in-progress', 'completed'];

describe('fixtures', () => {
  const serviceIds = new Set(services.map((s) => s.id));

  it('has unique service and incident ids', () => {
    expect(serviceIds.size).toBe(services.length);
    expect(new Set(incidents.map((i) => i.id)).size).toBe(incidents.length);
  });

  it('uses known service statuses and impacts', () => {
    for (const s of services) expect(Object.keys(STATUS_LABEL)).toContain(s.status);
    for (const i of incidents) expect(IMPACTS).toContain(i.impact);
  });

  it('only references services that exist', () => {
    for (const i of incidents) {
      expect(i.affectedServiceIds.length).toBeGreaterThan(0);
      for (const id of i.affectedServiceIds) expect(serviceIds).toContain(id);
    }
  });

  it('has every past incident inside the 90-day history window', () => {
    const from = historyStart(NOW).getTime();
    for (const i of incidents) {
      if (incidentState(i, NOW) === 'upcoming') continue;
      expect(Date.parse(i.startedAt)).toBeGreaterThanOrEqual(from);
    }
  });

  it('ends every incident after it starts', () => {
    for (const i of incidents) {
      if (i.resolvedAt === null) continue;
      expect(Date.parse(i.resolvedAt)).toBeGreaterThan(Date.parse(i.startedAt));
    }
  });

  it('keeps updates in order, with statuses that match the kind', () => {
    for (const i of incidents) {
      const allowed = i.kind === 'maintenance' ? MAINTENANCE_UPDATES : INCIDENT_UPDATES;
      const times = i.updates.map((u) => Date.parse(u.at));
      expect(times).toEqual([...times].sort((a, b) => a - b));
      for (const u of i.updates) expect(allowed).toContain(u.status);
      if (incidentState(i, NOW) === 'resolved') {
        expect(i.updates.at(-1)?.at).toBe(i.resolvedAt);
      }
    }
  });

  it('marks a service non-operational exactly when an active incident affects it', () => {
    const affected = new Set(activeIncidents(incidents, NOW).flatMap((i) => i.affectedServiceIds));
    for (const s of services) expect(s.status !== 'operational').toBe(affected.has(s.id));
  });

  it('covers the edge cases a daily view has to handle', () => {
    const past = incidents.filter((i) => incidentState(i, NOW) === 'resolved');
    const spansMidnight = past.some(
      (i) => i.resolvedAt !== null && utcDayKey(i.startedAt) !== utcDayKey(i.resolvedAt),
    );
    expect(spansMidnight).toBe(true);
    expect(past.some((i) => i.kind === 'maintenance')).toBe(true);
    expect(past.some((i) => i.affectedServiceIds.length > 1)).toBe(true);
    expect(incidents.some((i) => incidentState(i, NOW) === 'upcoming')).toBe(true);
  });
});

describe('fixtures: 90-day uptime', () => {
  const statusOn = (serviceId: string, day: string) =>
    dailyStatuses(serviceId, incidents, NOW).find((d) => d.day === day)?.status;

  it('AC2: colours the day of a single-service incident and not the next day', () => {
    expect(statusOn('git', '2026-07-30')).toBe('partial-outage');
    expect(statusOn('git', '2026-07-31')).toBe('operational');
  });

  it('AC4, AC5: colours both days of an incident that spans midnight', () => {
    expect(statusOn('search', '2026-09-10')).toBe('partial-outage');
    expect(statusOn('search', '2026-09-11')).toBe('partial-outage');
  });

  it('AC4: colours a service listed on a shared incident', () => {
    expect(statusOn('api', '2026-09-13')).toBe('degraded');
    expect(statusOn('search', '2026-09-13')).toBe('degraded');
  });

  it('AC1, AC3: gives every service 90 days and an uptime just under 100%', () => {
    for (const s of services) {
      const result = serviceUptime(s.id, incidents, NOW);
      expect(result.days).toHaveLength(90);
      expect(result.uptime).toBeGreaterThan(0.99);
      expect(result.uptime).toBeLessThan(1);
    }
  });
});

describe('fixtures: timeline', () => {
  const timelineItems = () => buildTimeline(incidents, NOW).items;

  it('AC1, AC2: plots exactly the past incidents and not upcoming maintenance', () => {
    expect(timelineItems().map((i) => i.incident.id)).toEqual(
      pastIncidents(incidents, NOW).map((i) => i.id),
    );
    expect(timelineItems().map((i) => i.incident.id)).not.toContain(
      'mnt-2026-10-04-search-upgrade',
    );
  });

  it('AC3: keeps every item inside the window with a non-negative duration', () => {
    for (const item of timelineItems()) {
      expect(item.start).toBeGreaterThanOrEqual(0);
      expect(item.start).toBeLessThanOrEqual(item.end);
      expect(item.end).toBeLessThanOrEqual(1);
    }
  });

  it('AC3: gives the incident spanning midnight a visible duration', () => {
    const item = timelineItems().find((i) => i.incident.id === 'inc-2026-09-10-search-errors');
    expect(item).toBeDefined();
    expect(item?.end).toBeGreaterThan(item?.start ?? 1);
  });
});
