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
  dailyBars,
  filterByServices,
  groupByDay,
  incidentState,
  pastIncidents,
  servicesWithIncidents,
  upcomingMaintenance,
  updatesNewestFirst,
  uptimePercent,
} from './lib/incidents';
import { overallStatus, STATUS_LABEL, UPDATE_LABEL } from './lib/status';
import type { Incident, Service, ServiceStatus } from './lib/types';

type Child = Node | string;
type Tone = ServiceStatus | 'maintenance';

const selected = new Set<string>();

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

function uptimeBars(service: Service): HTMLElement {
  const bars = dailyBars(incidents, service.id, NOW).map(({ day, status }) => {
    const text = `${formatDay(day)}: ${status === 'operational' ? 'No incident' : STATUS_LABEL[status]}`;
    return el('li', { class: `uptime-bar tone-${status}`, title: text }, [
      el('span', { class: 'visually-hidden' }, [text]),
    ]);
  });
  return el('div', { class: 'uptime-chart' }, [
    el('ol', { class: 'uptime-bars', 'aria-label': `${service.name} status, last 90 days` }, bars),
    el('p', { class: 'uptime-caption', 'aria-hidden': 'true' }, [
      el('span', {}, ['90 days ago']),
      el('span', {}, ['Today']),
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
    el('div', { class: 'service-uptime' }, [
      uptimeBars(service),
      el('p', { class: 'uptime-percent' }, [
        el('span', { class: 'visually-hidden' }, ['Uptime, last 90 days: ']),
        formatUptime(uptimePercent(incidents, service.id, NOW)),
      ]),
    ]),
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
  const active = activeIncidents(filterByServices(incidents, [...selected]), NOW);
  if (active.length === 0) {
    byId('active').replaceChildren();
    return;
  }
  byId('active').replaceChildren(
    el('section', { class: 'notice', 'aria-labelledby': 'active-heading' }, [
      el('h2', { id: 'active-heading', class: 'notice-heading' }, ['Active incidents']),
      ...active.map((i) => incidentDetails(i, true)),
    ]),
  );
}

function renderMaintenance(): void {
  const upcoming = upcomingMaintenance(filterByServices(incidents, [...selected]), NOW);
  if (upcoming.length === 0) {
    byId('maintenance').replaceChildren();
    return;
  }
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
  const groups = groupByDay(pastIncidents(filterByServices(incidents, [...selected]), NOW));
  if (groups.length === 0) {
    const message =
      selected.size > 0
        ? 'No past incidents for the selected services in the last 90 days.'
        : 'No incidents reported in the last 90 days.';
    byId('days').replaceChildren(el('p', { class: 'empty' }, [message]));
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

function renderIncidents(): void {
  renderActive();
  renderMaintenance();
  renderHistory();
}

function renderFilter(): void {
  const clear = el('button', { type: 'button', class: 'filter-clear' }, ['Clear filter']);
  clear.disabled = true;
  const boxes = servicesWithIncidents(incidents, services).map((service) => {
    const input = el('input', { type: 'checkbox', value: service.id });
    input.addEventListener('change', () => {
      if (input.checked) selected.add(service.id);
      else selected.delete(service.id);
      clear.disabled = selected.size === 0;
      renderIncidents();
    });
    return el('label', { class: 'filter-option' }, [input, service.name]);
  });
  clear.addEventListener('click', () => {
    selected.clear();
    for (const input of byId('filter').querySelectorAll('input')) input.checked = false;
    clear.disabled = true;
    renderIncidents();
  });
  byId('filter').replaceChildren(
    el('fieldset', { class: 'filter' }, [
      el('legend', { class: 'filter-legend' }, ['Filter incidents by service']),
      el('div', { class: 'filter-options' }, boxes),
      clear,
    ]),
  );
}

renderOverall();
renderFilter();
byId('services').replaceChildren(...services.map(serviceRow));
byId('updated').replaceChildren(
  'Updated ',
  time(NOW.toISOString(), formatDateTime(NOW.toISOString())),
);
renderIncidents();
