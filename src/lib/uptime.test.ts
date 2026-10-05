import { describe, expect, it } from 'vitest';
import { incidents as fixtureIncidents, services } from '../data';
import type { Incident } from './types';
import { serviceUptime } from './uptime';

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

function statusOn(list: Incident[], day: string, serviceId = 'api') {
  return serviceUptime(serviceId, list, NOW).days.find((d) => d.day === day)?.status;
}

describe('serviceUptime days', () => {
  it('AC1: has 90 days in ascending order, ending on the day of now', () => {
    const { days } = serviceUptime('api', [], NOW);
    expect(days).toHaveLength(90);
    expect(days[0]?.day).toBe('2026-07-04');
    expect(days.at(-1)?.day).toBe('2026-10-01');
    const keys = days.map((d) => d.day);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(90);
  });

  it('AC2: is operational on every day when there are no incidents', () => {
    const { days, percent } = serviceUptime('api', [], NOW);
    expect(days.every((d) => d.status === 'operational')).toBe(true);
    expect(percent).toBe(100);
  });

  it('AC3: colours only the day of an incident with its impact', () => {
    const list = [incident('a', '2026-09-05T10:00:00Z', '2026-09-05T11:00:00Z')];
    const { days } = serviceUptime('api', list, NOW);
    expect(days.find((d) => d.day === '2026-09-05')?.status).toBe('degraded');
    expect(days.filter((d) => d.status !== 'operational')).toHaveLength(1);
  });

  it('AC3: the most severe incident wins on a day, in either order', () => {
    const minor = incident('minor', '2026-09-05T08:00:00Z', '2026-09-05T09:00:00Z');
    const major = incident('major', '2026-09-05T14:00:00Z', '2026-09-05T15:00:00Z', {
      impact: 'major-outage',
    });
    expect(statusOn([minor, major], '2026-09-05')).toBe('major-outage');
    expect(statusOn([major, minor], '2026-09-05')).toBe('major-outage');
  });

  it('AC3: an incident that crosses midnight colours both days', () => {
    const list = [
      incident('a', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z', { impact: 'partial-outage' }),
    ];
    expect(statusOn(list, '2026-09-10')).toBe('partial-outage');
    expect(statusOn(list, '2026-09-11')).toBe('partial-outage');
    expect(statusOn(list, '2026-09-12')).toBe('operational');
  });

  it('AC3: an incident that ends exactly at midnight does not colour the next day', () => {
    const list = [incident('a', '2026-09-10T22:00:00Z', '2026-09-11T00:00:00Z')];
    expect(statusOn(list, '2026-09-10')).toBe('degraded');
    expect(statusOn(list, '2026-09-11')).toBe('operational');
  });

  it('AC3: an open incident colours today', () => {
    const list = [incident('a', '2026-10-01T09:00:00Z', null, { impact: 'major-outage' })];
    expect(statusOn(list, '2026-10-01')).toBe('major-outage');
  });
});

describe('serviceUptime percent', () => {
  it('AC4: is below 100 even for a one-minute incident', () => {
    const list = [incident('a', '2026-09-05T10:00:00Z', '2026-09-05T10:01:00Z')];
    const { percent } = serviceUptime('api', list, NOW);
    expect(percent).toBeLessThan(100);
    expect(percent).toBeGreaterThan(99.9);
  });

  it('AC4: a full-day incident gives 98.88 because the window is 89.5 days', () => {
    const list = [incident('a', '2026-09-05T00:00:00Z', '2026-09-06T00:00:00Z')];
    expect(serviceUptime('api', list, NOW).percent).toBe(98.88);
  });

  it('AC4: overlapping incidents count once', () => {
    const list = [
      incident('a', '2026-09-05T00:00:00Z', '2026-09-05T18:00:00Z'),
      incident('b', '2026-09-05T06:00:00Z', '2026-09-06T00:00:00Z'),
    ];
    expect(serviceUptime('api', list, NOW).percent).toBe(98.88);
  });

  it('AC4: an open incident counts up to now', () => {
    const list = [incident('a', '2026-10-01T00:00:00Z', null)];
    // 12h of 89.5 days
    expect(serviceUptime('api', list, NOW).percent).toBe(99.44);
  });

  it('AC4: an incident resolving after now counts only up to now', () => {
    const list = [incident('a', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z')];
    expect(serviceUptime('api', list, NOW).percent).toBe(99.44);
  });
});

describe('serviceUptime scope', () => {
  it('AC5: ignores incidents older than 90 days', () => {
    const list = [incident('old', '2026-06-01T10:00:00Z', '2026-06-01T12:00:00Z')];
    const result = serviceUptime('api', list, NOW);
    expect(result.days.every((d) => d.status === 'operational')).toBe(true);
    expect(result.percent).toBe(100);
  });

  it('AC5: ignores an incident that ended before the window start', () => {
    const list = [incident('old', '2026-07-03T20:00:00Z', '2026-07-04T00:00:00Z')];
    const result = serviceUptime('api', list, NOW);
    expect(result.days[0]?.status).toBe('operational');
    expect(result.percent).toBe(100);
  });

  it('AC5: counts only the part of an incident inside the window', () => {
    const list = [incident('edge', '2026-07-03T12:00:00Z', '2026-07-04T12:00:00Z')];
    const result = serviceUptime('api', list, NOW);
    expect(result.days[0]?.status).toBe('degraded');
    // 12h of 89.5 days
    expect(result.percent).toBe(99.44);
  });

  it('AC5: ignores incidents of other services', () => {
    const list = [
      incident('a', '2026-09-05T10:00:00Z', '2026-09-05T12:00:00Z', {
        affectedServiceIds: ['web'],
      }),
    ];
    const result = serviceUptime('api', list, NOW);
    expect(result.days.every((d) => d.status === 'operational')).toBe(true);
    expect(result.percent).toBe(100);
  });

  it('AC5: an incident affecting several services appears on each of them', () => {
    const list = [
      incident('a', '2026-09-05T10:00:00Z', '2026-09-05T12:00:00Z', {
        affectedServiceIds: ['api', 'web'],
      }),
    ];
    expect(statusOn(list, '2026-09-05', 'api')).toBe('degraded');
    expect(statusOn(list, '2026-09-05', 'web')).toBe('degraded');
    expect(statusOn(list, '2026-09-05', 'git')).toBe('operational');
  });

  it('ignores upcoming incidents', () => {
    const list = [incident('a', '2026-10-03T10:00:00Z', '2026-10-03T12:00:00Z')];
    const result = serviceUptime('api', list, NOW);
    expect(result.days.every((d) => d.status === 'operational')).toBe(true);
    expect(result.percent).toBe(100);
  });

  it('ignores maintenance', () => {
    const list = [
      incident('m', '2026-09-05T10:00:00Z', '2026-09-05T12:00:00Z', { kind: 'maintenance' }),
    ];
    const result = serviceUptime('api', list, NOW);
    expect(result.days.every((d) => d.status === 'operational')).toBe(true);
    expect(result.percent).toBe(100);
  });
});

describe('serviceUptime with the fixtures', () => {
  it('AC1: every service has 90 days', () => {
    for (const service of services) {
      expect(serviceUptime(service.id, fixtureIncidents, NOW).days).toHaveLength(90);
    }
  });

  it('AC3: webhooks was in a major outage on 2026-08-19', () => {
    expect(statusOn(fixtureIncidents, '2026-08-19', 'webhooks')).toBe('major-outage');
  });

  it('AC3: search was in a partial outage on 2026-09-10 and 2026-09-11', () => {
    expect(statusOn(fixtureIncidents, '2026-09-10', 'search')).toBe('partial-outage');
    expect(statusOn(fixtureIncidents, '2026-09-11', 'search')).toBe('partial-outage');
  });

  it('AC4: every service has an uptime below 100', () => {
    for (const service of services) {
      expect(serviceUptime(service.id, fixtureIncidents, NOW).percent).toBeLessThan(100);
    }
  });
});
