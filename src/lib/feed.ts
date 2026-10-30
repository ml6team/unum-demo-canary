import { formatRange } from './format';
import { affectedServiceNames, pastIncidents } from './incidents';
import type { Impact, Incident, Service } from './types';

const IMPACT_LABEL: Record<Impact, string> = {
  degraded: 'Degraded performance',
  'partial-outage': 'Partial outage',
  'major-outage': 'Major outage',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function categoryTerm(incident: Incident): string {
  return incident.kind === 'maintenance' ? 'Maintenance' : IMPACT_LABEL[incident.impact];
}

function entryUpdated(incident: Incident): string {
  return incident.resolvedAt ?? incident.startedAt;
}

function buildEntry(incident: Incident, services: Service[], pageUrl: string): string {
  const serviceNames = affectedServiceNames(incident, services);
  const timeRange = formatRange(incident.startedAt, incident.resolvedAt);
  const summary = serviceNames.length > 0 ? `${serviceNames.join(', ')} · ${timeRange}` : timeRange;

  return [
    '  <entry>',
    `    <title>${escapeXml(incident.title)}</title>`,
    `    <id>urn:northwind:incident:${escapeXml(incident.id)}</id>`,
    `    <updated>${entryUpdated(incident)}</updated>`,
    `    <link rel="alternate" href="${escapeXml(pageUrl)}"/>`,
    `    <category term="${escapeXml(categoryTerm(incident))}"/>`,
    `    <summary>${escapeXml(summary)}</summary>`,
    '  </entry>',
  ].join('\n');
}

/**
 * Builds a valid Atom 1.0 feed string from the given incidents, services, and
 * current time. Returns all incidents from the last 90 days, newest first.
 *
 * @param incidents - all incidents (past, active, upcoming)
 * @param services  - service list used to resolve service names
 * @param now       - current time reference (use NOW from src/data)
 * @param pageUrl   - absolute URL of the status page, with trailing slash
 */
export function buildAtomFeed(
  incidents: Incident[],
  services: Service[],
  now: Date,
  pageUrl: string,
): string {
  const past = pastIncidents(incidents, now);
  const newest = past[0];
  const feedUpdated = newest !== undefined ? entryUpdated(newest) : now.toISOString();
  const feedId = `${pageUrl}feed.xml`;

  const entries = past.map((inc) => buildEntry(inc, services, pageUrl)).join('\n');

  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '  <title>Northwind status</title>',
    `  <id>${escapeXml(feedId)}</id>`,
    `  <updated>${feedUpdated}</updated>`,
    `  <link rel="self" href="${escapeXml(feedId)}"/>`,
    `  <link rel="alternate" href="${escapeXml(pageUrl)}"/>`,
    '  <generator>northwind-status</generator>',
  ];

  if (entries) {
    lines.push(entries);
  }

  lines.push('</feed>');

  return lines.join('\n');
}
