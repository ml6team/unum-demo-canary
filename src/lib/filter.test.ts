import { describe, expect, it } from 'vitest';
import { searchWithService, serviceFromSearch } from './filter';
import type { Service } from './types';

const services: Service[] = [
  { id: 'api', name: 'API', description: '', status: 'operational' },
  { id: 'web', name: 'Web app', description: '', status: 'operational' },
];

describe('serviceFromSearch', () => {
  it('AC4: reads a known service id', () => {
    expect(serviceFromSearch('?service=api', services)).toBe('api');
  });

  it('AC5: an unknown service reads as all services', () => {
    expect(serviceFromSearch('?service=nope', services)).toBeNull();
  });

  it('AC5: an empty or missing service reads as all services', () => {
    expect(serviceFromSearch('?service=', services)).toBeNull();
    expect(serviceFromSearch('', services)).toBeNull();
    expect(serviceFromSearch('?other=1', services)).toBeNull();
  });
});

describe('searchWithService', () => {
  it('AC4: sets the service and keeps other parameters', () => {
    expect(searchWithService('?a=1', 'web')).toBe('?a=1&service=web');
  });

  it('AC4: replaces an existing service', () => {
    expect(searchWithService('?service=api', 'web')).toBe('?service=web');
  });

  it('AC2: null removes the service and gives an empty string when nothing is left', () => {
    expect(searchWithService('?service=api', null)).toBe('');
    expect(searchWithService('?a=1&service=api', null)).toBe('?a=1');
  });

  it('AC4: a set-then-read round trip returns the same id', () => {
    expect(serviceFromSearch(searchWithService('', 'web'), services)).toBe('web');
  });
});
