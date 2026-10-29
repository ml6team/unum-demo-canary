import { describe, expect, it } from 'vitest';
import { incidents as fixtureIncidents } from '../data/index';
import type { Incident } from './types';
import { serviceUptimeHistory, uptimePercent } from './uptime';

const NOW = new Date('2026-10-01T12:00:00Z');

function incident(
  id: string,
  startedAt: string,
  resolvedAt: string | null,
  extra: Partial<Incident> = {},
): Incident {
  return {
    id,
    kind: 'incident',
    title: id,
    impact: 'degraded',
    affectedServiceIds: ['svc'],
    startedAt,
    resolvedAt,
    updates: [],
    ...extra,
  };
}

describe('serviceUptimeHistory', () => {
  it('AC2: returns exactly 90 entries for any service', () => {
    const result = serviceUptimeHistory('svc', [], NOW);
    expect(result).toHaveLength(90);
  });

  it('AC2: entries are oldest first, first day is 2026-07-04, last is 2026-10-01', () => {
    const result = serviceUptimeHistory('svc', [], NOW);
    expect(result[0]?.day).toBe('2026-07-04');
    expect(result[89]?.day).toBe('2026-10-01');
  });

  it('AC2: a day with incidents is coloured by the worst impact that day', () => {
    const incs = [
      incident('a', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z', {
        impact: 'partial-outage',
      }),
      incident('b', '2026-09-01T12:00:00Z', '2026-09-01T13:00:00Z', {
        impact: 'major-outage',
      }),
    ];
    const result = serviceUptimeHistory('svc', incs, NOW);
    const day = result.find((d) => d.day === '2026-09-01');
    expect(day?.status).toBe('major-outage');
  });

  it('AC2: maintenance-only days are coloured operational', () => {
    const incs = [
      incident('m', '2026-09-05T02:00:00Z', '2026-09-05T03:00:00Z', {
        kind: 'maintenance',
        impact: 'partial-outage',
      }),
    ];
    const result = serviceUptimeHistory('svc', incs, NOW);
    const day = result.find((d) => d.day === '2026-09-05');
    expect(day?.status).toBe('operational');
    expect(day?.incidents).toHaveLength(0);
  });

  it('AC2: a cross-midnight incident appears on both days it overlaps', () => {
    const incs = [
      incident('night', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z', {
        impact: 'partial-outage',
      }),
    ];
    const result = serviceUptimeHistory('svc', incs, NOW);
    const day10 = result.find((d) => d.day === '2026-09-10');
    const day11 = result.find((d) => d.day === '2026-09-11');
    expect(day10?.incidents.map((i) => i.id)).toContain('night');
    expect(day11?.incidents.map((i) => i.id)).toContain('night');
  });

  it('AC2: overlapping incidents on the same day pick the worst status', () => {
    const incs = [
      incident('x', '2026-08-15T08:00:00Z', '2026-08-15T09:00:00Z', {
        impact: 'degraded',
      }),
      incident('y', '2026-08-15T10:00:00Z', '2026-08-15T11:00:00Z', {
        impact: 'partial-outage',
      }),
    ];
    const result = serviceUptimeHistory('svc', incs, NOW);
    const day = result.find((d) => d.day === '2026-08-15');
    expect(day?.status).toBe('partial-outage');
  });
});

describe('serviceUptimeHistory pre-window clamping', () => {
  it('AC2: a pre-window incident whose end overlaps the first window day appears on that day', () => {
    // Starts one day before historyStart (2026-07-03), ends two hours into the first window day.
    const incs = [
      incident('pre', '2026-07-03T22:00:00Z', '2026-07-04T02:00:00Z', {
        impact: 'partial-outage',
      }),
    ];
    const result = serviceUptimeHistory('svc', incs, NOW);
    const firstDay = result[0];
    expect(firstDay?.day).toBe('2026-07-04');
    expect(firstDay?.incidents.map((i) => i.id)).toContain('pre');
    expect(firstDay?.status).toBe('partial-outage');
  });
});

describe('uptimePercent pre-window clamping', () => {
  it('AC1: a pre-window incident that ends inside the window counts only its overlap', () => {
    // 2-day window: 2026-09-30T00:00:00Z → 2026-10-01T12:00:00Z = 2160 min
    // Incident: 2026-09-29T23:00:00Z → 2026-09-30T01:00:00Z (starts 1h before window)
    // Overlap = 2026-09-30T00:00:00Z → 2026-09-30T01:00:00Z = 60 min downtime
    // Uptime = (2160 - 60) / 2160 = 97.2%
    const incs = [
      incident('pre', '2026-09-29T23:00:00Z', '2026-09-30T01:00:00Z', {
        impact: 'partial-outage',
      }),
    ];
    const pct = uptimePercent('svc', incs, NOW, 2);
    expect(pct).toBe(97.2);
  });
});

describe('uptimePercent', () => {
  it('AC1: returns 100.0 when there are no incidents', () => {
    expect(uptimePercent('svc', [], NOW)).toBe(100.0);
  });

  it('AC1: percentage formula — 1 hour partial-outage in a 2-day window', () => {
    // now2 at noon; 2-day window: 2026-09-30T00:00:00Z → 2026-10-01T12:00:00Z = 2160 min
    // downtime = 60 min; uptime = (2160-60)/2160 = 97.2%
    const now2 = new Date('2026-10-01T12:00:00Z');
    const incs = [
      incident('p', '2026-09-30T06:00:00Z', '2026-09-30T07:00:00Z', {
        impact: 'partial-outage',
      }),
    ];
    // historyStart(now2, 2) = addUtcDays(startOfUtcDay(now2), -(2-1)) = 2026-09-30T00:00:00Z
    // total = (2026-10-01T12:00:00Z - 2026-09-30T00:00:00Z) / 60000ms = 2160 min
    const pct = uptimePercent('svc', incs, now2, 2);
    expect(pct).toBe(97.2);
  });

  it('AC1: degraded incidents do not count as downtime', () => {
    const incs = [
      incident('d', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z', {
        impact: 'degraded',
      }),
    ];
    expect(uptimePercent('svc', incs, NOW)).toBe(100.0);
  });

  it('AC1: maintenance incidents are excluded from downtime', () => {
    const incs = [
      incident('m', '2026-09-05T02:00:00Z', '2026-09-05T03:30:00Z', {
        kind: 'maintenance',
        impact: 'partial-outage',
      }),
    ];
    expect(uptimePercent('svc', incs, NOW)).toBe(100.0);
  });

  it('AC1: fixture data percentages match hand-calculated values', () => {
    const cases: [string, number][] = [
      ['api', 100.0],
      ['web', 100.0],
      ['git', 100.0],
      ['webhooks', 99.9],
      ['notifications', 100.0],
      ['search', 99.8],
    ];
    for (const [serviceId, expected] of cases) {
      expect(uptimePercent(serviceId, fixtureIncidents, NOW), `${serviceId} uptime`).toBe(expected);
    }
  });
});
