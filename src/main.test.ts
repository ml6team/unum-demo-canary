// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { Incident, Service } from './lib/types';

// Set up the DOM shell that main.ts' top-level render calls need.
// This runs before main.ts is imported so the side-effects don't throw.
document.body.innerHTML = `
  <div id="overall"></div>
  <div id="active"></div>
  <div id="maintenance"></div>
  <ul id="services"></ul>
  <span id="updated"></span>
  <div id="days"></div>
`;

// Import after the DOM shell is ready.
const { serviceRow } = await import('./main');

const NOW = new Date('2026-10-01T12:00:00Z');

const API_SERVICE: Service = {
  id: 'api',
  name: 'API',
  description: 'REST API',
  status: 'operational',
};

function incident(
  id: string,
  startedAt: string,
  resolvedAt: string | null,
  extra: Partial<Incident> = {},
): Incident {
  return {
    id,
    kind: 'incident',
    title: id,
    impact: 'degraded',
    affectedServiceIds: ['api'],
    startedAt,
    resolvedAt,
    updates: [],
    ...extra,
  };
}

describe('serviceRow uptime bar', () => {
  it('AC2: renders exactly 90 uptime-segment buttons per service row', () => {
    const li = serviceRow(API_SERVICE, [], NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    expect(buttons).toHaveLength(90);
  });

  it('AC2: first segment aria-label is the oldest day (Jul 4, 2026)', () => {
    const li = serviceRow(API_SERVICE, [], NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Jul 4, 2026');
  });

  it('AC2: last segment aria-label is the newest day (Oct 1, 2026)', () => {
    const li = serviceRow(API_SERVICE, [], NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    expect(buttons[89]?.getAttribute('aria-label')).toBe('Oct 1, 2026');
  });

  it('AC2: operational days get tone-operational class', () => {
    const li = serviceRow(API_SERVICE, [], NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    for (const btn of buttons) {
      expect(btn.classList.contains('tone-operational')).toBe(true);
    }
  });

  it('AC2: a day with a partial-outage incident gets tone-partial-outage class', () => {
    const incs = [
      incident('p', '2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z', {
        impact: 'partial-outage',
      }),
    ];
    const li = serviceRow(API_SERVICE, incs, NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    const sep01 = Array.from(buttons).find((b) => b.getAttribute('aria-label') === 'Sep 1, 2026');
    expect(sep01?.classList.contains('tone-partial-outage')).toBe(true);
  });

  it('AC2: worst impact wins when multiple incidents affect the same day', () => {
    const incs = [
      incident('a', '2026-08-15T08:00:00Z', '2026-08-15T09:00:00Z', {
        impact: 'partial-outage',
      }),
      incident('b', '2026-08-15T10:00:00Z', '2026-08-15T11:00:00Z', {
        impact: 'major-outage',
      }),
    ];
    const li = serviceRow(API_SERVICE, incs, NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    const aug15 = Array.from(buttons).find((b) => b.getAttribute('aria-label') === 'Aug 15, 2026');
    expect(aug15?.classList.contains('tone-major-outage')).toBe(true);
  });

  it('AC2: maintenance-only days are coloured operational', () => {
    const incs = [
      incident('m', '2026-09-05T02:00:00Z', '2026-09-05T03:00:00Z', {
        kind: 'maintenance',
        impact: 'partial-outage',
      }),
    ];
    const li = serviceRow(API_SERVICE, incs, NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    const sep05 = Array.from(buttons).find((b) => b.getAttribute('aria-label') === 'Sep 5, 2026');
    expect(sep05?.classList.contains('tone-operational')).toBe(true);
  });

  it('renders a percentage label showing 100.0% uptime when there are no incidents', () => {
    const li = serviceRow(API_SERVICE, [], NOW);
    const pct = li.querySelector('.uptime-pct');
    expect(pct?.textContent).toBe('100.0% uptime');
  });

  it('percentage label reflects actual downtime from partial-outage incidents', () => {
    // Use a 24h outage: 1h in 90 days (128,880 min) rounds to 100.0% at one decimal,
    // so a 1h fixture could never detect a missing implementation. 24h = 98.9%.
    const incs = [
      incident('p', '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z', {
        impact: 'partial-outage',
      }),
    ];
    const li = serviceRow(API_SERVICE, incs, NOW);
    const pct = li.querySelector('.uptime-pct');
    expect(pct?.textContent).not.toBe('100.0% uptime');
    expect(pct?.textContent).toMatch(/^\d+\.\d% uptime$/);
  });
});
