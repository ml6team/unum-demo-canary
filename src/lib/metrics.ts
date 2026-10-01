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
