import { describe, expect, it } from 'vitest';
import { combined, DEGRADED_THRESHOLD, errorRate, health } from './metrics';

describe('errorRate', () => {
  it('divides errors by requests', () => {
    expect(errorRate({ requests: 200, errors: 3 })).toBeCloseTo(0.015);
  });

  it('returns 0 when there are requests but no errors', () => {
    expect(errorRate({ requests: 50, errors: 0 })).toBe(0);
  });

  it('returns null when there are no requests', () => {
    expect(errorRate({ requests: 0, errors: 0 })).toBeNull();
  });
});

describe('combined', () => {
  it('sums canary and baseline counts', () => {
    expect(
      combined({
        canary: { requests: 100, errors: 4 },
        baseline: { requests: 900, errors: 6 },
      }),
    ).toEqual({ requests: 1000, errors: 10 });
  });
});

describe('health', () => {
  it('is healthy below the threshold', () => {
    expect(health(DEGRADED_THRESHOLD - 0.0001)).toBe('healthy');
  });

  it('is degraded at the threshold', () => {
    expect(health(DEGRADED_THRESHOLD)).toBe('degraded');
  });

  it('is degraded above the threshold', () => {
    expect(health(0.2)).toBe('degraded');
  });

  it('reports no traffic when the rate is unknown', () => {
    expect(health(null)).toBe('no-traffic');
  });
});
