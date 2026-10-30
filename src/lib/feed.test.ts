import { describe, expect, it } from 'vitest';
// index.html is imported via Vite's ?raw suffix rather than readFileSync.
// The original failing-tests commit used readFileSync + __dirname, but
// __dirname is not available in Vitest's ESM environment and @types/node
// is not a project dependency. The ?raw import is the Vite-native
// equivalent and produces the same result: the raw file content as a string.
import indexHtmlRaw from '../../index.html?raw';
import { buildAtomFeed } from './feed';
import type { Incident, Service } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-10-01T12:00:00Z');

const SERVICES: Service[] = [
  { id: 'api', name: 'API', description: 'REST API', status: 'operational' },
  { id: 'web', name: 'Web app', description: 'Dashboard', status: 'operational' },
];

/** Incident within 90-day window, resolved, kind=incident, degraded */
const INC_RECENT: Incident = {
  id: 'inc-recent',
  kind: 'incident',
  title: 'API slowdown',
  impact: 'degraded',
  affectedServiceIds: ['api'],
  startedAt: '2026-09-20T10:00:00Z',
  resolvedAt: '2026-09-20T11:30:00Z',
  updates: [],
};

/** Older incident within window, resolved, kind=incident, major-outage */
const INC_OLDER: Incident = {
  id: 'inc-older',
  kind: 'incident',
  title: 'Web app outage',
  impact: 'major-outage',
  affectedServiceIds: ['web', 'api'],
  startedAt: '2026-07-15T08:00:00Z',
  resolvedAt: '2026-07-15T09:00:00Z',
  updates: [],
};

/** Incident older than 90 days – should not appear */
const INC_TOO_OLD: Incident = {
  id: 'inc-too-old',
  kind: 'incident',
  title: 'Very old incident',
  impact: 'degraded',
  affectedServiceIds: ['api'],
  startedAt: '2026-06-01T00:00:00Z',
  resolvedAt: '2026-06-01T01:00:00Z',
  updates: [],
};

/** Upcoming maintenance – should not appear (it is in the future) */
const INC_UPCOMING: Incident = {
  id: 'maint-upcoming',
  kind: 'maintenance',
  title: 'Upcoming database maintenance',
  impact: 'degraded',
  affectedServiceIds: ['api'],
  startedAt: '2026-10-15T22:00:00Z',
  resolvedAt: '2026-10-16T00:00:00Z',
  updates: [],
};

/** Past maintenance within window */
const INC_MAINT_PAST: Incident = {
  id: 'maint-past',
  kind: 'maintenance',
  title: 'Scheduled database maintenance',
  impact: 'degraded',
  affectedServiceIds: ['api'],
  startedAt: '2026-09-10T22:00:00Z',
  resolvedAt: '2026-09-11T00:00:00Z',
  updates: [],
};

const PAGE_URL = 'https://ml6team.github.io/unum-demo-canary/';

// ---------------------------------------------------------------------------
// AC1: Feed contents
// ---------------------------------------------------------------------------

describe('AC1: buildAtomFeed – feed entries', () => {
  it('AC1-a: returns one entry per past incident and maintenance, newest first', () => {
    const incidents = [INC_OLDER, INC_RECENT, INC_TOO_OLD, INC_UPCOMING, INC_MAINT_PAST];
    const xml = buildAtomFeed(incidents, SERVICES, NOW, PAGE_URL);

    // Should have exactly 3 entries: INC_RECENT, INC_MAINT_PAST, INC_OLDER
    const entryMatches = xml.match(/<entry>/g);
    expect(entryMatches).toHaveLength(3);

    // Newest first: INC_RECENT (Sep 20) > INC_MAINT_PAST (Sep 10) > INC_OLDER (Jul 15)
    const recentPos = xml.indexOf('inc-recent');
    const maintPos = xml.indexOf('maint-past');
    const olderPos = xml.indexOf('inc-older');
    expect(recentPos).toBeLessThan(maintPos);
    expect(maintPos).toBeLessThan(olderPos);
  });

  it('AC1-b: each entry contains title, impact category, affected service names, time range, and page link', () => {
    const xml = buildAtomFeed([INC_RECENT], SERVICES, NOW, PAGE_URL);

    expect(xml).toContain('<title>API slowdown</title>');
    // Impact category: degraded → "Degraded performance"
    expect(xml).toContain('<category term="Degraded performance"');
    // Affected service names
    expect(xml).toContain('API');
    // Time range (start / resolved)
    expect(xml).toContain('Sep 20');
    // Link to page
    expect(xml).toContain(`href="${PAGE_URL}"`);
  });

  it('AC1-c: maintenance entries use category "Maintenance", not the impact label', () => {
    const xml = buildAtomFeed([INC_MAINT_PAST], SERVICES, NOW, PAGE_URL);

    expect(xml).toContain('<category term="Maintenance"');
    expect(xml).not.toContain('<category term="Degraded performance"');
  });

  it('AC1-d: entry with multiple affected services lists all their names', () => {
    const xml = buildAtomFeed([INC_OLDER], SERVICES, NOW, PAGE_URL);

    expect(xml).toContain('Web app');
    expect(xml).toContain('API');
  });

  it('AC1-e: entry id is a stable URN based on incident.id', () => {
    const xml = buildAtomFeed([INC_RECENT], SERVICES, NOW, PAGE_URL);

    expect(xml).toContain('<id>urn:northwind:incident:inc-recent</id>');
  });

  it('AC1-f: updated timestamp is resolvedAt when present, otherwise startedAt', () => {
    const xml = buildAtomFeed([INC_RECENT], SERVICES, NOW, PAGE_URL);
    expect(xml).toContain('2026-09-20T11:30:00Z');

    const ongoing: Incident = { ...INC_RECENT, id: 'inc-ongoing', resolvedAt: null };
    const xml2 = buildAtomFeed([ongoing], SERVICES, NOW, PAGE_URL);
    expect(xml2).toContain('2026-09-20T10:00:00Z');
  });

  it('AC1-g: returns empty feed (no entries) when there are no past incidents', () => {
    const xml = buildAtomFeed([INC_TOO_OLD, INC_UPCOMING], SERVICES, NOW, PAGE_URL);

    expect(xml).not.toContain('<entry>');
    expect(xml).toContain('<feed');
  });
});

// ---------------------------------------------------------------------------
// AC2: Valid Atom structure
// ---------------------------------------------------------------------------

describe('AC2: buildAtomFeed – Atom structure', () => {
  it('AC2-a: output starts with XML declaration and Atom feed element', () => {
    const xml = buildAtomFeed([INC_RECENT], SERVICES, NOW, PAGE_URL);

    expect(xml.trimStart()).toMatch(/^<\?xml version="1\.0" encoding="utf-8"\?>/);
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom"');
    expect(xml).toContain('</feed>');
  });

  it('AC2-b: feed-level id equals pageUrl + "feed.xml" and self link href matches', () => {
    const xml = buildAtomFeed([INC_RECENT], SERVICES, NOW, PAGE_URL);

    expect(xml).toContain(`<id>${PAGE_URL}feed.xml</id>`);
    expect(xml).toContain(`rel="self"`);
    expect(xml).toContain(`href="${PAGE_URL}feed.xml"`);
  });

  it('AC2-c: feed has a <title> element', () => {
    const xml = buildAtomFeed([INC_RECENT], SERVICES, NOW, PAGE_URL);

    expect(xml).toContain('<title>Northwind status</title>');
  });

  it('AC2-d: feed has an alternate link back to the page root', () => {
    const xml = buildAtomFeed([INC_RECENT], SERVICES, NOW, PAGE_URL);

    expect(xml).toContain(`rel="alternate"`);
    expect(xml).toContain(`href="${PAGE_URL}"`);
  });

  it('AC2-e: feed has a <updated> element in ISO 8601 format', () => {
    const xml = buildAtomFeed([INC_RECENT], SERVICES, NOW, PAGE_URL);

    // Should have at least one <updated> tag
    expect(xml).toMatch(/<updated>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/updated>/);
  });
});

// ---------------------------------------------------------------------------
// AC3: index.html has the Subscribe link and <link rel="alternate">
// ---------------------------------------------------------------------------

describe('AC3: index.html – Subscribe link and alternate link tag', () => {
  const indexHtml = indexHtmlRaw;

  it('AC3-a: index.html contains <link rel="alternate" type="application/atom+xml" href="feed.xml">', () => {
    expect(indexHtml).toContain('rel="alternate"');
    expect(indexHtml).toContain('type="application/atom+xml"');
    expect(indexHtml).toContain('href="feed.xml"');
  });

  it('AC3-b: index.html contains a visible Subscribe (Atom) link pointing to feed.xml', () => {
    expect(indexHtml).toContain('Subscribe (Atom)');
    expect(indexHtml).toContain('href="feed.xml"');
  });
});
