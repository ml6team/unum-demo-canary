import { formatDay } from './format';
import { historyStart } from './incidents';
import { worstStatus } from './status';
import { addUtcDays, DAY_MS, utcDayKey } from './time';
import type { Incident, ServiceStatus } from './types';

export interface DayRecord {
  day: string; // 'YYYY-MM-DD', UTC
  status: ServiceStatus;
  incidents: Incident[]; // non-maintenance incidents affecting this service on this day
}

/**
 * Returns the tooltip text for a segment: the formatted date and a list of incident
 * titles, or "No incidents" when the incidents array is empty.
 */
export function formatTooltipText(day: string, incidents: Incident[]): string {
  const date = formatDay(day);
  if (incidents.length === 0) return 'No incidents';
  return `${date} · ${incidents.map((i) => i.title).join(', ')}`;
}

/**
 * Returns 90 DayRecord entries for a service, oldest first (index 0 = historyStart(now),
 * index 89 = the day of now). Maintenance incidents are excluded; a day with only
 * maintenance is "operational".
 */
export function uptimeDays(incidents: Incident[], serviceId: string, now: Date): DayRecord[] {
  const start = historyStart(now);
  const records: DayRecord[] = [];

  for (let i = 0; i < 90; i++) {
    const dayDate = addUtcDays(start, i);
    const day = utcDayKey(dayDate);

    const matching = incidents.filter(
      (inc) =>
        inc.kind !== 'maintenance' &&
        inc.affectedServiceIds.includes(serviceId) &&
        utcDayKey(inc.startedAt) === day,
    );

    const status = worstStatus(matching.map((inc) => inc.impact));
    records.push({ day, status, incidents: matching });
  }

  return records;
}

/**
 * Returns the 90-day uptime percentage for a service as a string like "99.8%".
 * Only partial-outage and major-outage minutes count as downtime. Maintenance
 * incidents are excluded. Incident durations are clamped to the 90-day window.
 */
export function uptimePercent(incidents: Incident[], serviceId: string, now: Date): string {
  const windowStart = historyStart(now).getTime();
  const windowEnd = windowStart + 90 * DAY_MS;
  const windowMs = 90 * DAY_MS;

  let downtimeMs = 0;

  for (const inc of incidents) {
    if (inc.kind === 'maintenance') continue;
    if (!inc.affectedServiceIds.includes(serviceId)) continue;
    if (inc.impact !== 'partial-outage' && inc.impact !== 'major-outage') continue;

    const incStart = Date.parse(inc.startedAt);
    const incEnd = inc.resolvedAt !== null ? Date.parse(inc.resolvedAt) : windowEnd;

    const clampedStart = Math.max(incStart, windowStart);
    const clampedEnd = Math.min(incEnd, windowEnd);

    if (clampedEnd > clampedStart) {
      downtimeMs += clampedEnd - clampedStart;
    }
  }

  const pct = (1 - downtimeMs / windowMs) * 100;
  return `${pct.toFixed(1)}%`;
}
