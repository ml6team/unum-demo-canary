import { describe, expect, it } from 'vitest';
import {
  activeIncidents,
  affectedServiceNames,
  groupByDay,
  historyStart,
  incidentState,
  pastIncidents,
  serviceUptime,
  upcomingMaintenance,
  updatesNewestFirst,
} from './incidents';
import type { Incident, Service } from './types';

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

describe('serviceUptime', () => {
  const api: Service = { id: 'api', name: 'API', description: '', status: 'operational' };
  const web: Service = { id: 'web', name: 'Web app', description: '', status: 'operational' };
  const outage = (id: string, startedAt: string, resolvedAt: string | null, extra = {}) =>
    incident(id, startedAt, resolvedAt, { impact: 'partial-outage', ...extra });

  it('AC2: reports the share of the 90 days without an outage, to two decimals', () => {
    const list = [outage('a', '2026-09-01T10:00:00Z', '2026-09-01T11:30:00Z')];
    expect(serviceUptime(api, list, NOW)).toBe(99.93);
  });

  it('AC2: counts a major outage as downtime', () => {
    const list = [
      outage('a', '2026-09-01T10:00:00Z', '2026-09-01T11:30:00Z', { impact: 'major-outage' }),
    ];
    expect(serviceUptime(api, list, NOW)).toBe(99.93);
  });

  it('AC2: truncates instead of rounding, so a 1 minute outage is not shown as 100', () => {
    const list = [outage('a', '2026-09-01T10:00:00Z', '2026-09-01T10:01:00Z')];
    expect(serviceUptime(api, list, NOW)).toBe(99.99);
  });

  it('AC2: counts an incident that spans UTC midnight in full', () => {
    const list = [outage('a', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')];
    expect(serviceUptime(api, list, NOW)).toBe(99.88);
  });

  it('AC2: only counts the part of an incident that falls inside the window', () => {
    const list = [outage('a', '2026-07-03T06:00:00Z', '2026-07-03T13:00:00Z')];
    expect(serviceUptime(api, list, NOW)).toBe(99.95);
  });

  it('AC2: counts overlapping outages once', () => {
    const list = [
      outage('a', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z'),
      outage('b', '2026-09-01T10:30:00Z', '2026-09-01T11:30:00Z'),
    ];
    expect(serviceUptime(api, list, NOW)).toBe(99.93);
  });

  it('AC2: does not count degraded impact or maintenance as downtime', () => {
    const list = [
      incident('a', '2026-09-01T10:00:00Z', '2026-09-01T14:00:00Z'),
      outage('m', '2026-09-02T10:00:00Z', '2026-09-02T14:00:00Z', { kind: 'maintenance' }),
    ];
    expect(serviceUptime(api, list, NOW)).toBe(100);
  });

  it('AC2: ignores incidents that start after now', () => {
    const list = [outage('a', '2026-10-02T10:00:00Z', '2026-10-02T12:00:00Z')];
    expect(serviceUptime(api, list, NOW)).toBe(100);
  });

  it('AC3: an outage on api does not change the figure of web', () => {
    const list = [outage('a', '2026-09-01T10:00:00Z', '2026-09-01T11:30:00Z')];
    expect(serviceUptime(web, list, NOW)).toBe(100);
  });

  it('AC3: an outage that affects several services counts for each of them', () => {
    const list = [
      outage('a', '2026-09-01T10:00:00Z', '2026-09-01T11:30:00Z', {
        affectedServiceIds: ['api', 'web'],
      }),
    ];
    expect(serviceUptime(api, list, NOW)).toBe(99.93);
    expect(serviceUptime(web, list, NOW)).toBe(99.93);
  });

  it('AC4: is 100 for a service with no incidents', () => {
    expect(serviceUptime(api, [], NOW)).toBe(100);
  });

  it('AC4: calculates over the days with data when history is shorter than 90 days', () => {
    const tracked: Service = { ...api, trackedSince: '2026-09-21T12:00:00Z' };
    const list = [outage('a', '2026-09-25T00:00:00Z', '2026-09-26T00:00:00Z')];
    expect(serviceUptime(tracked, list, NOW)).toBe(90);
  });

  it('AC4: is 100, not an error, when history starts at or after now', () => {
    const tracked: Service = { ...api, trackedSince: '2026-10-02T00:00:00Z' };
    expect(serviceUptime(tracked, [], NOW)).toBe(100);
    expect(serviceUptime({ ...api, trackedSince: NOW.toISOString() }, [], NOW)).toBe(100);
  });

  it('AC4: ignores a trackedSince that is older than the window', () => {
    const tracked: Service = { ...api, trackedSince: '2025-01-01T00:00:00Z' };
    const list = [outage('a', '2026-09-01T10:00:00Z', '2026-09-01T11:30:00Z')];
    expect(serviceUptime(tracked, list, NOW)).toBe(99.93);
  });

  it('AC5: counts an open outage up to now', () => {
    const list = [outage('a', '2026-10-01T06:00:00Z', null)];
    expect(serviceUptime(api, list, NOW)).toBe(99.72);
  });

  it('AC5: counts an open outage on a service with a short history', () => {
    const tracked: Service = { ...api, trackedSince: '2026-09-30T12:00:00Z' };
    const list = [outage('a', '2026-10-01T00:00:00Z', null)];
    expect(serviceUptime(tracked, list, NOW)).toBe(50);
  });

  it('AC5: does not count an open degraded incident', () => {
    const list = [incident('a', '2026-10-01T06:00:00Z', null)];
    expect(serviceUptime(api, list, NOW)).toBe(100);
  });

  it('AC2: accepts a shorter window', () => {
    const list = [outage('a', '2026-09-30T12:00:00Z', '2026-10-01T00:00:00Z')];
    expect(serviceUptime(api, list, NOW, 2)).toBe(75);
  });
});
