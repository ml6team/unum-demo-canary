import { describe, expect, it } from 'vitest';
import {
  activeIncidents,
  affectedServiceNames,
  groupByDay,
  historyStart,
  incidentState,
  isDowntime,
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

describe('isDowntime', () => {
  it('AC2: is true only for partial and major outage incidents', () => {
    const at = ['2026-09-01T00:00:00Z', '2026-09-01T01:00:00Z'] as const;
    expect(isDowntime(incident('a', ...at, { impact: 'partial-outage' }))).toBe(true);
    expect(isDowntime(incident('a', ...at, { impact: 'major-outage' }))).toBe(true);
    expect(isDowntime(incident('a', ...at, { impact: 'degraded' }))).toBe(false);
    expect(isDowntime(incident('a', ...at, { impact: 'major-outage', kind: 'maintenance' }))).toBe(
      false,
    );
  });
});

describe('serviceUptime', () => {
  const api: Service = { id: 'api', name: 'API', description: '', status: 'operational' };
  const outage = (id: string, startedAt: string, resolvedAt: string | null, extra = {}) =>
    incident(id, startedAt, resolvedAt, { impact: 'partial-outage', ...extra });

  it('AC2: is 100 when the service has no incidents', () => {
    expect(serviceUptime(api, [], NOW)).toBe(100);
  });

  it('AC2: is 90 after 9 of 90 days of partial outage', () => {
    const down = outage('a', '2026-08-01T00:00:00Z', '2026-08-10T00:00:00Z');
    expect(serviceUptime(api, [down], NOW)).toBe(90);
  });

  it('AC2: ignores other services, upcoming, degraded and maintenance incidents', () => {
    const noise = [
      outage('other', '2026-08-01T00:00:00Z', '2026-08-10T00:00:00Z', {
        affectedServiceIds: ['web'],
      }),
      outage('upcoming', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z', { kind: 'maintenance' }),
      incident('degraded', '2026-08-01T00:00:00Z', '2026-08-10T00:00:00Z'),
      outage('maintenance', '2026-08-01T00:00:00Z', '2026-08-10T00:00:00Z', {
        kind: 'maintenance',
      }),
    ];
    expect(serviceUptime(api, noise, NOW)).toBe(100);
  });

  it('AC2: counts overlapping outages once', () => {
    const overlapping = [
      outage('a', '2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z'),
      outage('b', '2026-08-01T12:00:00Z', '2026-08-02T12:00:00Z', { impact: 'major-outage' }),
    ];
    expect(serviceUptime(api, overlapping, NOW)).toBe(98.33);
  });

  it('AC2: counts an outage that is still open up to now', () => {
    expect(serviceUptime(api, [outage('a', '2026-09-22T12:00:00Z', null)], NOW)).toBe(90);
    const resolvesLater = outage('a', '2026-09-22T12:00:00Z', '2026-10-02T12:00:00Z');
    expect(serviceUptime(api, [resolvesLater], NOW)).toBe(90);
  });

  it('AC2: counts only the part of an outage that falls inside the window', () => {
    const starts = outage('a', '2026-06-30T12:00:00Z', '2026-07-12T12:00:00Z');
    expect(serviceUptime(api, [starts], NOW)).toBe(90);
  });

  it('AC4: never rounds up to 100 when there was any downtime', () => {
    const brief = outage('a', '2026-09-01T00:00:00Z', '2026-09-01T00:01:00Z');
    expect(serviceUptime(api, [brief], NOW)).toBe(99.99);
  });

  it('AC4: rounds to at most two decimals', () => {
    const hour = outage('a', '2026-09-01T00:00:00Z', '2026-09-01T01:00:00Z');
    expect(serviceUptime(api, [hour], NOW)).toBe(99.95);
  });

  it('AC5: is null when the service is tracked from now or later', () => {
    expect(serviceUptime({ ...api, trackedSince: '2026-10-02T00:00:00Z' }, [], NOW)).toBeNull();
    expect(serviceUptime({ ...api, trackedSince: '2026-10-01T12:00:00Z' }, [], NOW)).toBeNull();
  });

  it('AC5: starts the window at trackedSince when that is inside the window', () => {
    const young = { ...api, trackedSince: '2026-09-21T12:00:00Z' };
    const down = outage('a', '2026-09-25T00:00:00Z', '2026-09-26T00:00:00Z');
    expect(serviceUptime(young, [down], NOW)).toBe(90);
  });
});
