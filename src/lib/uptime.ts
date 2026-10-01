import { HISTORY_DAYS, historyStart } from './incidents';
import { worstStatus } from './status';
import { addUtcDays, DAY_MS, utcDayKey } from './time';
import type { Incident, ServiceStatus } from './types';

/** 'operational' means no incident that day; 'maintenance' means only planned maintenance. */
export type DayTone = ServiceStatus | 'maintenance';

export interface UptimeDay {
  day: string;
  tone: DayTone;
  /** Incidents and maintenance that overlap the day, for the hover text. */
  incidentIds: string[];
}

/** The service's incidents and maintenance that have started, with their end clipped to `now`. */
function serviceIntervals(serviceId: string, incidents: Incident[], now: Date) {
  const nowMs = now.getTime();
  return incidents
    .filter((i) => i.affectedServiceIds.includes(serviceId))
    .map((incident) => ({
      incident,
      start: Date.parse(incident.startedAt),
      end: Math.min(incident.resolvedAt === null ? nowMs : Date.parse(incident.resolvedAt), nowMs),
    }))
    .filter(({ start }) => start <= nowMs);
}

/** `days` UTC days ending on the day of `now`, oldest first. Today is the last entry. */
export function serviceDays(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): UptimeDay[] {
  const intervals = serviceIntervals(serviceId, incidents, now);
  const first = historyStart(now, days);
  return Array.from({ length: days }, (_, index) => {
    const dayStart = addUtcDays(first, index);
    const from = dayStart.getTime();
    const to = from + DAY_MS;
    const overlapping = intervals.filter(({ start, end }) => start < to && end > from);
    const real = overlapping.filter(({ incident }) => incident.kind === 'incident');
    const hasMaintenance = overlapping.length > real.length;
    const worst = worstStatus(real.map(({ incident }) => incident.impact));
    const tone: DayTone = real.length > 0 ? worst : hasMaintenance ? 'maintenance' : 'operational';
    return {
      day: utcDayKey(dayStart),
      tone,
      incidentIds: overlapping.map(({ incident }) => incident.id),
    };
  });
}

export interface ServiceUptime {
  /** 0 to 100, truncated to 2 decimals; 100 only when downtimeMs is 0. */
  percent: number;
  downtimeMs: number;
  windowMs: number;
}

/** Share of the window, from the first day's start to `now`, outside the service's incidents. */
export function serviceUptime(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): ServiceUptime {
  const windowStart = historyStart(now, days).getTime();
  const windowMs = now.getTime() - windowStart;
  const clipped = serviceIntervals(serviceId, incidents, now)
    .filter(({ incident }) => incident.kind === 'incident')
    .map(({ start, end }) => ({ start: Math.max(start, windowStart), end }))
    .filter(({ start, end }) => end > start)
    .sort((a, b) => a.start - b.start);

  let downtimeMs = 0;
  let coveredUntil = windowStart;
  for (const { start, end } of clipped) {
    const from = Math.max(start, coveredUntil);
    if (end > from) downtimeMs += end - from;
    coveredUntil = Math.max(coveredUntil, end);
  }

  const percent = Math.floor((1 - downtimeMs / windowMs) * 10000) / 100;
  return { percent: downtimeMs > 0 ? Math.min(percent, 99.99) : percent, downtimeMs, windowMs };
}
