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

export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Signed difference in percentage points, "+1.23 pts"; "-" for null. */
export function formatPoints(delta: number | null): string {
  if (delta === null) return '-';
  const points = (delta * 100).toFixed(2);
  return `${delta < 0 ? '' : '+'}${points} pts`;
}
