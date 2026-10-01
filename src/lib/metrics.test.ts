import { describe, expect, it } from 'vitest';
import {
  COMPARISON_THRESHOLD,
  combined,
  compareGroups,
  DEGRADED_THRESHOLD,
  EMPTY_METRICS,
  errorRate,
  health,
} from './metrics';

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

describe('compareGroups', () => {
  it('AC2: flags search-v2 counts as canary worse', () => {
    const result = compareGroups({
      canary: { requests: 6120, errors: 98 },
      baseline: { requests: 118430, errors: 437 },
    });
    expect(result.verdict).toBe('canary-worse');
    expect(result.delta).toBeCloseTo(0.0123, 4);
  });

  it('AC2: flags a canary clearly below baseline as canary better', () => {
    const result = compareGroups({
      canary: { requests: 1000, errors: 5 },
      baseline: { requests: 1000, errors: 50 },
    });
    expect(result.verdict).toBe('canary-better');
    expect(result.delta).toBeCloseTo(-0.045, 6);
  });

  it('AC2: treats a difference under the threshold as similar', () => {
    const result = compareGroups({
      canary: { requests: 1840, errors: 6 },
      baseline: { requests: 35210, errors: 112 },
    });
    expect(result.verdict).toBe('similar');
  });

  it('AC2: treats a difference exactly at the threshold as canary worse', () => {
    const result = compareGroups({
      canary: { requests: 1000, errors: 5 },
      baseline: { requests: 1000, errors: 0 },
    });
    expect(result.delta).toBe(COMPARISON_THRESHOLD);
    expect(result.verdict).toBe('canary-worse');
  });

  it('AC2: treats a difference exactly at minus the threshold as canary better', () => {
    const result = compareGroups({
      canary: { requests: 1000, errors: 0 },
      baseline: { requests: 1000, errors: 5 },
    });
    expect(result.delta).toBe(-COMPARISON_THRESHOLD);
    expect(result.verdict).toBe('canary-better');
  });

  it('AC2: is similar when both groups have no errors', () => {
    const result = compareGroups({
      canary: { requests: 100, errors: 0 },
      baseline: { requests: 100, errors: 0 },
    });
    expect(result.verdict).toBe('similar');
    expect(result.delta).toBe(0);
  });

  it('AC3: reports no data when the canary has no requests', () => {
    const result = compareGroups({
      canary: { requests: 0, errors: 0 },
      baseline: { requests: 500, errors: 5 },
    });
    expect(result.verdict).toBe('no-data');
    expect(result.delta).toBeNull();
    expect(result.canary).toBeNull();
  });

  it('AC3: reports no data when the baseline has no requests', () => {
    const result = compareGroups({
      canary: { requests: 500, errors: 5 },
      baseline: { requests: 0, errors: 0 },
    });
    expect(result.verdict).toBe('no-data');
    expect(result.delta).toBeNull();
    expect(result.baseline).toBeNull();
  });

  it('AC3: reports no data for empty metrics', () => {
    const result = compareGroups(EMPTY_METRICS);
    expect(result.verdict).toBe('no-data');
    expect(result.delta).toBeNull();
  });

  it('AC1: returns the error rate of each group', () => {
    const metrics = {
      canary: { requests: 6120, errors: 98 },
      baseline: { requests: 118430, errors: 437 },
    };
    const result = compareGroups(metrics);
    expect(result.canary).toBe(errorRate(metrics.canary));
    expect(result.baseline).toBe(errorRate(metrics.baseline));
  });
});
