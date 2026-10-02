import { describe, expect, it } from 'vitest';
import {
  activeIncidents,
  affectedServiceNames,
  dailyBars,
  groupByDay,
  historyStart,
  incidentState,
  pastIncidents,
  upcomingMaintenance,
  updatesNewestFirst,
  uptimePercent,
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

function barOn(bars: ReturnType<typeof dailyBars>, day: string) {
  return bars.find((b) => b.day === day)?.status;
}

describe('dailyBars', () => {
  it('AC1: returns 90 ascending UTC days from the window start to today, all operational without incidents', () => {
    const bars = dailyBars([], 'api', NOW);
    expect(bars).toHaveLength(90);
    expect(bars[0]?.day).toBe('2026-07-04');
    expect(bars.at(-1)?.day).toBe('2026-10-01');
    expect(bars.map((b) => b.day)).toEqual([...bars.map((b) => b.day)].sort());
    expect(bars.every((b) => b.status === 'operational')).toBe(true);
  });

  it('AC2: colours a day by its incident impact', () => {
    const list = [incident('a', '2026-09-09T09:12:00Z', '2026-09-09T11:47:00Z')];
    const bars = dailyBars(list, 'api', NOW);
    expect(barOn(bars, '2026-09-09')).toBe('degraded');
    expect(barOn(bars, '2026-09-08')).toBe('operational');
    expect(barOn(bars, '2026-09-10')).toBe('operational');
  });

  it('AC2: the most severe incident of the day wins', () => {
    const list = [
      incident('a', '2026-09-09T09:12:00Z', '2026-09-09T11:47:00Z'),
      incident('b', '2026-09-09T15:00:00Z', '2026-09-09T16:00:00Z', { impact: 'major-outage' }),
      incident('c', '2026-09-09T18:00:00Z', '2026-09-09T18:30:00Z', { impact: 'partial-outage' }),
    ];
    expect(barOn(dailyBars(list, 'api', NOW), '2026-09-09')).toBe('major-outage');
  });

  it('AC2: the four statuses map to four distinct bar values', () => {
    const list = [
      incident('a', '2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z', { impact: 'degraded' }),
      incident('b', '2026-09-02T09:00:00Z', '2026-09-02T10:00:00Z', { impact: 'partial-outage' }),
      incident('c', '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z', { impact: 'major-outage' }),
    ];
    const bars = dailyBars(list, 'api', NOW);
    const values = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'].map((d) =>
      barOn(bars, d),
    );
    expect(new Set(values).size).toBe(4);
  });

  it('AC5: an incident across midnight colours both days', () => {
    const list = [
      incident('a', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z', { impact: 'partial-outage' }),
    ];
    const bars = dailyBars(list, 'api', NOW);
    expect(barOn(bars, '2026-09-10')).toBe('partial-outage');
    expect(barOn(bars, '2026-09-11')).toBe('partial-outage');
    expect(barOn(bars, '2026-09-12')).toBe('operational');
  });

  it('AC5: an incident ending exactly at midnight does not colour the next day', () => {
    const list = [incident('a', '2026-09-10T22:00:00Z', '2026-09-11T00:00:00Z')];
    const bars = dailyBars(list, 'api', NOW);
    expect(barOn(bars, '2026-09-10')).toBe('degraded');
    expect(barOn(bars, '2026-09-11')).toBe('operational');
  });

  it('AC5: a three-day incident colours three bars', () => {
    const list = [incident('a', '2026-09-10T20:00:00Z', '2026-09-12T04:00:00Z')];
    const colored = dailyBars(list, 'api', NOW).filter((b) => b.status !== 'operational');
    expect(colored.map((b) => b.day)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
  });

  it('AC5: an open incident colours today', () => {
    const list = [incident('a', '2026-10-01T11:00:00Z', null, { impact: 'major-outage' })];
    const bars = dailyBars(list, 'api', NOW);
    expect(bars.at(-1)).toEqual({ day: '2026-10-01', status: 'major-outage' });
    expect(barOn(bars, '2026-09-30')).toBe('operational');
  });

  it('AC4: only the bars of the affected services change', () => {
    const list = [
      incident('a', '2026-09-09T09:12:00Z', '2026-09-09T11:47:00Z', {
        affectedServiceIds: ['web'],
      }),
      incident('b', '2026-09-20T09:00:00Z', '2026-09-20T10:00:00Z', {
        affectedServiceIds: ['api', 'search'],
      }),
    ];
    expect(barOn(dailyBars(list, 'api', NOW), '2026-09-09')).toBe('operational');
    expect(barOn(dailyBars(list, 'web', NOW), '2026-09-09')).toBe('degraded');
    expect(barOn(dailyBars(list, 'api', NOW), '2026-09-20')).toBe('degraded');
    expect(barOn(dailyBars(list, 'search', NOW), '2026-09-20')).toBe('degraded');
    expect(barOn(dailyBars(list, 'web', NOW), '2026-09-20')).toBe('operational');
  });

  it('AC2: upcoming maintenance changes nothing', () => {
    const list = [
      incident('m', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z', { kind: 'maintenance' }),
    ];
    expect(dailyBars(list, 'api', NOW).every((b) => b.status === 'operational')).toBe(true);
  });
});

describe('uptimePercent', () => {
  it('AC3: is exactly 100 without incidents', () => {
    expect(uptimePercent([], 'api', NOW)).toBe(100);
  });

  it('AC3: one 45-minute incident gives 99.96, and a longer one gives less', () => {
    const short = [incident('a', '2026-09-09T09:00:00Z', '2026-09-09T09:45:00Z')];
    const long = [incident('a', '2026-09-09T09:00:00Z', '2026-09-09T15:00:00Z')];
    expect(uptimePercent(short, 'api', NOW)).toBe(99.96);
    expect(uptimePercent(long, 'api', NOW)).toBeLessThan(uptimePercent(short, 'api', NOW));
    expect(uptimePercent(long, 'api', NOW)).toBe(99.72);
  });

  it('AC3: overlapping incidents on one service count once', () => {
    const list = [
      incident('a', '2026-09-09T09:00:00Z', '2026-09-09T10:00:00Z'),
      incident('b', '2026-09-09T09:30:00Z', '2026-09-09T10:30:00Z', { impact: 'major-outage' }),
    ];
    const merged = [incident('m', '2026-09-09T09:00:00Z', '2026-09-09T10:30:00Z')];
    expect(uptimePercent(list, 'api', NOW)).toBe(uptimePercent(merged, 'api', NOW));
  });

  it('AC5: an open incident counts up to now', () => {
    const open = [incident('a', '2026-10-01T06:00:00Z', null)];
    const closed = [incident('a', '2026-10-01T06:00:00Z', '2026-10-01T12:00:00Z')];
    expect(uptimePercent(open, 'api', NOW)).toBeLessThan(100);
    expect(uptimePercent(open, 'api', NOW)).toBe(uptimePercent(closed, 'api', NOW));
  });

  it('AC4: an incident on another service does not change the value', () => {
    const list = [
      incident('a', '2026-09-09T09:00:00Z', '2026-09-09T15:00:00Z', {
        affectedServiceIds: ['web'],
      }),
    ];
    expect(uptimePercent(list, 'api', NOW)).toBe(100);
    expect(uptimePercent(list, 'web', NOW)).toBeLessThan(100);
  });

  it('AC3: ignores upcoming maintenance', () => {
    const list = [
      incident('m', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z', { kind: 'maintenance' }),
    ];
    expect(uptimePercent(list, 'api', NOW)).toBe(100);
  });
});
