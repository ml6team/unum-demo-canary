import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  formatDay,
  formatDuration,
  formatIncidentDuration,
  formatRange,
  formatTime,
  formatUptime,
} from './format';
import { HOUR_MS, MINUTE_MS } from './time';

describe('formatDay', () => {
  it('renders a day key without shifting by timezone', () => {
    expect(formatDay('2026-08-12')).toBe('Aug 12, 2026');
    expect(formatDay('2026-10-01')).toBe('Oct 1, 2026');
  });
});

describe('formatTime', () => {
  it('renders 24-hour UTC time', () => {
    expect(formatTime('2026-09-10T22:40:00Z')).toBe('22:40');
    expect(formatTime('2026-09-11T01:05:00Z')).toBe('01:05');
  });
});

describe('formatDateTime', () => {
  it('renders month, day and UTC time', () => {
    expect(formatDateTime('2026-10-01T12:00:00Z')).toBe('Oct 1, 12:00 UTC');
  });
});

describe('formatRange', () => {
  it('omits the end date within one day', () => {
    expect(formatRange('2026-09-08T14:05:00Z', '2026-09-08T15:20:00Z')).toBe(
      'Sep 8, 14:05 – 15:20 UTC',
    );
  });

  it('repeats the date across midnight', () => {
    expect(formatRange('2026-09-10T22:40:00Z', '2026-09-11T01:15:00Z')).toBe(
      'Sep 10, 22:40 – Sep 11, 01:15 UTC',
    );
  });

  it('describes an ongoing range', () => {
    expect(formatRange('2026-10-01T11:00:00Z', null)).toBe('Since Oct 1, 11:00 UTC');
  });
});

describe('formatDuration', () => {
  it('renders minutes under an hour', () => {
    expect(formatDuration(45 * MINUTE_MS)).toBe('45m');
  });

  it('renders hours and minutes', () => {
    expect(formatDuration(2 * HOUR_MS + 35 * MINUTE_MS)).toBe('2h 35m');
  });

  it('drops zero minutes', () => {
    expect(formatDuration(3 * HOUR_MS)).toBe('3h');
  });

  it('rounds to the minute and never shows zero', () => {
    expect(formatDuration(59.6 * MINUTE_MS)).toBe('1h');
    expect(formatDuration(10_000)).toBe('1m');
  });
});

describe('formatIncidentDuration', () => {
  it('measures between two instants', () => {
    expect(formatIncidentDuration('2026-08-19T13:02:00Z', '2026-08-19T16:08:00Z')).toBe('3h 6m');
  });
});

describe('formatUptime', () => {
  it('AC3: shows 100% only for exactly 100', () => {
    expect(formatUptime(100)).toBe('100%');
  });

  it('AC3: shows two decimals otherwise', () => {
    expect(formatUptime(99.98)).toBe('99.98%');
    expect(formatUptime(99.9)).toBe('99.90%');
  });
});
