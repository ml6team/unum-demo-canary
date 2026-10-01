import './style.css';
import { incidents, NOW, services } from './data';
import {
  formatDateTime,
  formatDay,
  formatIncidentDuration,
  formatRange,
  formatUptime,
} from './lib/format';
import {
  activeIncidents,
  affectedServiceNames,
  groupByDay,
  incidentState,
  pastIncidents,
  upcomingMaintenance,
  updatesNewestFirst,
} from './lib/incidents';
import { DAY_TONE_LABEL, overallStatus, STATUS_LABEL, UPDATE_LABEL } from './lib/status';
import type { Incident, Service, ServiceStatus } from './lib/types';
import { type DayTone, serviceDays, serviceUptime, type UptimeDay } from './lib/uptime';

type Child = Node | string;
type Tone = ServiceStatus | 'maintenance';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

const ICON_PATHS: Record<Tone | 'chevron', string> = {
  operational: '<circle cx="8" cy="8" r="7"/><path d="m5 8.2 2 2 4-4.2" class="i-mark"/>',
  degraded: '<circle cx="8" cy="8" r="7"/><path d="M5 8h6" class="i-mark"/>',
  'partial-outage': '<path d="M8 1.2 15 14H1Z"/><path d="M8 6v3.6M8 11.6v.1" class="i-mark"/>',
  'major-outage': '<circle cx="8" cy="8" r="7"/><path d="m5.5 5.5 5 5m0-5-5 5" class="i-mark"/>',
  maintenance: '<circle cx="8" cy="8" r="7"/><path d="M8 4.5V8l2.5 1.5" class="i-mark"/>',
  chevron: '<path d="m6 4 4 4-4 4" class="i-line"/>',
};

function icon(name: Tone | 'chevron', className = 'icon'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICON_PATHS[name];
  return svg;
}

function toneOf(incident: Incident): Tone {
  return incident.kind === 'maintenance' ? 'maintenance' : incident.impact;
}

function badge(tone: Tone): HTMLElement {
  const label = tone === 'maintenance' ? 'Maintenance' : STATUS_LABEL[tone];
  return el('span', { class: `badge tone-${tone}` }, [label]);
}

function time(iso: string, text: string): HTMLTimeElement {
  return el('time', { datetime: iso }, [text]);
}

function renderOverall(): void {
  const overall = overallStatus(services);
  const detail =
    overall.affected.length > 0
      ? `Affected: ${overall.affected.map((s) => s.name).join(', ')}`
      : 'We are not aware of any issues affecting our systems.';
  byId('overall').replaceChildren(
    el('section', { class: `banner tone-${overall.status}`, 'aria-label': 'Overall status' }, [
      icon(overall.status, 'banner-icon'),
      el('div', { class: 'banner-text' }, [
        el('p', { class: 'banner-title' }, [overall.title]),
        el('p', { class: 'banner-detail' }, [detail]),
      ]),
    ]),
  );
}

function uptimeBar(day: UptimeDay): HTMLLIElement {
  const text = `${formatDay(day.day)}: ${DAY_TONE_LABEL[day.tone]}`;
  const attrs: Record<string, string> = {
    class: `uptime-bar tone-${day.tone}`,
    title: text,
    'data-tip': text,
  };
  if (day.incidentIds.length > 0) attrs.tabindex = '0';
  return el('li', attrs, [el('span', { class: 'visually-hidden' }, [text])]);
}

function uptimeBlock(service: Service): HTMLElement {
  const uptime = serviceUptime(service.id, incidents, NOW);
  return el('div', { class: 'uptime' }, [
    el(
      'ol',
      { class: 'uptime-bars', 'aria-label': `${service.name}: last 90 days, oldest first` },
      serviceDays(service.id, incidents, NOW).map(uptimeBar),
    ),
    el('p', { class: 'uptime-summary' }, [
      el('span', { class: 'uptime-percent' }, [`${formatUptime(uptime.percent)} uptime`]),
      el('span', { class: 'uptime-caption' }, ['90 days']),
    ]),
  ]);
}

function serviceRow(service: Service): HTMLLIElement {
  return el('li', { class: 'service' }, [
    el('div', { class: 'service-text' }, [
      el('h3', { class: 'service-name' }, [service.name]),
      el('p', { class: 'service-description' }, [service.description]),
    ]),
    el('span', { class: `status tone-${service.status}` }, [
      icon(service.status),
      STATUS_LABEL[service.status],
    ]),
    uptimeBlock(service),
  ]);
}

const LEGEND_TONES: DayTone[] = [
  'operational',
  'degraded',
  'partial-outage',
  'major-outage',
  'maintenance',
];

function uptimeLegend(): HTMLElement {
  return el('div', { class: 'uptime-legend' }, [
    el('span', { class: 'muted' }, ['90 days ago']),
    el(
      'ul',
      { class: 'uptime-legend-items', 'aria-label': 'Bar colours' },
      LEGEND_TONES.map((tone) =>
        el('li', { class: `uptime-legend-item tone-${tone}` }, [
          el('span', { class: 'uptime-swatch', 'aria-hidden': 'true' }),
          DAY_TONE_LABEL[tone],
        ]),
      ),
    ),
    el('span', { class: 'muted' }, ['Today']),
  ]);
}

function timeline(incident: Incident): HTMLOListElement {
  return el(
    'ol',
    { class: 'timeline' },
    updatesNewestFirst(incident).map((update) =>
      el('li', { class: 'update' }, [
        el('div', { class: 'update-head' }, [
          el('span', { class: 'update-status' }, [UPDATE_LABEL[update.status]]),
          time(update.at, formatDateTime(update.at)),
        ]),
        el('p', { class: 'update-body' }, [update.body]),
      ]),
    ),
  );
}

function incidentMeta(incident: Incident): HTMLElement {
  const parts: Child[] = [
    time(incident.startedAt, formatRange(incident.startedAt, incident.resolvedAt)),
  ];
  if (incident.resolvedAt !== null && incidentState(incident, NOW) === 'resolved') {
    parts.push(el('span', { class: 'dot', 'aria-hidden': 'true' }, ['·']));
    parts.push(
      el('span', {}, [
        el('span', { class: 'visually-hidden' }, ['Duration ']),
        formatIncidentDuration(incident.startedAt, incident.resolvedAt),
      ]),
    );
  }
  return el('p', { class: 'incident-meta' }, parts);
}

function affects(incident: Incident): HTMLElement {
  return el('p', { class: 'incident-affects' }, [
    el('span', { class: 'muted' }, ['Affects ']),
    affectedServiceNames(incident, services).join(', '),
  ]);
}

function incidentDetails(incident: Incident, open = false): HTMLDetailsElement {
  const details = el('details', { class: `incident tone-${toneOf(incident)}` }, [
    el('summary', { class: 'incident-summary' }, [
      el('span', { class: 'incident-heading' }, [
        el('span', { class: 'incident-title' }, [incident.title]),
        badge(toneOf(incident)),
      ]),
      incidentMeta(incident),
      affects(incident),
      icon('chevron', 'chevron'),
    ]),
    timeline(incident),
  ]);
  details.open = open;
  return details;
}

function renderActive(): void {
  const active = activeIncidents(incidents, NOW);
  if (active.length === 0) return;
  byId('active').replaceChildren(
    el('section', { class: 'notice', 'aria-labelledby': 'active-heading' }, [
      el('h2', { id: 'active-heading', class: 'notice-heading' }, ['Active incidents']),
      ...active.map((i) => incidentDetails(i, true)),
    ]),
  );
}

function renderMaintenance(): void {
  const upcoming = upcomingMaintenance(incidents, NOW);
  if (upcoming.length === 0) return;
  byId('maintenance').replaceChildren(
    el('section', { class: 'notice', 'aria-labelledby': 'maintenance-heading' }, [
      el('h2', { id: 'maintenance-heading', class: 'notice-heading' }, ['Scheduled maintenance']),
      ...upcoming.map((m) =>
        el('article', { class: 'maintenance tone-maintenance' }, [
          icon('maintenance', 'maintenance-icon'),
          el('div', { class: 'maintenance-text' }, [
            el('h3', { class: 'maintenance-title' }, [m.title]),
            el('p', { class: 'incident-meta' }, [
              el('span', { class: 'visually-hidden' }, ['Scheduled for ']),
              time(m.startedAt, formatRange(m.startedAt, m.resolvedAt)),
            ]),
            affects(m),
            el('p', { class: 'maintenance-body' }, [m.updates.at(-1)?.body ?? '']),
          ]),
        ]),
      ),
    ]),
  );
}

function renderHistory(): void {
  const groups = groupByDay(pastIncidents(incidents, NOW));
  if (groups.length === 0) {
    byId('days').replaceChildren(
      el('p', { class: 'empty' }, ['No incidents reported in the last 90 days.']),
    );
    return;
  }
  byId('days').replaceChildren(
    ...groups.map((group) =>
      el('section', { class: 'day', 'aria-labelledby': `day-${group.day}` }, [
        el('h3', { class: 'day-heading', id: `day-${group.day}` }, [
          time(group.day, formatDay(group.day)),
        ]),
        el(
          'div',
          { class: 'day-incidents' },
          group.incidents.map((i) => incidentDetails(i)),
        ),
      ]),
    ),
  );
}

renderOverall();
renderActive();
renderMaintenance();
byId('services').replaceChildren(...services.map(serviceRow));
byId('services').after(uptimeLegend());
byId('updated').replaceChildren(
  'Updated ',
  time(NOW.toISOString(), formatDateTime(NOW.toISOString())),
);
renderHistory();
