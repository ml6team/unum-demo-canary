import { HISTORY_DAYS, historyStart, incidentState } from './incidents';
import { worstStatus } from './status';
import { addUtcDays, MINUTE_MS, utcDayKey } from './time';
import type { Incident, ServiceStatus } from './types';

export interface UptimeDay {
  /** The UTC day, as YYYY-MM-DD. */
  day: string;
  /** The worst impact of the incidents that touch the day; operational when there are none. */
  status: ServiceStatus;
  /** Incidents that touch the day, oldest first. Maintenance is not included. */
  incidents: Incident[];
}

export interface UptimeHistory {
  /** One entry per UTC day, oldest first, the last being the day of `now`. */
  days: UptimeDay[];
  /** Unrounded percentage of up time from the start of the first day to `now`. */
  uptimePercent: number;
}

type Interval = [start: number, end: number];

function intervalOf(incident: Incident, now: Date): Interval {
  const end = incident.resolvedAt === null ? now.getTime() : Date.parse(incident.resolvedAt);
  return [Date.parse(incident.startedAt), Math.min(end, now.getTime())];
}

/** Total length of the union of the intervals, so overlapping outages count once. */
function unionLength(intervals: Interval[]): number {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: Interval | undefined;
  for (const [start, end] of sorted) {
    if (current && start <= current[1]) {
      current[1] = Math.max(current[1], end);
    } else {
      if (current) total += current[1] - current[0];
      current = [start, end];
    }
  }
  if (current) total += current[1] - current[0];
  return total;
}

/**
 * Day colours and uptime of one service over the `days` UTC days that end on the day of `now`.
 * Only incidents count, not maintenance. The percentage covers the time from the start of the
 * first day up to `now`, and only partial and major outages are downtime.
 */
export function uptimeHistory(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): UptimeHistory {
  const from = historyStart(now, days);
  const windowStart = from.getTime();
  const windowEnd = now.getTime();

  const relevant = incidents
    .filter(
      (i) =>
        i.kind === 'incident' &&
        i.affectedServiceIds.includes(serviceId) &&
        incidentState(i, now) !== 'upcoming',
    )
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));

  const byDay = new Map<string, Incident[]>();
  const downtime: Interval[] = [];
  for (const incident of relevant) {
    const [start, end] = intervalOf(incident, now);
    if (end < windowStart) continue;
    const lastDay = utcDayKey(new Date(Math.max(start, end - 1)));
    for (let day = utcDayKey(new Date(Math.max(start, windowStart))); ; ) {
      const list = byDay.get(day);
      if (list) list.push(incident);
      else byDay.set(day, [incident]);
      if (day >= lastDay) break;
      day = utcDayKey(addUtcDays(`${day}T00:00:00Z`, 1));
    }
    if (incident.impact === 'partial-outage' || incident.impact === 'major-outage') {
      downtime.push([Math.max(start, windowStart), end]);
    }
  }

  const result: UptimeDay[] = [];
  for (let n = 0; n < days; n++) {
    const day = utcDayKey(addUtcDays(from, n));
    const list = byDay.get(day) ?? [];
    result.push({ day, status: worstStatus(list.map((i) => i.impact)), incidents: list });
  }

  const downMinutes = unionLength(downtime) / MINUTE_MS;
  const windowMinutes = (windowEnd - windowStart) / MINUTE_MS;
  return { days: result, uptimePercent: 100 - (downMinutes / windowMinutes) * 100 };
}
