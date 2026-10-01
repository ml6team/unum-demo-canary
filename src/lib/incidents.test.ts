import { describe, expect, it } from 'vitest';
import { NOW as FIXTURE_NOW, incidents as fixtureIncidents, services } from '../data';
import {
  activeIncidents,
  affectedServiceNames,
  groupByDay,
  historyStart,
  incidentState,
  pastIncidents,
  serviceDowntimeMs,
  serviceUptime,
  upcomingMaintenance,
  updatesNewestFirst,
} from './incidents';
import { HOUR_MS, MINUTE_MS } from './time';
import type { Incident } from './types';

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

describe('incidentState', () => {
  it('is upcoming before it starts', () => {
    expect(incidentState(incident('a', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z'), NOW)).toBe(
      'upcoming',
    );
  });

  it('is active while unresolved', () => {
    expect(incidentState(incident('a', '2026-10-01T11:00:00Z', null), NOW)).toBe('active');
  });

  it('is active until its resolution time has passed', () => {
    expect(incidentState(incident('a', '2026-10-01T11:00:00Z', '2026-10-01T13:00:00Z'), NOW)).toBe(
      'active',
    );
  });

  it('is resolved after it ends', () => {
    expect(incidentState(incident('a', '2026-09-30T06:10:00Z', '2026-09-30T06:55:00Z'), NOW)).toBe(
      'resolved',
    );
  });
});

describe('historyStart', () => {
  it('starts 89 days before today so today is the 90th day', () => {
    expect(historyStart(NOW).toISOString()).toBe('2026-07-04T00:00:00.000Z');
  });
});

describe('pastIncidents', () => {
  const list = [
    incident('old', '2026-07-03T23:59:00Z', '2026-07-04T00:30:00Z'),
    incident('first-day', '2026-07-04T00:00:00Z', '2026-07-04T00:30:00Z'),
    incident('recent', '2026-09-30T06:10:00Z', '2026-09-30T06:55:00Z'),
    incident('ongoing', '2026-10-01T11:00:00Z', null),
    incident('future', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z', { kind: 'maintenance' }),
  ];

  it('keeps incidents that started inside the window, newest first', () => {
    expect(pastIncidents(list, NOW).map((i) => i.id)).toEqual(['ongoing', 'recent', 'first-day']);
  });

  it('accepts a shorter window', () => {
    expect(pastIncidents(list, NOW, 2).map((i) => i.id)).toEqual(['ongoing', 'recent']);
  });
});

describe('upcomingMaintenance', () => {
  it('returns future maintenance only, soonest first', () => {
    const list = [
      incident('later', '2026-10-20T01:00:00Z', '2026-10-20T02:00:00Z', { kind: 'maintenance' }),
      incident('soon', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z', { kind: 'maintenance' }),
      incident('done', '2026-08-08T02:00:00Z', '2026-08-08T03:30:00Z', { kind: 'maintenance' }),
      incident('not-maintenance', '2026-10-05T01:00:00Z', null),
    ];
    expect(upcomingMaintenance(list, NOW).map((i) => i.id)).toEqual(['soon', 'later']);
  });
});

describe('activeIncidents', () => {
  it('returns incidents in progress at now', () => {
    const list = [
      incident('done', '2026-09-30T06:10:00Z', '2026-09-30T06:55:00Z'),
      incident('ongoing', '2026-10-01T11:00:00Z', null),
    ];
    expect(activeIncidents(list, NOW).map((i) => i.id)).toEqual(['ongoing']);
  });
});

describe('groupByDay', () => {
  it('groups by UTC start day, newest day and incident first', () => {
    const groups = groupByDay([
      incident('a', '2026-09-09T09:12:00Z', '2026-09-09T11:47:00Z'),
      incident('b', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z'),
      incident('c', '2026-09-09T18:00:00Z', '2026-09-09T18:30:00Z'),
    ]);
    expect(groups.map((g) => [g.day, g.incidents.map((i) => i.id)])).toEqual([
      ['2026-09-10', ['b']],
      ['2026-09-09', ['c', 'a']],
    ]);
  });

  it('places an incident that spans midnight on the day it started', () => {
    const [group] = groupByDay([incident('b', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')]);
    expect(group?.day).toBe('2026-09-10');
  });

  it('returns no groups for no incidents', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('updatesNewestFirst', () => {
  it('sorts updates newest first without mutating the incident', () => {
    const subject = incident('a', '2026-09-09T09:12:00Z', '2026-09-09T11:47:00Z', {
      updates: [
        { at: '2026-09-09T09:12:00Z', status: 'investigating', body: '' },
        { at: '2026-09-09T11:47:00Z', status: 'resolved', body: '' },
        { at: '2026-09-09T10:05:00Z', status: 'identified', body: '' },
      ],
    });
    expect(updatesNewestFirst(subject).map((u) => u.status)).toEqual([
      'resolved',
      'identified',
      'investigating',
    ]);
    expect(subject.updates[0]?.status).toBe('investigating');
  });
});

describe('affectedServiceNames', () => {
  it('lists names in service order and skips unknown ids', () => {
    const services = [
      { id: 'api', name: 'API', description: '', status: 'operational' as const },
      { id: 'web', name: 'Web app', description: '', status: 'operational' as const },
    ];
    const subject = incident('a', '2026-09-09T09:12:00Z', null, {
      affectedServiceIds: ['web', 'gone', 'api'],
    });
    expect(affectedServiceNames(subject, services)).toEqual(['API', 'Web app']);
  });
});

describe('serviceDowntimeMs', () => {
  const windowStart = '2026-07-03T12:00:00Z';

  it('AC3: is 0 when no incident affects the service', () => {
    expect(serviceDowntimeMs([], 'api', NOW)).toBe(0);
    const other = incident('a', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z', {
      affectedServiceIds: ['git'],
    });
    expect(serviceDowntimeMs([other], 'api', NOW)).toBe(0);
  });

  it('AC2: counts the duration of an incident inside the window', () => {
    const list = [incident('a', '2026-09-01T10:00:00Z', '2026-09-01T11:30:00Z')];
    expect(serviceDowntimeMs(list, 'api', NOW)).toBe(90 * MINUTE_MS);
  });

  it('AC2: does not count an incident that ended before the window start', () => {
    const list = [incident('a', '2026-06-30T10:00:00Z', windowStart)];
    expect(serviceDowntimeMs(list, 'api', NOW)).toBe(0);
  });

  it('AC5: counts only the part of an incident after the window start', () => {
    const list = [incident('a', '2026-07-03T10:00:00Z', '2026-07-03T13:00:00Z')];
    expect(serviceDowntimeMs(list, 'api', NOW)).toBe(HOUR_MS);
  });

  it('AC5: counts an ongoing incident up to now', () => {
    const list = [incident('a', '2026-10-01T09:00:00Z', null)];
    expect(serviceDowntimeMs(list, 'api', NOW)).toBe(3 * HOUR_MS);
  });

  it('AC5: counts an incident resolved after now only up to now', () => {
    const list = [incident('a', '2026-10-01T10:00:00Z', '2026-10-01T15:00:00Z')];
    expect(serviceDowntimeMs(list, 'api', NOW)).toBe(2 * HOUR_MS);
  });

  it('AC2: does not count an upcoming incident', () => {
    const list = [incident('a', '2026-10-02T10:00:00Z', '2026-10-02T11:00:00Z')];
    expect(serviceDowntimeMs(list, 'api', NOW)).toBe(0);
  });

  it('AC2: counts overlapping incidents on one service as their union', () => {
    const list = [
      incident('a', '2026-09-01T10:00:00Z', '2026-09-01T12:00:00Z'),
      incident('b', '2026-09-01T11:00:00Z', '2026-09-01T13:00:00Z'),
    ];
    expect(serviceDowntimeMs(list, 'api', NOW)).toBe(3 * HOUR_MS);
  });

  it('AC2: counts a multi-service incident for each of its services', () => {
    const list = [
      incident('a', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z', {
        affectedServiceIds: ['api', 'git'],
      }),
    ];
    expect(serviceDowntimeMs(list, 'api', NOW)).toBe(HOUR_MS);
    expect(serviceDowntimeMs(list, 'git', NOW)).toBe(HOUR_MS);
    expect(serviceDowntimeMs(list, 'search', NOW)).toBe(0);
  });

  it('AC2: ignores maintenance entries', () => {
    const list = [
      incident('a', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z', { kind: 'maintenance' }),
    ];
    expect(serviceDowntimeMs(list, 'api', NOW)).toBe(0);
  });
});

describe('serviceUptime', () => {
  it('AC3: is 100 for a service with no incidents', () => {
    expect(serviceUptime([], 'api', NOW)).toBe(100);
    expect(serviceUptime([], 'unknown-service', NOW)).toBe(100);
  });

  it('AC2: is the share of the window outside incidents, to one decimal', () => {
    const list = [incident('a', '2026-09-01T10:00:00Z', '2026-09-01T11:30:00Z')];
    expect(serviceUptime(list, 'api', NOW)).toBe(99.9);
  });

  it('AC4: rounds down so downtime never reads as 100', () => {
    const list = [incident('a', '2026-09-01T10:00:00Z', '2026-09-01T10:50:00Z')];
    expect(serviceUptime(list, 'api', NOW)).toBe(99.9);
  });

  it('AC5: reflects only the part of an ongoing incident inside the window', () => {
    const list = [incident('a', '2026-06-01T00:00:00Z', null)];
    expect(serviceUptime(list, 'api', NOW)).toBe(0);
  });

  it('AC2: computes search uptime from the fixtures', () => {
    expect(serviceUptime(fixtureIncidents, 'search', FIXTURE_NOW)).toBe(99.5);
  });

  it('AC1: gives every listed service a percentage between 0 and 100', () => {
    expect(services.length).toBeGreaterThan(0);
    for (const service of services) {
      const uptime = serviceUptime(fixtureIncidents, service.id, FIXTURE_NOW);
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(uptime).toBeLessThanOrEqual(100);
    }
  });
});
