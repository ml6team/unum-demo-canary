import './style.css';
import { flags as initialFlags, metrics, users } from './data';
import { exposedUsers, setEnabled } from './lib/flags';
import { formatCount, formatDate, formatRate, formatRateDelta } from './lib/format';
import {
  combined,
  compareGroups,
  DEGRADED_THRESHOLD,
  EMPTY_METRICS,
  errorRate,
  type GroupStats,
  type Health,
  health,
} from './lib/metrics';
import type { Flag } from './lib/types';

interface State {
  flags: Flag[];
  selectedKey: string;
}

const state: State = {
  flags: initialFlags,
  selectedKey: initialFlags[0]?.key ?? '',
};

const HEALTH_LABEL: Record<Health, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  'no-traffic': 'No traffic',
};

type Child = Node | string;

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

function metricsFor(key: string) {
  return metrics.flags[key] ?? EMPTY_METRICS;
}

function rateFor(key: string): number | null {
  return errorRate(combined(metricsFor(key)));
}

function healthPill(value: Health): HTMLElement {
  return el('span', { class: `pill pill-${value}` }, [HEALTH_LABEL[value]]);
}

function canaryRiskPill(): HTMLElement {
  return el('span', { class: 'pill pill-risk' }, ['Canary at risk']);
}

function flagSwitch(flag: Flag): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    role: 'switch',
    class: 'switch',
    'aria-checked': String(flag.enabled),
    'aria-label': `Enable ${flag.key}`,
    'data-toggle': flag.key,
  });
  button.append(el('span', { class: 'switch-thumb', 'aria-hidden': 'true' }));
  return button;
}

function flagRow(flag: Flag): HTMLTableRowElement {
  const rate = rateFor(flag.key);
  const atRisk = compareGroups(metricsFor(flag.key)).canaryAtRisk;
  const selected = flag.key === state.selectedKey;
  return el('tr', { 'data-key': flag.key, class: selected ? 'is-selected' : '' }, [
    el('td', { class: 'col-flag' }, [
      el(
        'button',
        {
          type: 'button',
          class: 'flag-key',
          'data-select': flag.key,
          'aria-controls': 'details',
          'aria-current': String(selected),
        },
        [flag.key],
      ),
      el('span', { class: 'flag-description' }, [flag.description]),
    ]),
    el('td', { class: 'col-owner' }, [flag.owner]),
    el('td', { class: 'col-rate' }, [
      el('span', { class: 'rate' }, [
        healthPill(health(rate)),
        ...(atRisk ? [canaryRiskPill()] : []),
        el('span', { class: 'rate-value' }, [formatRate(rate)]),
      ]),
    ]),
    el('td', { class: 'col-switch' }, [flagSwitch(flag)]),
  ]);
}

function stat(label: string, value: Child, hint?: string): HTMLElement {
  return el('div', { class: 'stat' }, [
    el('dt', {}, [label]),
    el('dd', {}, [value]),
    ...(hint ? [el('span', { class: 'stat-hint' }, [hint])] : []),
  ]);
}

function groupRow(label: string, group: GroupStats): HTMLTableRowElement {
  return el('tr', {}, [
    el('th', { scope: 'row', class: 'compare-cell compare-cell-row' }, [label]),
    el('td', { class: 'compare-cell' }, [formatCount(group.counts.requests)]),
    el('td', { class: 'compare-cell' }, [formatCount(group.counts.errors)]),
    el('td', { class: 'compare-cell' }, [formatRate(group.rate)]),
    el('td', { class: 'compare-cell' }, [
      el('span', { class: `pill pill-${group.health} compare-pill` }, [HEALTH_LABEL[group.health]]),
    ]),
  ]);
}

function comparisonSection(key: string): Node[] {
  const comparison = compareGroups(metricsFor(key));
  return [
    el('h3', { class: 'section-title' }, ['Canary vs baseline']),
    el('table', { class: 'compare' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { scope: 'col', class: 'compare-cell compare-cell-head' }, ['Group']),
          el('th', { scope: 'col', class: 'compare-cell compare-cell-head' }, ['Requests']),
          el('th', { scope: 'col', class: 'compare-cell compare-cell-head' }, ['Errors']),
          el('th', { scope: 'col', class: 'compare-cell compare-cell-head' }, ['Error rate']),
          el('th', { scope: 'col', class: 'compare-cell compare-cell-head' }, ['Health']),
        ]),
      ]),
      el('tbody', {}, [
        groupRow('Canary', comparison.canary),
        groupRow('Baseline', comparison.baseline),
      ]),
    ]),
    el('p', { class: 'compare-delta' }, [
      el('span', { class: 'muted' }, ['Difference, canary minus baseline']),
      el('span', { class: 'compare-delta-value' }, [formatRateDelta(comparison.delta)]),
    ]),
    ...(comparison.canaryAtRisk ? [el('p', { class: 'compare-risk' }, [canaryRiskPill()])] : []),
  ];
}

function renderDetails(): void {
  const container = byId('details');
  const flag = state.flags.find((f) => f.key === state.selectedKey);
  if (!flag) {
    container.replaceChildren(el('p', { class: 'empty' }, ['Select a flag to see its details.']));
    return;
  }
  const totals = combined(metricsFor(flag.key));
  const rate = errorRate(totals);
  const exposed = exposedUsers(flag, users);

  container.replaceChildren(
    el('div', { class: 'details-head' }, [
      el('h2', { class: 'details-key' }, [flag.key]),
      el('span', { class: `status status-${flag.enabled ? 'on' : 'off'}` }, [
        flag.enabled ? 'On' : 'Off',
      ]),
    ]),
    el('p', { class: 'details-description' }, [flag.description]),
    el('dl', { class: 'meta' }, [
      el('div', {}, [el('dt', {}, ['Owner']), el('dd', {}, [flag.owner])]),
      el('div', {}, [el('dt', {}, ['Created']), el('dd', {}, [formatDate(flag.createdAt)])]),
      el('div', {}, [
        el('dt', {}, ['Exposure']),
        el('dd', {}, [`${exposed} of ${users.length} users`]),
      ]),
    ]),
    el('h3', { class: 'section-title' }, [`Traffic, last ${metrics.window}`]),
    el('dl', { class: 'stats' }, [
      stat('Requests', formatCount(totals.requests)),
      stat('Errors', formatCount(totals.errors)),
      stat('Error rate', formatRate(rate)),
    ]),
    el('div', { class: 'details-health' }, [
      healthPill(health(rate)),
      el('span', { class: 'muted' }, [`Degraded at ${formatRate(DEGRADED_THRESHOLD)} or more`]),
    ]),
    ...comparisonSection(flag.key),
  );
}

function renderSummary(): void {
  const enabled = state.flags.filter((f) => f.enabled).length;
  const degraded = state.flags.filter((f) => health(rateFor(f.key)) === 'degraded').length;
  const atRisk = state.flags.filter((f) => compareGroups(metricsFor(f.key)).canaryAtRisk).length;
  byId('summary').textContent =
    `${state.flags.length} flags, ${enabled} enabled, ${degraded} degraded, ${atRisk} canary at risk`;
}

function renderRows(): void {
  byId('flag-rows').replaceChildren(...state.flags.map(flagRow));
}

function syncRows(): void {
  for (const row of byId('flag-rows').querySelectorAll<HTMLTableRowElement>('tr')) {
    const key = row.dataset.key;
    const flag = state.flags.find((f) => f.key === key);
    if (!flag) continue;
    const selected = key === state.selectedKey;
    row.classList.toggle('is-selected', selected);
    row.querySelector('[data-select]')?.setAttribute('aria-current', String(selected));
    row.querySelector('[data-toggle]')?.setAttribute('aria-checked', String(flag.enabled));
  }
}

function update(): void {
  syncRows();
  renderSummary();
  renderDetails();
}

byId('flag-rows').addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const toggle = target.closest<HTMLElement>('[data-toggle]');
  if (toggle?.dataset.toggle) {
    const key = toggle.dataset.toggle;
    const current = state.flags.find((f) => f.key === key);
    state.flags = setEnabled(state.flags, key, !current?.enabled);
    state.selectedKey = key;
    update();
    return;
  }
  const row = target.closest<HTMLTableRowElement>('tr[data-key]');
  if (row?.dataset.key) {
    state.selectedKey = row.dataset.key;
    update();
  }
});

byId('window-label').textContent = `Metrics: last ${metrics.window}`;
renderRows();
update();
