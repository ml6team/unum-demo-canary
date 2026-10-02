import { describe, expect, it } from 'vitest';
import {
  activeIncidents,
  affectedServiceNames,
  buildTimeline,
  dailyStatuses,
  groupByDay,
  historyStart,
  incidentState,
  pastIncidents,
  serviceUptime,
  upcomingMaintenance,
  updatesNewestFirst,
  uptimeRatio,
} from './incidents';
import { DAY_MS, HOUR_MS, MINUTE_MS } from './time';
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

function statusOn(days: { day: string; status: string }[], day: string): string | undefined {
  return days.find((d) => d.day === day)?.status;
}

function coloured(days: { day: string; status: string }[]): string[] {
  return days.filter((d) => d.status !== 'operational').map((d) => d.day);
}

describe('dailyStatuses', () => {
  it('AC1: returns 90 ascending days, oldest first, ending on the day of now', () => {
    const days = dailyStatuses('api', [], NOW);
    expect(days).toHaveLength(90);
    expect(days.at(0)?.day).toBe('2026-07-04');
    expect(days.at(-1)?.day).toBe('2026-10-01');
    const keys = days.map((d) => d.day);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(90);
  });

  it('AC1, AC2: a service with no incidents is operational on every day', () => {
    const days = dailyStatuses('api', [], NOW);
    expect(days.every((d) => d.status === 'operational')).toBe(true);
  });

  it('AC2: a single incident colours only its own day', () => {
    const days = dailyStatuses(
      'api',
      [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z')],
      NOW,
    );
    expect(coloured(days)).toEqual(['2026-09-10']);
    expect(statusOn(days, '2026-09-10')).toBe('degraded');
  });

  it('AC2: the most severe impact wins on a day with several incidents', () => {
    const days = dailyStatuses(
      'api',
      [
        incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z'),
        incident('b', '2026-09-10T14:00:00Z', '2026-09-10T15:00:00Z', { impact: 'major-outage' }),
        incident('c', '2026-09-10T18:00:00Z', '2026-09-10T19:00:00Z', { impact: 'partial-outage' }),
      ],
      NOW,
    );
    expect(statusOn(days, '2026-09-10')).toBe('major-outage');
  });

  it('AC4: an incident that does not list the service leaves it operational', () => {
    const days = dailyStatuses(
      'web',
      [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z')],
      NOW,
    );
    expect(coloured(days)).toEqual([]);
  });

  it('AC4: an incident listing two services colours both', () => {
    const list = [
      incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z', {
        affectedServiceIds: ['api', 'git'],
      }),
    ];
    expect(coloured(dailyStatuses('api', list, NOW))).toEqual(['2026-09-10']);
    expect(coloured(dailyStatuses('git', list, NOW))).toEqual(['2026-09-10']);
    expect(coloured(dailyStatuses('web', list, NOW))).toEqual([]);
  });

  it('AC4, AC5: an incident that spans midnight colours both UTC days', () => {
    const days = dailyStatuses(
      'api',
      [incident('a', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')],
      NOW,
    );
    expect(coloured(days)).toEqual(['2026-09-10', '2026-09-11']);
  });

  it('AC5: an incident ending exactly at 00:00Z does not colour the next day', () => {
    const days = dailyStatuses(
      'api',
      [incident('a', '2026-09-10T22:00:00Z', '2026-09-11T00:00:00Z')],
      NOW,
    );
    expect(coloured(days)).toEqual(['2026-09-10']);
  });

  it('AC4, AC5: a multi-day incident colours every day it covers', () => {
    const days = dailyStatuses(
      'api',
      [incident('a', '2026-09-10T10:00:00Z', '2026-09-12T08:00:00Z')],
      NOW,
    );
    expect(coloured(days)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
  });

  it('AC5: an open incident colours today', () => {
    const days = dailyStatuses('api', [incident('a', '2026-10-01T09:00:00Z', null)], NOW);
    expect(statusOn(days, '2026-10-01')).toBe('degraded');
  });

  it('AC5: an upcoming incident colours nothing', () => {
    const days = dailyStatuses(
      'api',
      [incident('a', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z')],
      NOW,
    );
    expect(coloured(days)).toEqual([]);
  });
});

describe('uptimeRatio', () => {
  const windowMs = NOW.getTime() - historyStart(NOW).getTime();

  it('AC3: is 1 for a service with no incidents', () => {
    expect(uptimeRatio('api', [], NOW)).toBe(1);
  });

  it('AC3: subtracts the downtime of one incident from the window', () => {
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z')];
    expect(uptimeRatio('api', list, NOW)).toBeCloseTo(1 - (60 * MINUTE_MS) / windowMs, 12);
  });

  it('AC4: an incident that does not list the service leaves it at 1', () => {
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z')];
    expect(uptimeRatio('web', list, NOW)).toBe(1);
  });

  it('AC3: overlapping incidents are merged, not double counted', () => {
    const list = [
      incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z'),
      incident('b', '2026-09-10T10:30:00Z', '2026-09-10T11:30:00Z'),
    ];
    expect(uptimeRatio('api', list, NOW)).toBeCloseTo(1 - (90 * MINUTE_MS) / windowMs, 12);
  });

  it('AC3, AC5: an incident that starts before the window is clipped to it', () => {
    const start = historyStart(NOW);
    const list = [
      incident('a', new Date(start.getTime() - 5 * HOUR_MS).toISOString(), '2026-07-04T02:00:00Z'),
    ];
    expect(uptimeRatio('api', list, NOW)).toBeCloseTo(1 - (2 * HOUR_MS) / windowMs, 12);
  });

  it('AC3, AC5: an open incident counts up to now', () => {
    const list = [incident('a', '2026-10-01T09:00:00Z', null)];
    expect(uptimeRatio('api', list, NOW)).toBeCloseTo(1 - (3 * HOUR_MS) / windowMs, 12);
  });

  it('AC5: an upcoming incident does not reduce uptime', () => {
    const list = [incident('a', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z')];
    expect(uptimeRatio('api', list, NOW)).toBe(1);
  });

  it('AC5: is 1 exactly when every day is operational, and below 1 otherwise', () => {
    const sets: Incident[][] = [
      [],
      [incident('a', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z')],
      [incident('b', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')],
      [incident('c', '2026-10-01T11:59:00Z', null)],
      [
        incident('d', '2026-09-01T00:00:00Z', '2026-09-01T00:00:01Z', {
          affectedServiceIds: ['x'],
        }),
      ],
    ];
    for (const list of sets) {
      const allOperational = dailyStatuses('api', list, NOW).every(
        (d) => d.status === 'operational',
      );
      const ratio = uptimeRatio('api', list, NOW);
      if (allOperational) expect(ratio).toBe(1);
      else expect(ratio).toBeLessThan(1);
    }
  });
});

describe('serviceUptime', () => {
  it('AC3: returns the daily statuses and the ratio of the same incidents', () => {
    const list = [
      incident('a', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z'),
      incident('b', '2026-10-01T09:00:00Z', null, { impact: 'major-outage' }),
    ];
    const result = serviceUptime('api', list, NOW);
    expect(result.serviceId).toBe('api');
    expect(result.days).toEqual(dailyStatuses('api', list, NOW));
    expect(result.uptime).toBe(uptimeRatio('api', list, NOW));
    expect(result.days).toHaveLength(90);
  });
});

describe('buildTimeline', () => {
  const from = historyStart(NOW);
  const span = NOW.getTime() - from.getTime();
  const fraction = (iso: string) => (Date.parse(iso) - from.getTime()) / span;

  it('AC1: covers the history window ending at now', () => {
    const timeline = buildTimeline([], NOW);
    expect(timeline.from).toEqual(historyStart(NOW));
    expect(timeline.to).toEqual(NOW);
  });

  it('AC1: puts axis ticks every 15 days from the window start', () => {
    const { ticks } = buildTimeline([], NOW);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0]).toEqual({ at: from.toISOString(), position: 0 });
    ticks.forEach((tick, index) => {
      expect(Date.parse(tick.at)).toBe(from.getTime() + index * 15 * DAY_MS);
      expect(tick.position).toBeGreaterThanOrEqual(0);
      expect(tick.position).toBeLessThan(1);
    });
  });

  it('AC2: positions an incident at the window start at 0', () => {
    const [item] = buildTimeline(
      [incident('a', from.toISOString(), '2026-06-03T00:00:00Z')],
      NOW,
    ).items;
    expect(item.start).toBe(0);
  });

  it('AC2: positions an incident at its start time as a fraction of the window', () => {
    const [item] = buildTimeline(
      [incident('a', '2026-08-15T10:30:00Z', '2026-08-15T11:00:00Z')],
      NOW,
    ).items;
    expect(item.start).toBeCloseTo(fraction('2026-08-15T10:30:00Z'), 12);
  });

  it('AC2: leaves out incidents before the window and upcoming ones', () => {
    const { items } = buildTimeline(
      [
        incident('before', '2026-06-02T23:00:00Z', '2026-06-03T01:00:00Z'),
        incident('upcoming', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z'),
        incident('inside', '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z'),
      ],
      NOW,
    );
    expect(items.map((i) => i.incident.id)).toEqual(['inside']);
  });

  it('AC2: lists each incident once, newest first', () => {
    const { items } = buildTimeline(
      [
        incident('old', '2026-07-01T08:00:00Z', '2026-07-01T09:00:00Z'),
        incident('new', '2026-09-20T08:00:00Z', '2026-09-20T09:00:00Z'),
        incident('mid', '2026-08-10T08:00:00Z', '2026-08-10T09:00:00Z'),
      ],
      NOW,
    );
    expect(items.map((i) => i.incident.id)).toEqual(['new', 'mid', 'old']);
  });

  it('AC3: ends a resolved incident at its resolution time', () => {
    const [item] = buildTimeline(
      [incident('a', '2026-09-30T06:10:00Z', '2026-09-30T06:55:00Z')],
      NOW,
    ).items;
    expect(item.state).toBe('resolved');
    expect(item.end).toBeCloseTo(fraction('2026-09-30T06:55:00Z'), 12);
    expect(item.end).toBeGreaterThan(item.start);
  });

  it('AC3: extends an open incident to now and marks it active', () => {
    const [item] = buildTimeline([incident('a', '2026-10-01T09:00:00Z', null)], NOW).items;
    expect(item.state).toBe('active');
    expect(item.end).toBe(1);
  });

  it('AC3: clips an incident that resolves after now to now', () => {
    const [item] = buildTimeline(
      [incident('a', '2026-10-01T11:00:00Z', '2026-10-01T13:00:00Z')],
      NOW,
    ).items;
    expect(item.state).toBe('active');
    expect(item.end).toBe(1);
  });

  it('AC3: draws an incident that spans midnight as one item', () => {
    const { items } = buildTimeline(
      [incident('a', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')],
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0].end).toBeGreaterThan(items[0].start);
  });

  it('AC5: returns an empty timeline when there are no incidents', () => {
    const timeline = buildTimeline([], NOW);
    expect(timeline.items).toEqual([]);
    expect(timeline.from).toEqual(from);
    expect(timeline.to).toEqual(NOW);
    expect(timeline.ticks.length).toBeGreaterThan(0);
  });
});
