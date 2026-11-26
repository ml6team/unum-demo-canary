import { describe, expect, it } from 'vitest';
import {
  addUtcDays,
  DAY_MS,
  durationMs,
  HOUR_MS,
  startOfUtcDay,
  utcDayKey,
  utcDaysBetween,
} from './time';

describe('utcDayKey', () => {
  it('returns the UTC calendar day', () => {
    expect(utcDayKey('2026-09-10T22:40:00Z')).toBe('2026-09-10');
  });

  it('uses UTC, not the offset the instant was written in', () => {
    expect(utcDayKey('2026-09-10T23:30:00-02:00')).toBe('2026-09-11');
  });

  it('accepts a Date', () => {
    expect(utcDayKey(new Date('2026-10-01T12:00:00Z'))).toBe('2026-10-01');
  });
});

describe('startOfUtcDay', () => {
  it('truncates to UTC midnight', () => {
    expect(startOfUtcDay('2026-10-01T12:34:56Z').toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('addUtcDays', () => {
  it('moves forwards and backwards by whole days', () => {
    expect(addUtcDays('2026-10-01T00:00:00Z', -89).toISOString()).toBe('2026-07-04T00:00:00.000Z');
    expect(addUtcDays('2026-09-30T06:00:00Z', 2).toISOString()).toBe('2026-10-02T06:00:00.000Z');
  });
});

describe('durationMs', () => {
  it('measures across midnight', () => {
    expect(durationMs('2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')).toBe(
      2 * HOUR_MS + 35 * 60_000,
    );
  });

  it('has a day constant of 24 hours', () => {
    expect(DAY_MS).toBe(24 * HOUR_MS);
  });
});

describe('utcDaysBetween', () => {
  it('AC1: is 0 on the same UTC day', () => {
    expect(utcDaysBetween('2026-10-01T00:00:00Z', '2026-10-01T23:59:59Z')).toBe(0);
  });

  it('AC1: counts one boundary across midnight UTC', () => {
    expect(utcDaysBetween('2026-10-01T23:59:00Z', '2026-10-02T00:01:00Z')).toBe(1);
  });

  it('AC1: counts several days', () => {
    expect(utcDaysBetween('2026-10-01T12:00:00Z', '2026-10-08T06:00:00Z')).toBe(7);
  });

  it('AC1: is negative when to is before from', () => {
    expect(utcDaysBetween('2026-10-08T06:00:00Z', '2026-10-01T12:00:00Z')).toBe(-7);
    expect(utcDaysBetween('2026-10-02T00:01:00Z', '2026-10-01T23:59:00Z')).toBe(-1);
  });

  it('AC1: uses UTC days, not the offset the timestamp was written in', () => {
    expect(utcDaysBetween('2026-10-01T23:30:00-02:00', '2026-10-02T00:10:00Z')).toBe(0);
  });
});
