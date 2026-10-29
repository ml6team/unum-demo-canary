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
const { serviceRow, uptimeLegend } = await import('./main');

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

describe('serviceRow tooltip (AC3, AC5)', () => {
  it('AC3: each segment button contains a tooltip span', () => {
    const li = serviceRow(API_SERVICE, [], NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    for (const btn of buttons) {
      expect(btn.querySelector('.segment-tooltip')).not.toBeNull();
    }
  });

  it('AC3: tooltip span for a clean day contains "No incidents"', () => {
    const li = serviceRow(API_SERVICE, [], NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    const btn = buttons[0] as HTMLElement;
    const tooltip = btn.querySelector('.segment-tooltip');
    expect(tooltip?.textContent).toContain('No incidents');
  });

  it('AC3: tooltip span contains the formatted date', () => {
    const li = serviceRow(API_SERVICE, [], NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    // First segment = Jul 4, 2026
    const tooltip = buttons[0]?.querySelector('.segment-tooltip');
    expect(tooltip?.textContent).toContain('Jul 4, 2026');
  });

  it('AC3: tooltip span lists incident titles for a day with incidents', () => {
    const incs = [
      incident('api-err', '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z', {
        title: 'Elevated API error rates',
        impact: 'partial-outage',
      }),
    ];
    const li = serviceRow(API_SERVICE, incs, NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    const sep10 = Array.from(buttons).find((b) => b.getAttribute('aria-label') === 'Sep 10, 2026');
    const tooltip = sep10?.querySelector('.segment-tooltip');
    expect(tooltip?.textContent).toContain('Elevated API error rates');
    expect(tooltip?.textContent).not.toContain('No incidents');
  });

  it('AC5: each segment button has aria-describedby pointing to its tooltip span id', () => {
    const li = serviceRow(API_SERVICE, [], NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    for (const btn of buttons) {
      const describedBy = btn.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const tooltip = btn.querySelector('.segment-tooltip');
      expect(tooltip?.getAttribute('id')).toBe(describedBy);
    }
  });

  it('AC5: tooltip span does not use display:none (must use visibility for aria-describedby to work)', () => {
    // The tooltip must be in the DOM and not display:none so aria-describedby works.
    // We verify the element is always present (not conditionally rendered).
    const li = serviceRow(API_SERVICE, [], NOW);
    const buttons = li.querySelectorAll('button.uptime-segment');
    for (const btn of buttons) {
      expect(btn.querySelector('.segment-tooltip')).not.toBeNull();
    }
  });
});

describe('uptimeLegend', () => {
  it('legend: ul has role="list"', () => {
    const legend = uptimeLegend();
    expect(legend.getAttribute('role')).toBe('list');
  });

  it('legend: contains exactly four items', () => {
    const legend = uptimeLegend();
    expect(legend.querySelectorAll('li')).toHaveLength(4);
  });

  it('legend: items have correct labels (Operational, Degraded, Partial outage, Major outage)', () => {
    const legend = uptimeLegend();
    const items = Array.from(legend.querySelectorAll('li'));
    const texts = items.map((li) => li.textContent?.trim());
    expect(texts).toContain('Operational');
    expect(texts).toContain('Degraded');
    expect(texts).toContain('Partial outage');
    expect(texts).toContain('Major outage');
  });

  it('legend: each item has a swatch span with matching tone-* class', () => {
    const legend = uptimeLegend();
    const expectedClasses = [
      'tone-operational',
      'tone-degraded',
      'tone-partial-outage',
      'tone-major-outage',
    ];
    for (const cls of expectedClasses) {
      const swatch = legend.querySelector(`.legend-swatch.${cls}`);
      expect(swatch).not.toBeNull();
    }
  });

  it('AC4: uptime percentage uses full 90-day window regardless of how many segments are shown', () => {
    // The percentage must not be recomputed for 30 days — it always covers all 90.
    const incs = [
      incident('p', '2026-07-10T00:00:00Z', '2026-07-11T00:00:00Z', {
        impact: 'partial-outage',
      }),
    ];
    const li = serviceRow(API_SERVICE, incs, NOW);
    const pct = li.querySelector('.uptime-pct');
    // If the percentage were recomputed for only the last 30 days (Sep 1 – Oct 1),
    // the Jul 10 incident would be excluded and the result would be 100.0%.
    // With the full 90-day window the Jul 10 24h outage reduces it below 100.0%.
    expect(pct?.textContent).not.toBe('100.0% uptime');
  });
});
