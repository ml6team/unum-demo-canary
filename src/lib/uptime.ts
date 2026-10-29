import { HISTORY_DAYS, historyStart, pastIncidents } from './incidents';
import { worstStatus } from './status';
import { addUtcDays, DAY_MS, MINUTE_MS, utcDayKey } from './time';
import type { Incident, ServiceStatus } from './types';

export interface UptimeDay {
  /** UTC calendar day, YYYY-MM-DD. */
  day: string;
  /** Worst non-maintenance impact affecting this service on this day, or 'operational'. */
  status: ServiceStatus;
  /** Non-maintenance incidents that contribute to the status. Empty when operational. */
  incidents: Incident[];
}

/**
 * Returns incidents that overlap the history window, including any that started before it
 * but end inside it. `pastIncidents` only returns incidents whose `startedAt` falls within
 * the window; this helper adds the pre-window ones so their overlap can be clamped.
 */
function windowIncidents(incidents: Incident[], now: Date, days: number): Incident[] {
  const windowStartMs = historyStart(now, days).getTime();
  const windowEndMs = now.getTime();

  // Pre-window incidents: started before the window but end inside it.
  const preWindow = incidents.filter((i) => {
    const startMs = Date.parse(i.startedAt);
    if (startMs >= windowStartMs) return false; // handled by pastIncidents
    const endMs = i.resolvedAt != null ? Date.parse(i.resolvedAt) : windowEndMs;
    return endMs > windowStartMs; // overlaps the window
  });

  return [...pastIncidents(incidents, now, days), ...preWindow];
}

/**
 * Returns one UptimeDay per calendar day in the history window, oldest first.
 * The array length equals `days` (defaults to 90).
 * Maintenance incidents are excluded: they never colour a day.
 * An incident spanning midnight appears on every day it overlaps within the window.
 * Incidents that started before the window are clamped to their overlap.
 */
export function serviceUptimeHistory(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): UptimeDay[] {
  const windowStart = historyStart(now, days);
  const windowStartMs = windowStart.getTime();
  const windowEndMs = now.getTime();

  // Collect non-maintenance incidents that overlap the window for this service.
  const relevant = windowIncidents(incidents, now, days).filter(
    (i) => i.kind !== 'maintenance' && i.affectedServiceIds.includes(serviceId),
  );

  // Map each calendar day key to the incidents that overlap it.
  const dayMap = new Map<string, Incident[]>();

  for (const inc of relevant) {
    const incStartMs = Date.parse(inc.startedAt);
    const incEndMs = inc.resolvedAt != null ? Date.parse(inc.resolvedAt) : windowEndMs;

    // Clamp to window boundaries.
    const effStartMs = Math.max(incStartMs, windowStartMs);
    const effEndMs = Math.min(incEndMs, windowEndMs);
    if (effEndMs <= effStartMs) continue;

    // Find the first and last UTC day the incident overlaps.
    // Start of the UTC day containing effStartMs.
    const firstDayMs = effStartMs - (effStartMs % DAY_MS);
    // Last overlapping day: the day that contains the last moment of the incident.
    // effEndMs is exclusive; the last overlapped moment is effEndMs - 1ms.
    const lastDayMs = effEndMs - 1 - ((effEndMs - 1) % DAY_MS);

    let dayMs = firstDayMs;
    while (dayMs <= lastDayMs) {
      const key = utcDayKey(new Date(dayMs));
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.push(inc);
      } else {
        dayMap.set(key, [inc]);
      }
      dayMs += DAY_MS;
    }
  }

  // Build the result array, one entry per calendar day, oldest first.
  const result: UptimeDay[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = addUtcDays(windowStart, i);
    const key = utcDayKey(dayStart);
    const dayIncidents = dayMap.get(key) ?? [];
    const status = worstStatus(dayIncidents.map((inc) => inc.impact));
    result.push({ day: key, status, incidents: dayIncidents });
  }

  return result;
}

/**
 * Returns the uptime percentage (0–100, one decimal) over the history window.
 * Only partial-outage and major-outage minutes count as downtime.
 * Maintenance incidents are excluded. Incident overlap with the window is clamped,
 * including incidents that started before the window but end inside it.
 */
export function uptimePercent(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): number {
  const windowStart = historyStart(now, days);
  const windowStartMs = windowStart.getTime();
  const windowEndMs = now.getTime();
  const totalMinutes = (windowEndMs - windowStartMs) / MINUTE_MS;

  const downtimeImpacts = new Set(['partial-outage', 'major-outage']);

  const relevant = windowIncidents(incidents, now, days).filter(
    (i) =>
      i.kind !== 'maintenance' &&
      i.affectedServiceIds.includes(serviceId) &&
      downtimeImpacts.has(i.impact),
  );

  let downtimeMinutes = 0;
  for (const inc of relevant) {
    const incStartMs = Date.parse(inc.startedAt);
    const incEndMs = inc.resolvedAt != null ? Date.parse(inc.resolvedAt) : windowEndMs;

    const effStartMs = Math.max(incStartMs, windowStartMs);
    const effEndMs = Math.min(incEndMs, windowEndMs);
    if (effEndMs > effStartMs) {
      downtimeMinutes += (effEndMs - effStartMs) / MINUTE_MS;
    }
  }

  return Math.round(((totalMinutes - downtimeMinutes) / totalMinutes) * 1000) / 10;
}
