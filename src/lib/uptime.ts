import { formatDay } from './format';
import { HISTORY_DAYS, historyStart } from './incidents';
import { STATUS_LABEL, worstStatus } from './status';
import { addUtcDays, DAY_MS, utcDayKey } from './time';
import type { Incident, ServiceUptime, UptimeDay } from './types';

interface Span {
  incident: Incident;
  start: number;
  end: number;
}

/** The half-open interval [startedAt, min(resolvedAt ?? now, now)) of an incident on a service. */
function incidentSpans(serviceId: string, incidents: Incident[], now: Date): Span[] {
  const spans: Span[] = [];
  for (const incident of incidents) {
    if (incident.kind !== 'incident' || !incident.affectedServiceIds.includes(serviceId)) continue;
    const start = Date.parse(incident.startedAt);
    const end = Math.min(
      incident.resolvedAt === null ? now.getTime() : Date.parse(incident.resolvedAt),
      now.getTime(),
    );
    if (start >= now.getTime() || end <= start) continue;
    spans.push({ incident, start, end });
  }
  return spans;
}

/** Milliseconds covered by at least one span, clipped to [from, to). */
function unionDuration(spans: Span[], from: number, to: number): number {
  const clipped = spans
    .map((s) => [Math.max(s.start, from), Math.min(s.end, to)] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let coveredUntil = from;
  for (const [start, end] of clipped) {
    const begin = Math.max(start, coveredUntil);
    if (end > begin) total += end - begin;
    coveredUntil = Math.max(coveredUntil, end);
  }
  return total;
}

/** The daily status and the uptime percentage of a service over the `days` days ending at `now`. */
export function serviceUptime(
  serviceId: string,
  incidents: Incident[],
  now: Date,
  days = HISTORY_DAYS,
): ServiceUptime {
  const spans = incidentSpans(serviceId, incidents, now);
  const windowStart = historyStart(now, days);

  const series: UptimeDay[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = addUtcDays(windowStart, i).getTime();
    const dayEnd = dayStart + DAY_MS;
    const marking = spans
      .filter((s) => s.start < dayEnd && s.end > dayStart)
      .map((s) => s.incident);
    series.push({
      day: utcDayKey(new Date(dayStart)),
      status: worstStatus(marking.map((incident) => incident.impact)),
      incidentIds: marking.map((incident) => incident.id),
    });
  }

  const window = now.getTime() - windowStart.getTime();
  const downtime = unionDuration(spans, windowStart.getTime(), now.getTime());
  const uptimePercent = Math.floor((1 - downtime / window) * 10000) / 100;
  return { days: series, uptimePercent };
}

/** "Sep 10, 2026: Partial outage", or "Sep 10, 2026: No incidents" for a day without any. */
export function uptimeDayLabel(day: UptimeDay): string {
  const text = day.status === 'operational' ? 'No incidents' : STATUS_LABEL[day.status];
  return `${formatDay(day.day)}: ${text}`;
}
