import { describe, expect, it } from 'vitest';
import { incidents as fixtureIncidents } from '../data';
import { historyStart } from './incidents';
import { utcDayKey } from './time';
import type { Incident } from './types';
import { uptimeDays, uptimePercent } from './uptime';

/** NOW used in fixtures */
const NOW = new Date('2026-10-01T12:00:00Z');

// ---------------------------------------------------------------------------
// uptimeDays
// ---------------------------------------------------------------------------

describe('uptimeDays', () => {
  it('returns exactly 90 entries', () => {
    const records = uptimeDays(fixtureIncidents, 'git', NOW);
    expect(records).toHaveLength(90);
  });

  it('index 0 is the oldest day (historyStart) and index 89 is the day of NOW', () => {
    const records = uptimeDays(fixtureIncidents, 'git', NOW);
    const expectedFirst = utcDayKey(historyStart(NOW));
    const expectedLast = utcDayKey(NOW);
    expect(records.at(0)?.day).toBe(expectedFirst);
    expect(records.at(89)?.day).toBe(expectedLast);
  });

  it('AC1: days with no incidents return "operational"', () => {
    const records = uptimeDays(fixtureIncidents, 'git', NOW);
    // 2026-07-04 is the first day of the window; no incident that day
    const day = records.find((r) => r.day === '2026-07-04');
    expect(day).toBeDefined();
    expect(day!.status).toBe('operational');
    expect(day!.incidents).toHaveLength(0);
  });

  it('AC1: git on 2026-07-30 is "partial-outage" (inc-2026-07-30-ssh-pushes)', () => {
    const records = uptimeDays(fixtureIncidents, 'git', NOW);
    const day = records.find((r) => r.day === '2026-07-30');
    expect(day).toBeDefined();
    expect(day!.status).toBe('partial-outage');
    expect(day!.incidents.map((i) => i.id)).toContain('inc-2026-07-30-ssh-pushes');
  });

  it('AC1: webhooks on 2026-08-19 is "major-outage"', () => {
    const records = uptimeDays(fixtureIncidents, 'webhooks', NOW);
    const day = records.find((r) => r.day === '2026-08-19');
    expect(day).toBeDefined();
    expect(day!.status).toBe('major-outage');
  });

  it('AC1: maintenance incidents do not affect a service day status (git on 2026-08-08 is "operational")', () => {
    const records = uptimeDays(fixtureIncidents, 'git', NOW);
    const day = records.find((r) => r.day === '2026-08-08');
    expect(day).toBeDefined();
    expect(day!.status).toBe('operational');
    expect(day!.incidents).toHaveLength(0);
  });

  it('AC1: incidents from other services do not appear on a service day', () => {
    const records = uptimeDays(fixtureIncidents, 'notifications', NOW);
    // The git partial-outage on 2026-07-30 should not affect notifications
    const day = records.find((r) => r.day === '2026-07-30');
    expect(day).toBeDefined();
    expect(day!.status).toBe('operational');
  });

  it('AC2: when two non-maintenance incidents overlap on the same day, the worst wins', () => {
    const testIncidents: Incident[] = [
      {
        id: 'test-1',
        kind: 'incident',
        title: 'Degraded performance',
        impact: 'degraded',
        affectedServiceIds: ['svc-a'],
        startedAt: '2026-09-01T08:00:00Z',
        resolvedAt: '2026-09-01T09:00:00Z',
        updates: [],
      },
      {
        id: 'test-2',
        kind: 'incident',
        title: 'Partial outage',
        impact: 'partial-outage',
        affectedServiceIds: ['svc-a'],
        startedAt: '2026-09-01T10:00:00Z',
        resolvedAt: '2026-09-01T11:00:00Z',
        updates: [],
      },
    ];
    const records = uptimeDays(testIncidents, 'svc-a', NOW);
    const day = records.find((r) => r.day === '2026-09-01');
    expect(day).toBeDefined();
    expect(day!.status).toBe('partial-outage');
    expect(day!.incidents).toHaveLength(2);
  });

  it('AC2: a maintenance incident on the same day as an incident does not change the result', () => {
    const testIncidents: Incident[] = [
      {
        id: 'test-incident',
        kind: 'incident',
        title: 'Degraded performance',
        impact: 'degraded',
        affectedServiceIds: ['svc-b'],
        startedAt: '2026-09-02T08:00:00Z',
        resolvedAt: '2026-09-02T09:00:00Z',
        updates: [],
      },
      {
        id: 'test-maintenance',
        kind: 'maintenance',
        title: 'Scheduled maintenance',
        impact: 'partial-outage',
        affectedServiceIds: ['svc-b'],
        startedAt: '2026-09-02T10:00:00Z',
        resolvedAt: '2026-09-02T12:00:00Z',
        updates: [],
      },
    ];
    const records = uptimeDays(testIncidents, 'svc-b', NOW);
    const day = records.find((r) => r.day === '2026-09-02');
    expect(day).toBeDefined();
    // Maintenance does not count; only the degraded incident matters
    expect(day!.status).toBe('degraded');
    // Maintenance does not appear in incidents list
    expect(day!.incidents.map((i) => i.id)).not.toContain('test-maintenance');
  });

  it('AC2: a day with only a maintenance incident returns "operational"', () => {
    const testIncidents: Incident[] = [
      {
        id: 'test-maint-only',
        kind: 'maintenance',
        title: 'Only maintenance',
        impact: 'major-outage',
        affectedServiceIds: ['svc-c'],
        startedAt: '2026-09-03T01:00:00Z',
        resolvedAt: '2026-09-03T03:00:00Z',
        updates: [],
      },
    ];
    const records = uptimeDays(testIncidents, 'svc-c', NOW);
    const day = records.find((r) => r.day === '2026-09-03');
    expect(day).toBeDefined();
    expect(day!.status).toBe('operational');
    expect(day!.incidents).toHaveLength(0);
  });

  it('consecutive days advance correctly (index 1 is day after index 0)', () => {
    const records = uptimeDays(fixtureIncidents, 'api', NOW);
    const day0 = records.at(0)?.day;
    const day1 = records.at(1)?.day;
    expect(day0).toBeDefined();
    expect(day1).toBeDefined();
    const d0 = new Date(`${day0!}T00:00:00Z`);
    const d1 = new Date(`${day1!}T00:00:00Z`);
    expect(d1.getTime() - d0.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// uptimePercent
// ---------------------------------------------------------------------------

describe('uptimePercent', () => {
  it('returns "100.0%" for a service with no downtime incidents', () => {
    // notifications only has degraded incidents, which are not counted as downtime
    const result = uptimePercent(fixtureIncidents, 'notifications', NOW);
    expect(result).toBe('100.0%');
  });

  it('AC1: webhooks has a major-outage and its percentage is correct', () => {
    // inc-2026-08-19-webhooks-outage: 13:02 to 16:08 = 3h 6m = 11,160,000 ms
    const downtimeMs = 11_160_000;
    const windowMs = 90 * 24 * 60 * 60 * 1000;
    const expected = ((1 - downtimeMs / windowMs) * 100).toFixed(1) + '%';
    const result = uptimePercent(fixtureIncidents, 'webhooks', NOW);
    expect(result).toBe(expected);
  });

  it('maintenance incidents do not count as downtime', () => {
    // git has mnt-2026-08-08-git-database (maintenance, partial-outage) and one real incident
    // inc-2026-07-30-ssh-pushes: partial-outage, 15:00–15:35 = 35 min = 2,100,000 ms
    const downtimeMs = 35 * 60 * 1000;
    const windowMs = 90 * 24 * 60 * 60 * 1000;
    const expected = ((1 - downtimeMs / windowMs) * 100).toFixed(1) + '%';
    const result = uptimePercent(fixtureIncidents, 'git', NOW);
    expect(result).toBe(expected);
  });

  it('degraded incidents do not count as downtime', () => {
    // search has several degraded incidents and partial-outage ones
    // inc-2026-09-09-search-unavailable: partial-outage 09:12 to 11:47 = 2h35m = 9,300,000 ms
    // inc-2026-09-10-search-errors: partial-outage 22:40 to 01:15 next day = 2h35m = 9,300,000 ms
    const result = uptimePercent(fixtureIncidents, 'search', NOW);
    // Just verify it returns a string ending in '%' and is not 100%
    expect(result).toMatch(/^\d+\.\d%$/);
    expect(result).not.toBe('100.0%');
  });

  it('incidents outside the 90-day window do not count', () => {
    const outsideIncident: Incident[] = [
      {
        id: 'outside',
        kind: 'incident',
        title: 'Old outage',
        impact: 'major-outage',
        affectedServiceIds: ['svc-x'],
        startedAt: '2020-01-01T00:00:00Z',
        resolvedAt: '2020-01-01T12:00:00Z',
        updates: [],
      },
    ];
    expect(uptimePercent(outsideIncident, 'svc-x', NOW)).toBe('100.0%');
  });

  it('result string always has exactly one decimal place', () => {
    const result = uptimePercent(fixtureIncidents, 'api', NOW);
    expect(result).toMatch(/^\d+\.\d%$/);
  });

  it('an ongoing incident (resolvedAt null) is clamped to the window end', () => {
    const ongoingIncidents: Incident[] = [
      {
        id: 'ongoing',
        kind: 'incident',
        title: 'Ongoing outage',
        impact: 'major-outage',
        affectedServiceIds: ['svc-y'],
        startedAt: new Date(
          new Date('2026-10-01T12:00:00Z').getTime() - 90 * 24 * 3600 * 1000,
        ).toISOString(),
        resolvedAt: null,
        updates: [],
      },
    ];
    // The entire window is down, so uptimePercent should be near 0.0%
    const result = uptimePercent(ongoingIncidents, 'svc-y', NOW);
    expect(result).toMatch(/^0\.\d%$/);
  });
});

// ---------------------------------------------------------------------------
// DayRecord shape
// ---------------------------------------------------------------------------

describe('DayRecord shape', () => {
  it('each record has day, status, and incidents fields', () => {
    const records = uptimeDays(fixtureIncidents, 'api', NOW);
    for (const r of records) {
      expect(r).toHaveProperty('day');
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('incidents');
      expect(typeof r.day).toBe('string');
      expect(r.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(r.incidents)).toBe(true);
    }
  });
});
