import { DAY_MS, durationMs, HOUR_MS, MINUTE_MS } from './time';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function monthDay(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** "Sep 10, 2026" for a YYYY-MM-DD day key. */
export function formatDay(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  return `${monthDay(date)}, ${date.getUTCFullYear()}`;
}

/** "22:40" in UTC. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** "Sep 10, 22:40 UTC". */
export function formatDateTime(iso: string): string {
  return `${monthDay(new Date(iso))}, ${formatTime(iso)} UTC`;
}

/** "Sep 10, 14:05 – 15:20 UTC", repeating the date only when the range crosses midnight. */
export function formatRange(start: string, end: string | null): string {
  const startDate = new Date(start);
  const from = `${monthDay(startDate)}, ${formatTime(start)}`;
  if (end === null) return `Since ${from} UTC`;
  const sameDay = start.slice(0, 10) === new Date(end).toISOString().slice(0, 10);
  const to = sameDay ? formatTime(end) : `${monthDay(new Date(end))}, ${formatTime(end)}`;
  return `${from} – ${to} UTC`;
}

/** "45m", "2h 35m", "3h", "1d 3h 10m", "2d"; rounds to the minute and never shows less than 1m. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  const days = Math.floor((minutes * MINUTE_MS) / DAY_MS);
  if (days > 0) {
    const remaining = minutes - days * 24 * 60;
    const hours = Math.floor(remaining / 60);
    const mins = remaining % 60;
    const parts: string[] = [`${days}d`];
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    return parts.join(' ');
  }
  const hours = Math.floor((minutes * MINUTE_MS) / HOUR_MS);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatIncidentDuration(start: string, end: string): string {
  return formatDuration(durationMs(start, end));
}
