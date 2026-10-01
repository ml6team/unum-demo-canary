import { describe, expect, it } from 'vitest';
import flags from '../data/flags.json';
import metrics from '../data/metrics.json';
import users from '../data/users.json';
import { compareGroups } from './metrics';

describe('fixtures', () => {
  it('has metrics for every flag', () => {
    const metricKeys = Object.keys(metrics.flags).sort();
    expect(metricKeys).toEqual(flags.map((f) => f.key).sort());
  });

  it('never has more errors than requests', () => {
    for (const m of Object.values(metrics.flags)) {
      expect(m.canary.errors).toBeLessThanOrEqual(m.canary.requests);
      expect(m.baseline.errors).toBeLessThanOrEqual(m.baseline.requests);
    }
  });

  it('has 100 unique users', () => {
    expect(new Set(users.map((u) => u.id)).size).toBe(100);
  });

  it('AC3: only search-v2 has a canary at risk', () => {
    const atRisk = Object.entries(metrics.flags)
      .filter(([, m]) => compareGroups(m).canaryAtRisk)
      .map(([key]) => key);
    expect(atRisk).toEqual(['search-v2']);
  });
});
