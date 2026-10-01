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

  it('AC2, AC4: marks only search-v2 as canary worse', () => {
    const worse = Object.entries(metrics.flags)
      .filter(([, m]) => compareGroups(m).verdict === 'canary-worse')
      .map(([key]) => key);
    expect(worse).toEqual(['search-v2']);
  });

  it('AC2: treats the other flags with traffic as similar', () => {
    for (const key of ['new-checkout', 'dark-mode', 'async-export']) {
      expect(compareGroups(metrics.flags[key as keyof typeof metrics.flags]).verdict).toBe(
        'similar',
      );
    }
  });

  it('AC3: has no data for flags without traffic in a group', () => {
    for (const [key, m] of Object.entries(metrics.flags)) {
      if (m.canary.requests === 0 || m.baseline.requests === 0) {
        const result = compareGroups(m);
        expect(result.verdict, key).toBe('no-data');
        expect(result.delta, key).toBeNull();
      }
    }
  });
});
