import { describe, expect, it } from 'vitest';
import { combined, compareGroups, DEGRADED_THRESHOLD, errorRate, health } from './metrics';

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
  const searchV2 = {
    canary: { requests: 6120, errors: 98 },
    baseline: { requests: 118430, errors: 437 },
  };

  it('AC1: reports counts, rate and health for each group', () => {
    const result = compareGroups({
      canary: { requests: 200, errors: 4 },
      baseline: { requests: 1000, errors: 2 },
    });
    expect(result.canary).toEqual({
      counts: { requests: 200, errors: 4 },
      rate: errorRate({ requests: 200, errors: 4 }),
      health: 'degraded',
    });
    expect(result.baseline).toEqual({
      counts: { requests: 1000, errors: 2 },
      rate: errorRate({ requests: 1000, errors: 2 }),
      health: 'healthy',
    });
  });

  it('AC1: marks a group without requests as no-traffic', () => {
    const result = compareGroups({
      canary: { requests: 0, errors: 0 },
      baseline: { requests: 100, errors: 0 },
    });
    expect(result.canary.rate).toBeNull();
    expect(result.canary.health).toBe('no-traffic');
  });

  it('AC2: delta is canary rate minus baseline rate when canary is higher', () => {
    const result = compareGroups({
      canary: { requests: 100, errors: 3 },
      baseline: { requests: 1000, errors: 10 },
    });
    expect(result.delta).toBeCloseTo(0.02);
  });

  it('AC2: delta is negative when canary is lower than baseline', () => {
    const result = compareGroups({
      canary: { requests: 100, errors: 1 },
      baseline: { requests: 1000, errors: 50 },
    });
    expect(result.delta).toBeCloseTo(-0.04);
  });

  it('AC2: delta is null when the canary group has no traffic', () => {
    const result = compareGroups({
      canary: { requests: 0, errors: 0 },
      baseline: { requests: 100, errors: 1 },
    });
    expect(result.delta).toBeNull();
  });

  it('AC2: delta is null when the baseline group has no traffic', () => {
    const result = compareGroups({
      canary: { requests: 100, errors: 1 },
      baseline: { requests: 0, errors: 0 },
    });
    expect(result.delta).toBeNull();
  });

  it('AC3: canary is at risk when it is at the threshold and baseline is below it', () => {
    const result = compareGroups({
      canary: { requests: 100, errors: DEGRADED_THRESHOLD * 100 },
      baseline: { requests: 1000, errors: 1 },
    });
    expect(result.canaryAtRisk).toBe(true);
  });

  it('AC3: canary is not at risk when both groups are degraded', () => {
    const result = compareGroups({
      canary: { requests: 100, errors: 5 },
      baseline: { requests: 100, errors: 4 },
    });
    expect(result.canaryAtRisk).toBe(false);
  });

  it('AC3: canary is not at risk when only the baseline is degraded', () => {
    const result = compareGroups({
      canary: { requests: 100, errors: 0 },
      baseline: { requests: 100, errors: 5 },
    });
    expect(result.canaryAtRisk).toBe(false);
  });

  it('AC3: canary is not at risk when the canary group has no traffic', () => {
    const result = compareGroups({
      canary: { requests: 0, errors: 0 },
      baseline: { requests: 100, errors: 0 },
    });
    expect(result.canaryAtRisk).toBe(false);
  });

  it('AC3: search-v2 is healthy combined but its canary is at risk', () => {
    expect(health(errorRate(combined(searchV2)))).toBe('healthy');
    expect(compareGroups(searchV2).canaryAtRisk).toBe(true);
  });
});
