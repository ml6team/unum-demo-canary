import { describe, expect, it } from 'vitest';
import { incidents, NOW, services } from '../data';
import { formatUptime } from './format';
import type { Impact, Incident, IncidentKind } from './types';
import { uptimeHistory } from './uptime';

const WINDOW_MINUTES = 89.5 * 24 * 60;

function make(
  id: string,
  impact: Impact,
  startedAt: string,
  resolvedAt: string | null,
  options: { kind?: IncidentKind; services?: string[] } = {},
): Incident {
  return {
    id,
    kind: options.kind ?? 'incident',
    title: id,
    impact,
    affectedServiceIds: options.services ?? ['api'],
    startedAt,
    resolvedAt,
    updates: [],
  };
}

function statusOn(list: Incident[], day: string, serviceId = 'api') {
  return uptimeHistory(serviceId, list, NOW).days.find((d) => d.day === day)?.status;
}

describe('uptimeHistory window', () => {
  it('AC1: returns 90 days, oldest first, the last one being the day of now', () => {
    const { days } = uptimeHistory('api', [], NOW);
    expect(days).toHaveLength(90);
    expect(days[0]?.day).toBe('2026-07-04');
    expect(days[89]?.day).toBe('2026-10-01');
  });

  it('AC3: a service without incidents is operational every day with 100% uptime', () => {
    const { days, uptimePercent } = uptimeHistory('api', [], NOW);
    expect(days.every((d) => d.status === 'operational' && d.incidents.length === 0)).toBe(true);
    expect(uptimePercent).toBe(100);
  });
});

describe('uptimeHistory day status', () => {
  it('AC2: a day takes the impact of an incident that affects the service', () => {
    const list = [make('a', 'partial-outage', '2026-09-12T10:00:00Z', '2026-09-12T10:30:00Z')];
    expect(statusOn(list, '2026-09-12')).toBe('partial-outage');
    expect(statusOn(list, '2026-09-11')).toBe('operational');
  });

  it('AC2: incidents of other services do not colour the day', () => {
    const list = [
      make('a', 'major-outage', '2026-09-12T10:00:00Z', '2026-09-12T10:30:00Z', {
        services: ['web'],
      }),
    ];
    expect(statusOn(list, '2026-09-12')).toBe('operational');
  });

  it('AC2: maintenance leaves the day operational and is not downtime', () => {
    const list = [
      make('m', 'major-outage', '2026-09-12T10:00:00Z', '2026-09-12T12:00:00Z', {
        kind: 'maintenance',
      }),
    ];
    const { days, uptimePercent } = uptimeHistory('api', list, NOW);
    expect(days.find((d) => d.day === '2026-09-12')).toMatchObject({
      status: 'operational',
      incidents: [],
    });
    expect(uptimePercent).toBe(100);
  });

  it('AC4: overlapping incidents on one day show the worst impact', () => {
    const list = [
      make('a', 'degraded', '2026-09-12T10:00:00Z', '2026-09-12T14:00:00Z'),
      make('b', 'major-outage', '2026-09-12T11:00:00Z', '2026-09-12T11:20:00Z'),
      make('c', 'partial-outage', '2026-09-12T12:00:00Z', '2026-09-12T12:10:00Z'),
    ];
    const day = uptimeHistory('api', list, NOW).days.find((d) => d.day === '2026-09-12');
    expect(day?.status).toBe('major-outage');
    expect(day?.incidents.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('AC2: an incident across midnight colours both days', () => {
    const list = [make('a', 'partial-outage', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')];
    expect(statusOn(list, '2026-09-10')).toBe('partial-outage');
    expect(statusOn(list, '2026-09-11')).toBe('partial-outage');
    expect(statusOn(list, '2026-09-12')).toBe('operational');
  });

  it('AC2: an incident that started before the window colours the days it touches inside it', () => {
    const list = [make('a', 'degraded', '2026-07-03T20:00:00Z', '2026-07-04T02:00:00Z')];
    const { days } = uptimeHistory('api', list, NOW);
    expect(days[0]).toMatchObject({ day: '2026-07-04', status: 'degraded' });
    expect(days[1]?.status).toBe('operational');
  });

  it('AC2: an ongoing incident colours every day until now', () => {
    const list = [make('a', 'degraded', '2026-09-29T20:00:00Z', null)];
    expect(statusOn(list, '2026-09-29')).toBe('degraded');
    expect(statusOn(list, '2026-09-30')).toBe('degraded');
    expect(statusOn(list, '2026-10-01')).toBe('degraded');
  });

  it('AC2: an upcoming incident is ignored', () => {
    const list = [make('a', 'major-outage', '2026-10-01T13:00:00Z', '2026-10-01T14:00:00Z')];
    const { days, uptimePercent } = uptimeHistory('api', list, NOW);
    expect(days[89]?.status).toBe('operational');
    expect(uptimePercent).toBe(100);
  });
});

describe('uptimeHistory uptime percentage', () => {
  it('AC3: degraded counts as up', () => {
    const list = [make('a', 'degraded', '2026-09-12T10:00:00Z', '2026-09-12T14:00:00Z')];
    expect(uptimeHistory('api', list, NOW).uptimePercent).toBe(100);
  });

  it('AC3: partial and major outage minutes count as downtime over the window up to now', () => {
    const list = [
      make('a', 'partial-outage', '2026-09-12T10:00:00Z', '2026-09-12T10:30:00Z'),
      make('b', 'major-outage', '2026-09-13T10:00:00Z', '2026-09-13T10:30:00Z'),
    ];
    const expected = 100 - (60 / WINDOW_MINUTES) * 100;
    expect(uptimeHistory('api', list, NOW).uptimePercent).toBeCloseTo(expected, 9);
  });

  it('AC4: overlapping outages count once', () => {
    const list = [
      make('a', 'partial-outage', '2026-09-12T10:00:00Z', '2026-09-12T10:40:00Z'),
      make('b', 'major-outage', '2026-09-12T10:20:00Z', '2026-09-12T11:00:00Z'),
    ];
    const expected = 100 - (60 / WINDOW_MINUTES) * 100;
    expect(uptimeHistory('api', list, NOW).uptimePercent).toBeCloseTo(expected, 9);
  });

  it('AC3: downtime of an incident across midnight is split by time, not by day', () => {
    const list = [make('a', 'partial-outage', '2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')];
    const expected = 100 - (155 / WINDOW_MINUTES) * 100;
    expect(uptimeHistory('api', list, NOW).uptimePercent).toBeCloseTo(expected, 9);
  });

  it('AC3: only the part of an incident inside the window counts', () => {
    const list = [make('a', 'major-outage', '2026-07-03T23:00:00Z', '2026-07-04T01:00:00Z')];
    const expected = 100 - (60 / WINDOW_MINUTES) * 100;
    expect(uptimeHistory('api', list, NOW).uptimePercent).toBeCloseTo(expected, 9);
  });

  it('AC3: an ongoing outage counts until now', () => {
    const list = [make('a', 'major-outage', '2026-10-01T10:00:00Z', null)];
    const expected = 100 - (120 / WINDOW_MINUTES) * 100;
    expect(uptimeHistory('api', list, NOW).uptimePercent).toBeCloseTo(expected, 9);
  });
});

describe('fixture data', () => {
  // Worked out by hand from src/data/incidents.json: D degraded, P partial outage, M major outage.
  const expected: Record<string, { uptime: string; days: Record<string, string> }> = {
    api: {
      uptime: '99.9%',
      days: {
        '2026-07-14': 'degraded',
        '2026-08-27': 'partial-outage',
        '2026-09-13': 'degraded',
        '2026-09-17': 'degraded',
      },
    },
    web: {
      uptime: '99.9%',
      days: {
        '2026-07-22': 'degraded',
        '2026-08-27': 'partial-outage',
        '2026-09-17': 'degraded',
        '2026-09-24': 'partial-outage',
      },
    },
    git: {
      uptime: '99.9%',
      days: {
        '2026-07-06': 'degraded',
        '2026-07-30': 'partial-outage',
        '2026-09-17': 'degraded',
      },
    },
    webhooks: {
      uptime: '99.8%',
      days: { '2026-07-18': 'degraded', '2026-08-19': 'major-outage' },
    },
    notifications: {
      uptime: '100.0%',
      days: { '2026-07-09': 'degraded', '2026-09-30': 'degraded' },
    },
    search: {
      uptime: '99.7%',
      days: {
        '2026-08-13': 'degraded',
        '2026-09-08': 'degraded',
        '2026-09-09': 'partial-outage',
        '2026-09-10': 'partial-outage',
        '2026-09-11': 'partial-outage',
        '2026-09-12': 'degraded',
        '2026-09-13': 'degraded',
      },
    },
  };

  it('AC8: covers every service', () => {
    expect(services.map((s) => s.id).sort()).toEqual(Object.keys(expected).sort());
  });

  for (const [serviceId, want] of Object.entries(expected)) {
    it(`AC8: ${serviceId} day colours and uptime match the hand calculation`, () => {
      const { days, uptimePercent } = uptimeHistory(serviceId, incidents, NOW);
      const nonOperational = Object.fromEntries(
        days.filter((d) => d.status !== 'operational').map((d) => [d.day, d.status]),
      );
      expect(nonOperational).toEqual(want.days);
      expect(formatUptime(uptimePercent)).toBe(want.uptime);
    });
  }
});
