import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, formatPoints, formatRate } from './format';

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

describe('formatPoints', () => {
  it('AC2: renders a positive difference with a plus sign and two decimals', () => {
    expect(formatPoints(0.012312)).toBe('+1.23 pts');
  });

  it('AC2: renders a negative difference with a minus sign', () => {
    expect(formatPoints(-0.005)).toBe('-0.50 pts');
  });

  it('AC2: renders zero with a plus sign', () => {
    expect(formatPoints(0)).toBe('+0.00 pts');
  });

  it('AC3: renders a dash for an unknown difference', () => {
    expect(formatPoints(null)).toBe('-');
  });
});
