import { formatRange } from './format';
import { affectedServiceNames, pastIncidents, updatesNewestFirst } from './incidents';
import { STATUS_LABEL } from './status';
import type { Incident, Service } from './types';

const FEED_TITLE = 'Northwind status';
const FEED_AUTHOR = 'Northwind';
const FEED_ID = 'tag:ml6team.github.io,2026:unum-demo-canary';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc3339(iso: string): string {
  return new Date(iso).toISOString();
}

function entry(incident: Incident, services: Service[], siteUrl: string): string {
  const maintenance = incident.kind === 'maintenance';
  const label = maintenance ? 'Maintenance' : STATUS_LABEL[incident.impact];
  const term = maintenance ? 'maintenance' : incident.impact;
  const names = affectedServiceNames(incident, services).join(', ');
  const summary = [
    label,
    `Affects: ${names}`,
    formatRange(incident.startedAt, incident.resolvedAt),
  ];
  const newest = updatesNewestFirst(incident)[0];
  const updated = newest ? newest.at : incident.startedAt;
  return [
    '  <entry>',
    `    <id>${escapeXml(`${FEED_ID}:incident:${incident.id}`)}</id>`,
    `    <title>${escapeXml(incident.title)}</title>`,
    `    <link href="${escapeXml(`${siteUrl}#history`)}" rel="alternate"/>`,
    `    <published>${rfc3339(incident.startedAt)}</published>`,
    `    <updated>${rfc3339(updated)}</updated>`,
    `    <category term="${term}" label="${label}"/>`,
    `    <summary type="text">${escapeXml(summary.join('\n'))}</summary>`,
    '  </entry>',
  ].join('\n');
}

/** An Atom 1.0 feed of the incidents and maintenance that the page lists as past incidents. */
export function buildAtomFeed(
  incidents: Incident[],
  services: Service[],
  now: Date,
  siteUrl: string,
): string {
  const entries = pastIncidents(incidents, now).map((i) => entry(i, services, siteUrl));
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${FEED_ID}</id>`,
    `  <title>${FEED_TITLE}</title>`,
    `  <updated>${now.toISOString()}</updated>`,
    `  <author><name>${FEED_AUTHOR}</name></author>`,
    `  <link rel="alternate" href="${escapeXml(siteUrl)}"/>`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(`${siteUrl}feed.xml`)}"/>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n');
}
