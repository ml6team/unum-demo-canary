import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import { incidents, NOW, SITE_URL, services } from '../data';
import { buildAtomFeed } from './feed';
import { formatRange } from './format';
import { affectedServiceNames, pastIncidents } from './incidents';
import { STATUS_LABEL } from './status';
import type { Incident, Service } from './types';

const FEED_ID = 'tag:ml6team.github.io,2026:unum-demo-canary';

function entries(xml: string): string[] {
  return [...xml.matchAll(/<entry>[\s\S]*?<\/entry>/g)].map((m) => m[0]);
}

function entryIds(xml: string): string[] {
  return entries(xml).map((e) => /<id>([^<]*)<\/id>/.exec(e)?.[1] ?? '');
}

const svc: Service[] = [
  { id: 'api', name: 'API & Webhooks', description: '', status: 'operational' },
  { id: 'git', name: 'Git', description: '', status: 'operational' },
];

function inc(id: string, extra: Partial<Incident> = {}): Incident {
  return {
    id,
    kind: 'incident',
    title: id,
    impact: 'degraded',
    affectedServiceIds: ['api'],
    startedAt: '2026-09-20T10:00:00Z',
    resolvedAt: '2026-09-20T11:00:00Z',
    updates: [{ at: '2026-09-20T11:00:00Z', status: 'resolved', body: 'done' }],
    ...extra,
  };
}

describe('buildAtomFeed', () => {
  const xml = buildAtomFeed(incidents, services, NOW, SITE_URL);

  it('AC2, AC6: lists the same incidents as the page, in the same order', () => {
    const expected = pastIncidents(incidents, NOW).map((i) => `${FEED_ID}:incident:${i.id}`);
    expect(expected.length).toBeGreaterThan(0);
    expect(entryIds(xml)).toEqual(expected);
  });

  it('AC2: leaves out upcoming maintenance and incidents older than the window', () => {
    const feed = buildAtomFeed(
      [
        inc('now'),
        inc('upcoming', {
          kind: 'maintenance',
          startedAt: '2026-10-05T10:00:00Z',
          resolvedAt: '2026-10-05T11:00:00Z',
        }),
        inc('old', { startedAt: '2026-05-01T10:00:00Z', resolvedAt: '2026-05-01T11:00:00Z' }),
      ],
      svc,
      NOW,
      SITE_URL,
    );
    expect(entryIds(feed)).toEqual([`${FEED_ID}:incident:now`]);
  });

  it('AC2: puts the newest incident first', () => {
    const feed = buildAtomFeed(
      [
        inc('a', { startedAt: '2026-09-01T10:00:00Z', resolvedAt: '2026-09-01T11:00:00Z' }),
        inc('b', { startedAt: '2026-09-25T10:00:00Z', resolvedAt: '2026-09-25T11:00:00Z' }),
      ],
      svc,
      NOW,
      SITE_URL,
    );
    expect(entryIds(feed)).toEqual([`${FEED_ID}:incident:b`, `${FEED_ID}:incident:a`]);
  });

  it('AC3: each entry has title, impact label, services, range and a link to the page', () => {
    const list = entries(xml);
    pastIncidents(incidents, NOW).forEach((i, n) => {
      const entry = list[n] ?? '';
      const label = i.kind === 'maintenance' ? 'Maintenance' : STATUS_LABEL[i.impact];
      expect(entry).toContain(`<title>${i.title.replace(/&/g, '&amp;')}</title>`);
      expect(entry).toContain(label);
      for (const name of affectedServiceNames(i, services)) {
        expect(entry).toContain(name.replace(/&/g, '&amp;'));
      }
      expect(entry).toContain(formatRange(i.startedAt, i.resolvedAt));
      expect(entry).toContain(`<link href="${SITE_URL}#history"`);
    });
  });

  it('AC3: labels maintenance as Maintenance, not by its impact', () => {
    const feed = buildAtomFeed([inc('m', { kind: 'maintenance' })], svc, NOW, SITE_URL);
    expect(feed).toContain('<category term="maintenance" label="Maintenance"');
    expect(feed).toContain('Affects: API &amp; Webhooks');
  });

  it('AC5: has the elements Atom requires on the feed', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).toContain(`<id>${FEED_ID}</id>`);
    expect(xml).toContain('<title>Northwind status</title>');
    expect(xml).toContain('<updated>2026-10-01T12:00:00.000Z</updated>');
    expect(xml).toContain('<author><name>Northwind</name></author>');
    expect(xml).toContain(`<link rel="alternate" href="${SITE_URL}"/>`);
    expect(xml).toContain(
      `<link rel="self" type="application/atom+xml" href="${SITE_URL}feed.xml"/>`,
    );
  });

  it('AC5: every entry has id, title and updated with RFC 3339 dates, and ids are unique absolute IRIs', () => {
    const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    for (const entry of entries(xml)) {
      expect(entry).toMatch(/<id>[^<]+<\/id>/);
      expect(entry).toMatch(/<title>[^<]+<\/title>/);
      const updated = /<updated>([^<]*)<\/updated>/.exec(entry)?.[1] ?? '';
      const published = /<published>([^<]*)<\/published>/.exec(entry)?.[1] ?? '';
      expect(updated).toMatch(rfc3339);
      expect(published).toMatch(rfc3339);
    }
    const ids = entryIds(xml);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^tag:/);
  });

  it("AC5: sets an entry's updated to its newest update", () => {
    const feed = buildAtomFeed(
      [
        inc('u', {
          updates: [
            { at: '2026-09-20T10:30:00Z', status: 'identified', body: 'x' },
            { at: '2026-09-20T11:00:00Z', status: 'resolved', body: 'y' },
          ],
        }),
      ],
      svc,
      NOW,
      SITE_URL,
    );
    expect(feed).toContain('<published>2026-09-20T10:00:00.000Z</published>');
    expect(feed).toContain('<updated>2026-09-20T11:00:00.000Z</updated>');
  });

  it('AC5: escapes &, <, > and quotes in text', () => {
    const feed = buildAtomFeed(
      [inc('e', { title: `A & B <C> "D" 'E'` })],
      [{ id: 'api', name: 'X<Y>&"Z"', description: '', status: 'operational' }],
      NOW,
      SITE_URL,
    );
    expect(feed).toContain('<title>A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;</title>');
    expect(feed).toContain('X&lt;Y&gt;&amp;&quot;Z&quot;');
    expect(feed).not.toContain('<C>');
  });

  it('AC3: includes an ongoing incident with a "Since" range', () => {
    const feed = buildAtomFeed([inc('o', { resolvedAt: null, updates: [] })], svc, NOW, SITE_URL);
    expect(entryIds(feed)).toEqual([`${FEED_ID}:incident:o`]);
    expect(feed).toContain('Since Sep 20, 10:00 UTC');
    expect(feed).toContain('<updated>2026-09-20T10:00:00.000Z</updated>');
  });

  it('AC5: an empty window gives a feed with no entries', () => {
    const feed = buildAtomFeed([], svc, NOW, SITE_URL);
    expect(entries(feed)).toEqual([]);
    expect(feed).toContain('</feed>');
  });
});

describe('feed links in index.html', () => {
  it('AC4: the head has a rel="alternate" Atom link to feed.xml', () => {
    const head = /<head>[\s\S]*<\/head>/.exec(html)?.[0] ?? '';
    expect(head).toMatch(
      /<link\s+rel="alternate"\s+type="application\/atom\+xml"[^>]*href="feed\.xml"/,
    );
  });

  it('AC4: the page has a visible "Subscribe" link to feed.xml', () => {
    const body = /<body>[\s\S]*<\/body>/.exec(html)?.[0] ?? '';
    expect(body).toMatch(/<a [^>]*href="feed\.xml"[^>]*>\s*Subscribe\s*<\/a>/);
  });
});
