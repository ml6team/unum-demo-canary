const countFormat = new Intl.NumberFormat('en-US');
const dateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatCount(value: number): string {
  return countFormat.format(value);
}

export function formatRate(rate: number | null): string {
  return rate === null ? '-' : `${(rate * 100).toFixed(2)}%`;
}

/** Difference between two rates, in percentage points: "+1.23 pp", "-0.40 pp", "0.00 pp". */
export function formatRateDelta(delta: number | null): string {
  if (delta === null) return '-';
  return `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(2)} pp`;
}

export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}
