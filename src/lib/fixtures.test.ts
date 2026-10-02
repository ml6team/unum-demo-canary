import { describe, expect, it } from 'vitest';
import { incidents, NOW, services } from '../data';
import {
  activeIncidents,
  dailyBars,
  historyStart,
  incidentState,
  servicesWithIncidents,
  uptimePercent,
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

  it('AC1 to AC5: derives per-service bars and uptime from the fixtures', () => {
    const barOn = (serviceId: string, day: string) =>
      dailyBars(incidents, serviceId, NOW).find((b) => b.day === day)?.status;
    expect(barOn('search', '2026-09-10')).toBe('partial-outage');
    expect(barOn('search', '2026-09-11')).toBe('partial-outage');
    expect(barOn('search', '2026-09-12')).toBe('degraded');
    expect(barOn('search', '2026-09-14')).toBe('operational');
    expect(barOn('webhooks', '2026-08-27')).toBe('operational');
    expect(barOn('api', '2026-08-27')).toBe('partial-outage');
    expect(barOn('web', '2026-08-27')).toBe('partial-outage');
    expect(uptimePercent(incidents, 'search', NOW)).toBe(99.56);
    expect(uptimePercent(incidents, 'webhooks', NOW)).toBe(99.83);
    for (const s of services) expect(uptimePercent(incidents, s.id, NOW)).toBeLessThan(100);
  });

  it('AC1: offers every service in the incident filter', () => {
    expect(servicesWithIncidents(incidents, services)).toEqual(services);
  });
});
