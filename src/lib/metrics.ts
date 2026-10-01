import type { Counts, FlagMetrics } from './types';

export type Health = 'healthy' | 'degraded' | 'no-traffic';

/** Error rates at or above this fraction count as degraded. */
export const DEGRADED_THRESHOLD = 0.01;

export const EMPTY_METRICS: FlagMetrics = {
  canary: { requests: 0, errors: 0 },
  baseline: { requests: 0, errors: 0 },
};

/** Fraction in [0, 1], or null when there were no requests. */
export function errorRate(counts: Counts): number | null {
  return counts.requests === 0 ? null : counts.errors / counts.requests;
}

export function combined(metrics: FlagMetrics): Counts {
  return {
    requests: metrics.canary.requests + metrics.baseline.requests,
    errors: metrics.canary.errors + metrics.baseline.errors,
  };
}

export function health(rate: number | null): Health {
  if (rate === null) return 'no-traffic';
  return rate >= DEGRADED_THRESHOLD ? 'degraded' : 'healthy';
}

export interface GroupStats {
  counts: Counts;
  rate: number | null;
  health: Health;
}

export interface GroupComparison {
  canary: GroupStats;
  baseline: GroupStats;
  /** Canary rate minus baseline rate, as a fraction; null when either group has no traffic. */
  delta: number | null;
  /** The canary group is degraded and the baseline group is not. */
  canaryAtRisk: boolean;
}

function groupStats(counts: Counts): GroupStats {
  const rate = errorRate(counts);
  return { counts, rate, health: health(rate) };
}

export function compareGroups(metrics: FlagMetrics): GroupComparison {
  const canary = groupStats(metrics.canary);
  const baseline = groupStats(metrics.baseline);
  return {
    canary,
    baseline,
    delta: canary.rate === null || baseline.rate === null ? null : canary.rate - baseline.rate,
    canaryAtRisk: canary.health === 'degraded' && baseline.health !== 'degraded',
  };
}
