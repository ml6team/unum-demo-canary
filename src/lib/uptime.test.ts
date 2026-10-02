import { describe, expect, it } from 'vitest';
import { NOW as FIXTURE_NOW, incidents as fixtureIncidents, services } from '../data';
import type { Incident } from './types';
import { serviceUptime, uptimeDayLabel } from './uptime';

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
    affectedServiceIds: ['api'],
    startedAt,
    resolvedAt,
    updates: [],
    ...extra,
  };
}

function statusOn(incidents: Incident[], serviceId: string, day: string) {
  return serviceUptime(serviceId, incidents, NOW).days.find((d) => d.day === day)?.status;
}

describe('serviceUptime days', () => {
  it('AC1: returns exactly 90 days, oldest first, ending on the current day', () => {
    const { days } = serviceUptime('api', [], NOW);
    expect(days).toHaveLength(90);
    expect(days[0]?.day).toBe('2026-07-04');
    expect(days[89]?.day).toBe('2026-10-01');
    const keys = days.map((d) => d.day);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(90);
  });

  it('AC1, AC3: a service with no incidents is operational every day and 100%', () => {
    const result = serviceUptime('api', [], NOW);
    expect(result.days.every((d) => d.status === 'operational')).toBe(true);
    expect(result.days.every((d) => d.incidentIds.length === 0)).toBe(true);
    expect(result.uptimePercent).toBe(100);
  });

  it('AC1: an unknown service id gets 90 operational days and 100%', () => {
    const result = serviceUptime(
      'nope',
      [incident('a', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z')],
      NOW,
    );
    expect(result.days).toHaveLength(90);
    expect(result.days.every((d) => d.status === 'operational')).toBe(true);
    expect(result.uptimePercent).toBe(100);
  });

  it('AC2: an incident colours only its own day with its impact', () => {
    const list = [
      incident('a', '2026-09-05T10:00:00Z', '2026-09-05T11:00:00Z', { impact: 'partial-outage' }),
    ];
    const { days } = serviceUptime('api', list, NOW);
    const marked = days.filter((d) => d.status !== 'operational');
    expect(marked).toHaveLength(1);
    expect(marked[0]).toEqual({ day: '2026-09-05', status: 'partial-outage', incidentIds: ['a'] });
  });

  it('AC2: an incident spanning midnight marks both days', () => {
    const list = [
      incident('a', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z', { impact: 'partial-outage' }),
    ];
    expect(statusOn(list, 'api', '2026-09-10')).toBe('partial-outage');
    expect(statusOn(list, 'api', '2026-09-11')).toBe('partial-outage');
    expect(statusOn(list, 'api', '2026-09-12')).toBe('operational');
  });

  it('AC2: an incident ending exactly at midnight does not mark the next day', () => {
    const list = [incident('a', '2026-09-10T22:00:00Z', '2026-09-11T00:00:00Z')];
    expect(statusOn(list, 'api', '2026-09-10')).toBe('degraded');
    expect(statusOn(list, 'api', '2026-09-11')).toBe('operational');
  });

  it('AC2: the most severe incident of the day decides, in either order', () => {
    const degraded = incident('d', '2026-09-05T01:00:00Z', '2026-09-05T02:00:00Z');
    const major = incident('m', '2026-09-05T10:00:00Z', '2026-09-05T11:00:00Z', {
      impact: 'major-outage',
    });
    expect(statusOn([degraded, major], 'api', '2026-09-05')).toBe('major-outage');
    expect(statusOn([major, degraded], 'api', '2026-09-05')).toBe('major-outage');
    const day = serviceUptime('api', [degraded, major], NOW).days.find(
      (d) => d.day === '2026-09-05',
    );
    expect([...(day?.incidentIds ?? [])].sort()).toEqual(['d', 'm']);
  });

  it('AC2: an active incident counts up to now and marks today', () => {
    const list = [incident('a', '2026-10-01T09:00:00Z', null, { impact: 'major-outage' })];
    expect(statusOn(list, 'api', '2026-10-01')).toBe('major-outage');
    const later = [incident('b', '2026-10-01T09:00:00Z', '2026-10-01T18:00:00Z')];
    expect(statusOn(later, 'api', '2026-10-01')).toBe('degraded');
  });

  it('AC2: an incident starting at or after now is ignored', () => {
    const list = [incident('a', '2026-10-01T12:00:00Z', '2026-10-01T14:00:00Z')];
    expect(statusOn(list, 'api', '2026-10-01')).toBe('operational');
    expect(serviceUptime('api', list, NOW).uptimePercent).toBe(100);
  });

  it('AC2: maintenance is ignored', () => {
    const list = [
      incident('m', '2026-09-05T10:00:00Z', '2026-09-05T12:00:00Z', {
        kind: 'maintenance',
        impact: 'major-outage',
      }),
    ];
    const result = serviceUptime('api', list, NOW);
    expect(result.days.every((d) => d.status === 'operational')).toBe(true);
    expect(result.uptimePercent).toBe(100);
  });

  it('AC1: honours a custom number of days', () => {
    const { days } = serviceUptime('api', [], NOW, 7);
    expect(days.map((d) => d.day)).toEqual([
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
  });
});

describe('serviceUptime isolation', () => {
  it("AC4: an incident of one service leaves another service's row unchanged", () => {
    const list = [
      incident('a', '2026-09-05T10:00:00Z', '2026-09-05T11:00:00Z', {
        affectedServiceIds: ['api'],
      }),
    ];
    expect(serviceUptime('web', list, NOW)).toEqual(serviceUptime('web', [], NOW));
    expect(serviceUptime('api', list, NOW)).not.toEqual(serviceUptime('api', [], NOW));
  });

  it('AC4: an incident affecting several services marks each listed service only', () => {
    const list = [
      incident('a', '2026-09-05T10:00:00Z', '2026-09-05T11:00:00Z', {
        affectedServiceIds: ['api', 'web'],
      }),
    ];
    expect(statusOn(list, 'api', '2026-09-05')).toBe('degraded');
    expect(statusOn(list, 'web', '2026-09-05')).toBe('degraded');
    expect(statusOn(list, 'git', '2026-09-05')).toBe('operational');
  });
});

describe('serviceUptime percentage', () => {
  it('AC3: 90 minutes of downtime gives the floored share of the window', () => {
    const list = [incident('a', '2026-09-05T10:00:00Z', '2026-09-05T11:30:00Z')];
    // window: 2026-07-04T00:00Z to 2026-10-01T12:00Z = 128 880 minutes
    expect(serviceUptime('api', list, NOW).uptimePercent).toBe(99.93);
  });

  it('AC3: overlapping incidents are counted once', () => {
    const single = [incident('a', '2026-09-05T10:00:00Z', '2026-09-05T11:30:00Z')];
    const overlapping = [
      incident('a', '2026-09-05T10:00:00Z', '2026-09-05T11:00:00Z'),
      incident('b', '2026-09-05T10:30:00Z', '2026-09-05T11:30:00Z'),
    ];
    expect(serviceUptime('api', overlapping, NOW).uptimePercent).toBe(
      serviceUptime('api', single, NOW).uptimePercent,
    );
  });

  it('AC3: any downtime gives less than 100', () => {
    const list = [incident('a', '2026-09-05T10:00:00Z', '2026-09-05T10:01:00Z')];
    const percent = serviceUptime('api', list, NOW).uptimePercent;
    expect(percent).toBeLessThan(100);
    expect(percent).toBeLessThanOrEqual(99.99);
  });

  it('AC3: an active incident counts up to now', () => {
    // 12 hours of the 128 880 minute window
    const list = [incident('a', '2026-10-01T00:00:00Z', null)];
    expect(serviceUptime('api', list, NOW).uptimePercent).toBe(99.44);
  });

  it('AC3: an incident that began before the window is clipped to it', () => {
    // only 2026-07-04T00:00Z to 02:00Z, 120 minutes, lies inside the window
    const list = [incident('a', '2026-07-03T20:00:00Z', '2026-07-04T02:00:00Z')];
    expect(serviceUptime('api', list, NOW).uptimePercent).toBe(99.9);
  });
});

describe('uptimeDayLabel', () => {
  it('AC5: names the formatted date and the status', () => {
    expect(
      uptimeDayLabel({ day: '2026-09-10', status: 'partial-outage', incidentIds: ['a'] }),
    ).toBe('Sep 10, 2026: Partial outage');
  });

  it('AC5: says "No incidents" for an operational day', () => {
    expect(uptimeDayLabel({ day: '2026-09-10', status: 'operational', incidentIds: [] })).toBe(
      'Sep 10, 2026: No incidents',
    );
  });
});

describe('serviceUptime with the fixtures', () => {
  it('AC1: every service gets 90 days ending on the current day', () => {
    for (const service of services) {
      const { days } = serviceUptime(service.id, fixtureIncidents, FIXTURE_NOW);
      expect(days).toHaveLength(90);
      expect(days[0]?.day).toBe('2026-07-04');
      expect(days[89]?.day).toBe('2026-10-01');
    }
  });

  it('AC2, AC4: Search shows a partial outage on Sep 10 and 11, other services do not', () => {
    const search = serviceUptime('search', fixtureIncidents, FIXTURE_NOW);
    const on = (day: string) => search.days.find((d) => d.day === day)?.status;
    expect(on('2026-09-10')).toBe('partial-outage');
    expect(on('2026-09-11')).toBe('partial-outage');
    expect(search.uptimePercent).toBeLessThan(100);
    const webhooks = serviceUptime('webhooks', fixtureIncidents, FIXTURE_NOW);
    expect(webhooks.days.find((d) => d.day === '2026-09-10')?.status).toBe('operational');
  });
});
