import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, formatRate, formatRateDelta } from './format';

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(124550)).toBe('124,550');
  });
});

describe('formatRate', () => {
  it('renders a fraction as a percentage with two decimals', () => {
    expect(formatRate(0.01234)).toBe('1.23%');
  });

  it('renders zero', () => {
    expect(formatRate(0)).toBe('0.00%');
  });

  it('renders a dash for an unknown rate', () => {
    expect(formatRate(null)).toBe('-');
  });
});

describe('formatDate', () => {
  it('renders an ISO date without shifting by timezone', () => {
    expect(formatDate('2026-08-12')).toBe('Aug 12, 2026');
  });
});

describe('formatRateDelta', () => {
  it('AC2: prefixes a positive difference with + and shows percentage points', () => {
    expect(formatRateDelta(0.0123)).toBe('+1.23 pp');
  });

  it('AC2: shows a negative difference with -', () => {
    expect(formatRateDelta(-0.004)).toBe('-0.40 pp');
  });

  it('AC2: renders zero without a sign', () => {
    expect(formatRateDelta(0)).toBe('0.00 pp');
  });

  it('AC2: renders a dash for an unknown difference', () => {
    expect(formatRateDelta(null)).toBe('-');
  });
});
