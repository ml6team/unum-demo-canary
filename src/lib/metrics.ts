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

export type Verdict = 'canary-worse' | 'canary-better' | 'similar' | 'no-data';

/** Canary error rate must differ from baseline by at least this fraction (0.005 = 0.5 points). */
export const COMPARISON_THRESHOLD = 0.005;

export interface GroupComparison {
  canary: number | null;
  baseline: number | null;
  /** Canary minus baseline, as a fraction; null when either rate is null. */
  delta: number | null;
  verdict: Verdict;
}

export function compareGroups(metrics: FlagMetrics): GroupComparison {
  const canary = errorRate(metrics.canary);
  const baseline = errorRate(metrics.baseline);
  if (canary === null || baseline === null) {
    return { canary, baseline, delta: null, verdict: 'no-data' };
  }
  const delta = canary - baseline;
  if (delta >= COMPARISON_THRESHOLD) return { canary, baseline, delta, verdict: 'canary-worse' };
  if (delta <= -COMPARISON_THRESHOLD) return { canary, baseline, delta, verdict: 'canary-better' };
  return { canary, baseline, delta, verdict: 'similar' };
}
