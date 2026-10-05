import { describe, expect, it } from 'vitest';
import { incidents as fixtureIncidents } from '../data';
import { DAY_MS, HOUR_MS, MINUTE_MS } from './time';
import type { Incident } from './types';
import { describeUptimeDay, uptimeDays, uptimePercent } from './uptime';

const NOW = new Date('2026-10-01T12:00:00Z');
const WINDOW_MS = NOW.getTime() - Date.parse('2026-07-04T00:00:00Z');

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

function dayOf(days: ReturnType<typeof uptimeDays>, key: string) {
  const found = days.find((d) => d.day === key);
  if (!found) throw new Error(`no bar for ${key}`);
  return found;
}

describe('uptimeDays', () => {
  it('AC1: returns 90 days, oldest first, ending on the day of now', () => {
    const days = uptimeDays('api', [], NOW);
    expect(days).toHaveLength(90);
    expect(days[0]?.day).toBe('2026-07-04');
    expect(days[89]?.day).toBe('2026-10-01');
    const keys = days.map((d) => d.day);
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(90);
  });

  it('AC2: a day without incidents is operational with no incident', () => {
    const days = uptimeDays('api', [], NOW);
    expect(days.every((d) => d.status === 'operational' && d.incident === null)).toBe(true);
  });

  it('AC2: a day with several incidents takes the worst one', () => {
    const minor = incident('minor', '2026-09-10T08:00:00Z', '2026-09-10T09:00:00Z');
    const major = incident('major', '2026-09-10T12:00:00Z', '2026-09-10T13:00:00Z', {
      impact: 'major-outage',
    });
    const day = dayOf(uptimeDays('api', [minor, major], NOW), '2026-09-10');
    expect(day.status).toBe('major-outage');
    expect(day.incident?.id).toBe('major');
  });

  it('AC2: equal impact picks the incident that started first', () => {
    const later = incident('later', '2026-09-10T12:00:00Z', '2026-09-10T13:00:00Z');
    const earlier = incident('earlier', '2026-09-10T08:00:00Z', '2026-09-10T09:00:00Z');
    const day = dayOf(uptimeDays('api', [later, earlier], NOW), '2026-09-10');
    expect(day.incident?.id).toBe('earlier');
  });

  it('AC2: a started maintenance window colours its day with its impact', () => {
    const maintenance = incident('mnt', '2026-09-20T01:00:00Z', '2026-09-20T03:00:00Z', {
      kind: 'maintenance',
      impact: 'partial-outage',
    });
    const days = uptimeDays('api', [maintenance], NOW);
    expect(dayOf(days, '2026-09-20').status).toBe('partial-outage');
    expect(dayOf(days, '2026-09-20').incident?.id).toBe('mnt');
    expect(dayOf(days, '2026-09-19').status).toBe('operational');
  });

  it('AC4: an incident on another service leaves the days operational', () => {
    const apiOnly = incident('api-only', '2026-09-10T08:00:00Z', '2026-09-10T09:00:00Z', {
      impact: 'major-outage',
    });
    const days = uptimeDays('web', [apiOnly], NOW);
    expect(days.every((d) => d.status === 'operational' && d.incident === null)).toBe(true);
  });

  it('AC4: a multi-service incident affects only the listed services', () => {
    const shared = incident('shared', '2026-09-10T08:00:00Z', '2026-09-10T09:00:00Z', {
      affectedServiceIds: ['api', 'git'],
    });
    expect(dayOf(uptimeDays('git', [shared], NOW), '2026-09-10').status).toBe('degraded');
    expect(dayOf(uptimeDays('web', [shared], NOW), '2026-09-10').status).toBe('operational');
  });

  it('AC4: an incident spanning three days colours three days', () => {
    const long = incident('long', '2026-09-10T20:00:00Z', '2026-09-12T04:00:00Z');
    const coloured = uptimeDays('api', [long], NOW)
      .filter((d) => d.status !== 'operational')
      .map((d) => d.day);
    expect(coloured).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
  });

  it('AC4: an open incident colours every day from its start through today', () => {
    const open = incident('open', '2026-09-28T10:00:00Z', null, { impact: 'partial-outage' });
    const coloured = uptimeDays('api', [open], NOW)
      .filter((d) => d.status === 'partial-outage')
      .map((d) => d.day);
    expect(coloured).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']);
  });

  it('AC4: an incident crossing midnight colours both days', () => {
    const crossing = incident('cross', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z');
    const days = uptimeDays('api', [crossing], NOW);
    expect(dayOf(days, '2026-09-10').status).toBe('degraded');
    expect(dayOf(days, '2026-09-11').status).toBe('degraded');
    expect(dayOf(days, '2026-09-12').status).toBe('operational');
  });

  it('AC4: an incident ending exactly at midnight does not colour the next day', () => {
    const ends = incident('ends', '2026-09-10T22:00:00Z', '2026-09-11T00:00:00Z');
    const days = uptimeDays('api', [ends], NOW);
    expect(dayOf(days, '2026-09-10').status).toBe('degraded');
    expect(dayOf(days, '2026-09-11').status).toBe('operational');
  });

  it('AC4: an incident that started before the window colours the days inside it', () => {
    const old = incident('old', '2026-06-30T00:00:00Z', '2026-07-05T06:00:00Z');
    const days = uptimeDays('api', [old], NOW);
    expect(dayOf(days, '2026-07-04').status).toBe('degraded');
    expect(dayOf(days, '2026-07-05').status).toBe('degraded');
    expect(dayOf(days, '2026-07-06').status).toBe('operational');
  });

  it('AC4: an upcoming incident changes nothing', () => {
    const upcoming = incident('soon', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z', {
      kind: 'maintenance',
    });
    const days = uptimeDays('api', [upcoming], NOW);
    expect(days.every((d) => d.status === 'operational')).toBe(true);
  });

  it('AC4: fixtures colour search on Sep 10 and Sep 11', () => {
    const days = uptimeDays('search', fixtureIncidents, NOW);
    expect(dayOf(days, '2026-09-10').status).toBe('partial-outage');
    expect(dayOf(days, '2026-09-11').status).toBe('partial-outage');
  });

  it('AC4: fixtures colour only the affected service on Aug 27', () => {
    expect(dayOf(uptimeDays('web', fixtureIncidents, NOW), '2026-08-27').status).toBe(
      'partial-outage',
    );
    expect(dayOf(uptimeDays('search', fixtureIncidents, NOW), '2026-08-27').status).toBe(
      'operational',
    );
  });
});

describe('uptimePercent', () => {
  it('AC3: is 100 when no incident affected the service', () => {
    expect(uptimePercent('api', [], NOW)).toBe(100);
  });

  it('AC3: is below 100 after a 90 minute incident, by its share of the window', () => {
    const short = incident('short', '2026-09-10T10:00:00Z', '2026-09-10T11:30:00Z');
    const expected = (100 * (WINDOW_MS - 90 * MINUTE_MS)) / WINDOW_MS;
    const percent = uptimePercent('api', [short], NOW);
    expect(percent).toBeLessThan(100);
    expect(percent).toBeCloseTo(expected, 8);
  });

  it('AC3: counts a degraded-only incident as downtime', () => {
    const degraded = incident('deg', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z');
    expect(uptimePercent('api', [degraded], NOW)).toBeLessThan(100);
  });

  it('AC3: does not count overlapping incidents twice', () => {
    const a = incident('a', '2026-09-10T10:00:00Z', '2026-09-10T12:00:00Z');
    const b = incident('b', '2026-09-10T11:00:00Z', '2026-09-10T13:00:00Z', {
      impact: 'major-outage',
    });
    const expected = (100 * (WINDOW_MS - 3 * HOUR_MS)) / WINDOW_MS;
    expect(uptimePercent('api', [a, b], NOW)).toBeCloseTo(expected, 8);
  });

  it('AC3: is 0 when an incident covers the whole window', () => {
    const all = incident('all', '2026-06-01T00:00:00Z', null, { impact: 'major-outage' });
    expect(uptimePercent('api', [all], NOW)).toBe(0);
  });

  it('AC3: stays within 0 and 100 for many overlapping incidents', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      incident(`m${i}`, '2026-06-01T00:00:00Z', '2026-12-01T00:00:00Z'),
    );
    const percent = uptimePercent('api', many, NOW);
    expect(percent).toBeGreaterThanOrEqual(0);
    expect(percent).toBeLessThanOrEqual(100);
  });

  it('AC3: only counts the part of an incident inside the window', () => {
    const old = incident('old', '2026-06-30T00:00:00Z', '2026-07-04T06:00:00Z');
    const expected = (100 * (WINDOW_MS - 6 * HOUR_MS)) / WINDOW_MS;
    expect(uptimePercent('api', [old], NOW)).toBeCloseTo(expected, 8);
  });

  it('AC4: an open incident counts until now', () => {
    const open = incident('open', '2026-09-30T12:00:00Z', null);
    const expected = (100 * (WINDOW_MS - DAY_MS)) / WINDOW_MS;
    expect(uptimePercent('api', [open], NOW)).toBeCloseTo(expected, 8);
  });

  it('AC4: an incident resolving after now counts until now', () => {
    const running = incident('running', '2026-10-01T10:00:00Z', '2026-10-01T18:00:00Z');
    const expected = (100 * (WINDOW_MS - 2 * HOUR_MS)) / WINDOW_MS;
    expect(uptimePercent('api', [running], NOW)).toBeCloseTo(expected, 8);
  });

  it('AC4: an incident on another service leaves the percentage at 100', () => {
    const apiOnly = incident('api-only', '2026-09-10T08:00:00Z', '2026-09-10T20:00:00Z');
    expect(uptimePercent('web', [apiOnly], NOW)).toBe(100);
  });

  it('AC4: an upcoming incident changes nothing', () => {
    const upcoming = incident('soon', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z');
    expect(uptimePercent('api', [upcoming], NOW)).toBe(100);
  });
});

describe('describeUptimeDay', () => {
  it('AC5: names the date, the incident title and its status label', () => {
    const crossing = incident('cross', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z', {
      title: 'Search errors',
      impact: 'partial-outage',
    });
    const day = dayOf(uptimeDays('api', [crossing], NOW), '2026-09-10');
    expect(describeUptimeDay(day)).toBe('Sep 10, 2026: Search errors (Partial outage)');
  });

  it('AC5: says no incident for an empty day', () => {
    const day = dayOf(uptimeDays('api', [], NOW), '2026-09-10');
    expect(describeUptimeDay(day)).toBe('Sep 10, 2026: No incident');
  });
});
