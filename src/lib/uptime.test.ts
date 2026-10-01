import { describe, expect, it } from 'vitest';
import { NOW as FIXTURE_NOW, incidents as fixtureIncidents, services } from '../data';
import { historyStart } from './incidents';
import { DAY_MS, MINUTE_MS } from './time';
import type { Incident } from './types';
import { serviceDays, serviceUptime } from './uptime';

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

function toneOn(list: Incident[], day: string, serviceId = 'api') {
  return serviceDays(serviceId, list, NOW).find((d) => d.day === day)?.tone;
}

describe('serviceDays', () => {
  it('AC1: returns 90 days ending today', () => {
    const days = serviceDays('api', [], NOW);
    expect(days).toHaveLength(90);
    expect(days[0]?.day).toBe(historyStart(NOW).toISOString().slice(0, 10));
    expect(days[89]?.day).toBe('2026-10-01');
  });

  it('AC1: lists consecutive days oldest first', () => {
    const days = serviceDays('api', [], NOW);
    days.forEach((d, i) => {
      const expected = new Date(historyStart(NOW).getTime() + i * DAY_MS)
        .toISOString()
        .slice(0, 10);
      expect(d.day).toBe(expected);
    });
  });

  it('AC1: honours a custom number of days', () => {
    expect(serviceDays('api', [], NOW, 7)).toHaveLength(7);
  });

  it('AC2: a day without incidents is operational', () => {
    const days = serviceDays('api', [], NOW);
    expect(days.every((d) => d.tone === 'operational' && d.incidentIds.length === 0)).toBe(true);
  });

  it('AC2: a day takes the impact of its incident', () => {
    const list = [
      incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z', { impact: 'partial-outage' }),
    ];
    expect(toneOn(list, '2026-09-10')).toBe('partial-outage');
    expect(toneOn(list, '2026-09-09')).toBe('operational');
    expect(toneOn(list, '2026-09-11')).toBe('operational');
    const day = serviceDays('api', list, NOW).find((d) => d.day === '2026-09-10');
    expect(day?.incidentIds).toEqual(['a']);
  });

  it('AC2: several incidents on a day take the most severe impact', () => {
    const list = [
      incident('a', '2026-09-10T01:00:00Z', '2026-09-10T02:00:00Z', { impact: 'degraded' }),
      incident('b', '2026-09-10T05:00:00Z', '2026-09-10T06:00:00Z', { impact: 'major-outage' }),
      incident('c', '2026-09-10T08:00:00Z', '2026-09-10T09:00:00Z', { impact: 'partial-outage' }),
    ];
    expect(toneOn(list, '2026-09-10')).toBe('major-outage');
  });

  it('AC2: an incident spanning midnight colours both days', () => {
    const list = [incident('a', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')];
    expect(toneOn(list, '2026-09-10')).toBe('degraded');
    expect(toneOn(list, '2026-09-11')).toBe('degraded');
    expect(toneOn(list, '2026-09-12')).toBe('operational');
  });

  it('AC2: an incident ending exactly at midnight does not colour the next day', () => {
    const list = [incident('a', '2026-09-10T22:00:00Z', '2026-09-11T00:00:00Z')];
    expect(toneOn(list, '2026-09-10')).toBe('degraded');
    expect(toneOn(list, '2026-09-11')).toBe('operational');
  });

  it('AC2: a maintenance-only day is maintenance', () => {
    const list = [
      incident('m', '2026-09-10T02:00:00Z', '2026-09-10T03:00:00Z', {
        kind: 'maintenance',
        impact: 'major-outage',
      }),
    ];
    expect(toneOn(list, '2026-09-10')).toBe('maintenance');
    const day = serviceDays('api', list, NOW).find((d) => d.day === '2026-09-10');
    expect(day?.incidentIds).toEqual(['m']);
  });

  it('AC2: an incident overrides maintenance on the same day', () => {
    const list = [
      incident('m', '2026-09-10T02:00:00Z', '2026-09-10T03:00:00Z', { kind: 'maintenance' }),
      incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z', { impact: 'partial-outage' }),
    ];
    expect(toneOn(list, '2026-09-10')).toBe('partial-outage');
  });

  it('AC2: upcoming maintenance colours nothing', () => {
    const list = [
      incident('m', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z', { kind: 'maintenance' }),
    ];
    const days = serviceDays('api', list, NOW);
    expect(days.every((d) => d.tone === 'operational')).toBe(true);
  });

  it('AC2: an open incident colours the bar of today', () => {
    const list = [incident('a', '2026-09-30T20:00:00Z', null, { impact: 'major-outage' })];
    expect(toneOn(list, '2026-10-01')).toBe('major-outage');
    expect(toneOn(list, '2026-09-30')).toBe('major-outage');
  });

  it('AC4: an incident colours the bars of each affected service only', () => {
    const list = [
      incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z', {
        affectedServiceIds: ['api', 'web', 'git'],
      }),
    ];
    for (const id of ['api', 'web', 'git']) expect(toneOn(list, '2026-09-10', id)).toBe('degraded');
    for (const id of ['webhooks', 'notifications', 'search']) {
      const days = serviceDays(id, list, NOW);
      expect(days.every((d) => d.tone === 'operational')).toBe(true);
    }
  });

  it('AC4: an incident on one service leaves another service unchanged', () => {
    const before = serviceDays('web', [], NOW);
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z')];
    expect(serviceDays('web', list, NOW)).toEqual(before);
  });

  it('AC2: shows the real fixture incidents on the right days', () => {
    const days = serviceDays('git', fixtureIncidents, FIXTURE_NOW);
    expect(days.find((d) => d.day === '2026-07-30')?.tone).toBe('partial-outage');
    expect(days.find((d) => d.day === '2026-07-31')?.tone).toBe('operational');
  });
});

describe('serviceUptime', () => {
  it('AC3: is exactly 100 without incidents', () => {
    const result = serviceUptime('api', [], NOW);
    expect(result.percent).toBe(100);
    expect(result.downtimeMs).toBe(0);
    expect(result.windowMs).toBe(NOW.getTime() - historyStart(NOW).getTime());
  });

  it('AC3: a one-minute incident never rounds up to 100', () => {
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T10:01:00Z')];
    const result = serviceUptime('api', list, NOW);
    expect(result.downtimeMs).toBe(MINUTE_MS);
    expect(result.percent).toBeLessThan(100);
    expect(result.percent).toBe(99.99);
  });

  it('AC3: truncates the percentage to two decimals', () => {
    const windowMs = NOW.getTime() - historyStart(NOW).getTime();
    const downtime = Math.round(windowMs * 0.0123);
    const start = new Date('2026-09-10T00:00:00Z');
    const list = [
      incident('a', start.toISOString(), new Date(start.getTime() + downtime).toISOString()),
    ];
    expect(serviceUptime('api', list, NOW).percent).toBe(98.77);
  });

  it('AC3: counts overlapping incidents once', () => {
    const list = [
      incident('a', '2026-09-10T10:00:00Z', '2026-09-10T12:00:00Z'),
      incident('b', '2026-09-10T11:00:00Z', '2026-09-10T13:00:00Z', { impact: 'major-outage' }),
    ];
    expect(serviceUptime('api', list, NOW).downtimeMs).toBe(3 * 60 * MINUTE_MS);
  });

  it('AC3: clips an incident that started before the window', () => {
    const start = historyStart(NOW);
    const list = [
      incident(
        'a',
        new Date(start.getTime() - DAY_MS).toISOString(),
        new Date(start.getTime() + 60 * MINUTE_MS).toISOString(),
      ),
    ];
    expect(serviceUptime('api', list, NOW).downtimeMs).toBe(60 * MINUTE_MS);
  });

  it('AC3: runs an open incident up to now', () => {
    const list = [incident('a', '2026-10-01T10:00:00Z', null)];
    expect(serviceUptime('api', list, NOW).downtimeMs).toBe(2 * 60 * MINUTE_MS);
  });

  it('AC3: maintenance and upcoming incidents add no downtime', () => {
    const list = [
      incident('m', '2026-09-10T02:00:00Z', '2026-09-10T03:00:00Z', { kind: 'maintenance' }),
      incident('u', '2026-10-04T01:00:00Z', '2026-10-04T03:00:00Z', { kind: 'maintenance' }),
    ];
    const result = serviceUptime('api', list, NOW);
    expect(result.downtimeMs).toBe(0);
    expect(result.percent).toBe(100);
  });

  it('AC4: an incident on one service leaves another service unchanged', () => {
    const before = serviceUptime('web', [], NOW);
    const list = [incident('a', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z')];
    expect(serviceUptime('web', list, NOW)).toEqual(before);
    expect(serviceUptime('api', list, NOW).percent).toBeLessThan(100);
  });

  it('AC3: every service in the fixtures has downtime and a non-operational day', () => {
    for (const service of services) {
      expect(serviceUptime(service.id, fixtureIncidents, FIXTURE_NOW).percent).toBeLessThan(100);
      const days = serviceDays(service.id, fixtureIncidents, FIXTURE_NOW);
      expect(days.some((d) => d.tone !== 'operational')).toBe(true);
    }
  });
});
