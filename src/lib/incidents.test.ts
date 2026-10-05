import { describe, expect, it } from 'vitest';
import {
  activeIncidents,
  affectedServiceNames,
  filterByServices,
  groupByDay,
  historyStart,
  incidentState,
  pastIncidents,
  upcomingMaintenance,
  updatesNewestFirst,
} from './incidents';
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

describe('filterByServices', () => {
  const apiActive = incident('api-active', '2026-10-01T11:00:00Z', null, {
    affectedServiceIds: ['api'],
  });
  const webMaintenance = incident('web-upcoming', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z', {
    kind: 'maintenance',
    affectedServiceIds: ['web'],
  });
  const gitResolved = incident('git-resolved', '2026-09-30T06:10:00Z', '2026-09-30T06:55:00Z', {
    affectedServiceIds: ['git'],
  });
  const multi = incident('multi-resolved', '2026-09-20T06:10:00Z', '2026-09-20T06:55:00Z', {
    affectedServiceIds: ['api', 'web'],
  });
  const all = [apiActive, webMaintenance, gitResolved, multi];

  it('AC1: an empty selection returns every incident in the same order', () => {
    expect(filterByServices(all, []).map((i) => i.id)).toEqual(all.map((i) => i.id));
  });

  it('AC2: one selected service returns only incidents that list it', () => {
    expect(filterByServices(all, ['git']).map((i) => i.id)).toEqual(['git-resolved']);
  });

  it('AC2: two selected services return the union', () => {
    expect(filterByServices(all, ['git', 'web']).map((i) => i.id)).toEqual([
      'web-upcoming',
      'git-resolved',
      'multi-resolved',
    ]);
  });

  it('AC2: an incident affecting both selected services appears once', () => {
    expect(filterByServices(all, ['api', 'web']).map((i) => i.id)).toEqual([
      'api-active',
      'web-upcoming',
      'multi-resolved',
    ]);
  });

  it('AC2: a multi-service incident is kept when only one of its services is selected', () => {
    expect(filterByServices([multi], ['web'])).toEqual([multi]);
  });

  it('AC3: a selection that matches nothing returns no incidents', () => {
    expect(filterByServices([apiActive, gitResolved], ['web'])).toEqual([]);
  });

  it('AC3: an unknown service id returns no incidents', () => {
    expect(filterByServices(all, ['nope'])).toEqual([]);
  });

  it('AC2: active, upcoming and past lists only hold entries for the selected service', () => {
    const filtered = filterByServices(all, ['web']);
    expect(activeIncidents(filtered, NOW).map((i) => i.id)).toEqual([]);
    expect(upcomingMaintenance(filtered, NOW).map((i) => i.id)).toEqual(['web-upcoming']);
    expect(pastIncidents(filtered, NOW).map((i) => i.id)).toEqual(['multi-resolved']);

    const filteredApi = filterByServices(all, ['api']);
    expect(activeIncidents(filteredApi, NOW).map((i) => i.id)).toEqual(['api-active']);
    expect(upcomingMaintenance(filteredApi, NOW)).toEqual([]);
    expect(pastIncidents(filteredApi, NOW).map((i) => i.id)).toEqual([
      'api-active',
      'multi-resolved',
    ]);
  });

  it('AC4: clearing the selection restores the full list without mutating the input', () => {
    const before = [...all];
    expect(filterByServices(all, ['git'])).toHaveLength(1);
    expect(filterByServices(all, []).map((i) => i.id)).toEqual(before.map((i) => i.id));
    expect(all).toEqual(before);
  });
});
