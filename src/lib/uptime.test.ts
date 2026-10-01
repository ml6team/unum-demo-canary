import { describe, expect, it } from 'vitest';
import { NOW as FIXTURE_NOW, incidents as fixtureIncidents, services } from '../data';
import { DAY_MS, MINUTE_MS } from './time';
import type { Incident } from './types';
import { incidentsForService, serviceUptime, uptimeDays, uptimePercent } from './uptime';

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

function statusOn(serviceId: string, list: Incident[], day: string) {
  return uptimeDays(serviceId, list, NOW).find((d) => d.day === day)?.status;
}

describe('incidentsForService', () => {
  const list = [
    incident('mine', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z'),
    incident('other', '2026-09-02T10:00:00Z', '2026-09-02T11:00:00Z', {
      affectedServiceIds: ['web'],
    }),
    incident('multi', '2026-09-03T10:00:00Z', '2026-09-03T11:00:00Z', {
      affectedServiceIds: ['web', 'api'],
    }),
    incident('maint', '2026-09-04T10:00:00Z', '2026-09-04T11:00:00Z', { kind: 'maintenance' }),
    incident('upcoming', '2026-10-04T10:00:00Z', '2026-10-04T11:00:00Z'),
    incident('open', '2026-10-01T11:00:00Z', null),
  ];

  it('AC5: keeps only incidents of that service that have started, without maintenance', () => {
    expect(incidentsForService('api', list, NOW).map((i) => i.id)).toEqual([
      'mine',
      'multi',
      'open',
    ]);
  });

  it('AC5: is empty for an unknown service', () => {
    expect(incidentsForService('nope', list, NOW)).toEqual([]);
  });
});

describe('uptimeDays', () => {
  it('AC1: returns 90 consecutive UTC days ending on the day of now, oldest first', () => {
    const days = uptimeDays('api', [], NOW);
    expect(days).toHaveLength(90);
    expect(days[0]?.day).toBe('2026-07-04');
    expect(days[89]?.day).toBe('2026-10-01');
    for (let i = 1; i < days.length; i++) {
      const gap = Date.parse(days[i]?.day ?? '') - Date.parse(days[i - 1]?.day ?? '');
      expect(gap).toBe(DAY_MS);
    }
  });

  it('AC1: honours a custom number of days', () => {
    const days = uptimeDays('api', [], NOW, 7);
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

  it('AC1: an incident crossing midnight colours both days and not the days around them', () => {
    const list = [incident('a', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')];
    expect(statusOn('api', list, '2026-09-09')).toBe('operational');
    expect(statusOn('api', list, '2026-09-10')).toBe('degraded');
    expect(statusOn('api', list, '2026-09-11')).toBe('degraded');
    expect(statusOn('api', list, '2026-09-12')).toBe('operational');
  });

  it('AC1: an incident ending exactly at midnight does not touch the next day', () => {
    const list = [incident('a', '2026-09-10T22:00:00Z', '2026-09-11T00:00:00Z')];
    expect(statusOn('api', list, '2026-09-10')).toBe('degraded');
    expect(statusOn('api', list, '2026-09-11')).toBe('operational');
  });

  it('AC1: an incident from before the window only colours the days inside it', () => {
    const list = [incident('a', '2026-06-30T10:00:00Z', '2026-07-05T10:00:00Z')];
    const days = uptimeDays('api', list, NOW);
    expect(days).toHaveLength(90);
    expect(days[0]).toEqual({ day: '2026-07-04', status: 'degraded' });
    expect(days[1]).toEqual({ day: '2026-07-05', status: 'degraded' });
    expect(days[2]?.status).toBe('operational');
  });

  it('AC2: every day is operational without incidents', () => {
    expect(uptimeDays('api', [], NOW).every((d) => d.status === 'operational')).toBe(true);
  });

  it('AC2: a maintenance window leaves its day operational', () => {
    const list = [
      incident('m', '2026-08-08T02:00:00Z', '2026-08-08T03:30:00Z', {
        kind: 'maintenance',
        impact: 'partial-outage',
      }),
    ];
    expect(statusOn('api', list, '2026-08-08')).toBe('operational');
  });

  it('AC2: an incident that has not started yet leaves its day operational', () => {
    const list = [incident('u', '2026-10-01T13:00:00Z', '2026-10-01T14:00:00Z')];
    expect(statusOn('api', list, '2026-10-01')).toBe('operational');
  });

  describe('AC3: most severe incident of the day', () => {
    const longestDegraded = incident('long', '2026-09-20T09:00:00Z', '2026-09-20T12:00:00Z', {
      impact: 'degraded',
    });
    const severeShort = incident('severe', '2026-09-20T10:00:00Z', '2026-09-20T10:05:00Z', {
      impact: 'major-outage',
    });
    const latestPartial = incident('late', '2026-09-20T20:00:00Z', '2026-09-20T20:30:00Z', {
      impact: 'partial-outage',
    });

    it('AC3: picks the most severe, not the longest or the latest', () => {
      const list = [longestDegraded, severeShort, latestPartial];
      expect(statusOn('api', list, '2026-09-20')).toBe('major-outage');
    });

    it('AC3: does not depend on the order of the incidents', () => {
      const list = [latestPartial, severeShort, longestDegraded].reverse();
      expect(statusOn('api', list, '2026-09-20')).toBe('major-outage');
      expect(statusOn('api', [latestPartial, longestDegraded], '2026-09-20')).toBe(
        'partial-outage',
      );
    });
  });

  it('AC3: an open incident colours today with its impact', () => {
    const list = [incident('open', '2026-10-01T09:00:00Z', null, { impact: 'partial-outage' })];
    expect(statusOn('api', list, '2026-10-01')).toBe('partial-outage');
  });

  it('AC3: an incident resolving after now colours today with its impact', () => {
    const list = [
      incident('soon', '2026-10-01T11:00:00Z', '2026-10-01T15:00:00Z', { impact: 'major-outage' }),
    ];
    expect(statusOn('api', list, '2026-10-01')).toBe('major-outage');
  });

  it('AC5: an incident on one service does not colour another service', () => {
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z')];
    expect(uptimeDays('web', list, NOW)).toEqual(uptimeDays('web', [], NOW));
    expect(statusOn('api', list, '2026-09-10')).toBe('degraded');
  });

  it('AC5: a multi-service incident colours exactly the listed services', () => {
    const list = [
      incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z', {
        affectedServiceIds: ['api', 'git'],
      }),
    ];
    expect(statusOn('api', list, '2026-09-10')).toBe('degraded');
    expect(statusOn('git', list, '2026-09-10')).toBe('degraded');
    expect(uptimeDays('web', list, NOW)).toEqual(uptimeDays('web', [], NOW));
  });

  it('AC2: an unknown service has 90 operational days', () => {
    const days = uptimeDays('nope', [incident('a', '2026-09-10T10:00:00Z', null)], NOW);
    expect(days).toHaveLength(90);
    expect(days.every((d) => d.status === 'operational')).toBe(true);
  });
});

describe('uptimePercent', () => {
  it('AC4: is 100 without incidents', () => {
    expect(uptimePercent('api', [], NOW)).toBe(100);
  });

  it('AC4: is below 100 for a one minute incident, capped at 99.99', () => {
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T10:01:00Z')];
    expect(uptimePercent('api', list, NOW)).toBe(99.99);
  });

  it('AC4: falls as incident time grows', () => {
    const short = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T10:30:00Z')];
    const long = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T12:00:00Z')];
    const two = [...short, incident('b', '2026-09-11T10:00:00Z', '2026-09-11T10:30:00Z')];
    expect(uptimePercent('api', long, NOW)).toBeLessThan(uptimePercent('api', short, NOW));
    expect(uptimePercent('api', two, NOW)).toBeLessThan(uptimePercent('api', short, NOW));
  });

  it('AC4: counts overlapping incidents of a service once', () => {
    const one = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T12:00:00Z')];
    const overlapping = [
      ...one,
      incident('b', '2026-09-10T11:00:00Z', '2026-09-10T12:00:00Z', { impact: 'major-outage' }),
    ];
    const merged = [
      incident('a', '2026-09-10T10:00:00Z', '2026-09-10T12:00:00Z'),
      incident('c', '2026-09-10T10:30:00Z', '2026-09-10T11:30:00Z'),
    ];
    expect(uptimePercent('api', overlapping, NOW)).toBe(uptimePercent('api', one, NOW));
    expect(uptimePercent('api', merged, NOW)).toBe(uptimePercent('api', one, NOW));
  });

  it('AC4: clips an incident that started before the window', () => {
    const clipped = [incident('a', '2026-06-01T00:00:00Z', '2026-07-04T01:30:00Z')];
    const inside = [incident('a', '2026-07-04T00:00:00Z', '2026-07-04T01:30:00Z')];
    expect(uptimePercent('api', clipped, NOW)).toBe(uptimePercent('api', inside, NOW));
  });

  it('AC4: counts an open incident up to now', () => {
    const open = [incident('a', '2026-10-01T10:00:00Z', null)];
    const closed = [incident('a', '2026-10-01T10:00:00Z', '2026-10-01T12:00:00Z')];
    expect(uptimePercent('api', open, NOW)).toBe(uptimePercent('api', closed, NOW));
    expect(uptimePercent('api', open, NOW)).toBeLessThan(100);
  });

  it('AC4: ignores maintenance and incidents that have not started', () => {
    const list = [
      incident('m', '2026-09-10T10:00:00Z', '2026-09-10T12:00:00Z', { kind: 'maintenance' }),
      incident('u', '2026-10-05T10:00:00Z', '2026-10-05T12:00:00Z'),
    ];
    expect(uptimePercent('api', list, NOW)).toBe(100);
  });

  it('AC4: gives an exact value for a 90 minute incident over the 128,880 minute window', () => {
    const windowMs = NOW.getTime() - Date.parse('2026-07-04T00:00:00Z');
    expect(windowMs / MINUTE_MS).toBe(128_880);
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:30:00Z')];
    expect(uptimePercent('api', list, NOW)).toBe(99.93);
  });

  it('AC4: floors instead of rounding up', () => {
    // 6 minutes of 128,880 is 99.9953%, which must show as 99.99 and not 100.
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T10:06:00Z')];
    expect(uptimePercent('api', list, NOW)).toBe(99.99);
  });

  it('AC5: an incident on one service leaves another service at 100', () => {
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T12:00:00Z')];
    expect(uptimePercent('web', list, NOW)).toBe(100);
    expect(uptimePercent('api', list, NOW)).toBeLessThan(100);
  });

  it('AC5: a multi-service incident changes exactly the listed services', () => {
    const list = [
      incident('a', '2026-09-10T10:00:00Z', '2026-09-10T12:00:00Z', {
        affectedServiceIds: ['api', 'git'],
      }),
    ];
    expect(uptimePercent('api', list, NOW)).toBeLessThan(100);
    expect(uptimePercent('git', list, NOW)).toBe(uptimePercent('api', list, NOW));
    expect(uptimePercent('web', list, NOW)).toBe(100);
  });
});

describe('serviceUptime', () => {
  it('AC1, AC4: combines the days and the percentage', () => {
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:30:00Z')];
    expect(serviceUptime('api', list, NOW)).toEqual({
      days: uptimeDays('api', list, NOW),
      percent: uptimePercent('api', list, NOW),
    });
  });

  it('AC5: another service result equals the result without incidents', () => {
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:30:00Z')];
    expect(serviceUptime('web', list, NOW)).toEqual(serviceUptime('web', [], NOW));
  });
});

describe('serviceUptime on the fixtures', () => {
  const dayStatus = (id: string, day: string) =>
    serviceUptime(id, fixtureIncidents, FIXTURE_NOW).days.find((d) => d.day === day)?.status;

  it('AC1, AC3: git has its partial outage and its degraded day', () => {
    expect(dayStatus('git', '2026-07-30')).toBe('partial-outage');
    expect(dayStatus('git', '2026-09-17')).toBe('degraded');
  });

  it('AC1: search shows the incident that crosses midnight on both days', () => {
    expect(dayStatus('search', '2026-09-10')).toBe('partial-outage');
    expect(dayStatus('search', '2026-09-11')).toBe('partial-outage');
  });

  it('AC2: the maintenance window does not colour api', () => {
    expect(dayStatus('api', '2026-08-08')).toBe('operational');
  });

  it('AC4: every service has between 99% and 100%', () => {
    for (const service of services) {
      const { percent } = serviceUptime(service.id, fixtureIncidents, FIXTURE_NOW);
      expect(percent).toBeLessThan(100);
      expect(percent).toBeGreaterThan(99);
    }
  });
});
