import { describe, expect, it } from 'vitest';
import { compareSeverity, overallStatus, STATUS_LABEL, UPDATE_LABEL, worstStatus } from './status';
import type { Service, ServiceStatus } from './types';

function service(id: string, status: ServiceStatus): Service {
  return { id, name: id, description: '', status };
}

describe('worstStatus', () => {
  it('is operational for no statuses', () => {
    expect(worstStatus([])).toBe('operational');
  });

  it('picks the most severe status', () => {
    expect(worstStatus(['degraded', 'major-outage', 'partial-outage'])).toBe('major-outage');
    expect(worstStatus(['operational', 'degraded'])).toBe('degraded');
  });
});

describe('compareSeverity', () => {
  it('orders operational < degraded < partial < major', () => {
    const sorted: ServiceStatus[] = ['major-outage', 'operational', 'partial-outage', 'degraded'];
    sorted.sort(compareSeverity);
    expect(sorted).toEqual(['operational', 'degraded', 'partial-outage', 'major-outage']);
  });
});

describe('overallStatus', () => {
  it('reports all systems operational when every service is', () => {
    const result = overallStatus([service('api', 'operational'), service('web', 'operational')]);
    expect(result).toEqual({
      status: 'operational',
      title: 'All systems operational',
      affected: [],
    });
  });

  it('reports the worst current status and the affected services', () => {
    const result = overallStatus([
      service('api', 'degraded'),
      service('web', 'operational'),
      service('search', 'partial-outage'),
    ]);
    expect(result.status).toBe('partial-outage');
    expect(result.title).toBe('Partial system outage');
    expect(result.affected.map((s) => s.id)).toEqual(['api', 'search']);
  });

  it('reports a major outage', () => {
    expect(overallStatus([service('api', 'major-outage')]).title).toBe('Major system outage');
  });

  it('reports degraded performance', () => {
    expect(overallStatus([service('api', 'degraded')]).title).toBe(
      'Some systems are experiencing degraded performance',
    );
  });
});

describe('STATUS_LABEL', () => {
  it('has a human label for every status', () => {
    expect(STATUS_LABEL['partial-outage']).toBe('Partial outage');
  });
});

describe('UPDATE_LABEL', () => {
  it('labels incident and maintenance updates', () => {
    expect(UPDATE_LABEL.investigating).toBe('Investigating');
    expect(UPDATE_LABEL['in-progress']).toBe('In progress');
  });
});
