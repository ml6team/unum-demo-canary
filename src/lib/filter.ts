import type { Service } from './types';

const PARAM = 'service';

/** The `service` query parameter when it is the id of a known service, else null. */
export function serviceFromSearch(search: string, services: Service[]): string | null {
  const value = new URLSearchParams(search).get(PARAM);
  if (value === null || value === '') return null;
  return services.some((s) => s.id === value) ? value : null;
}

/** The query string with `service` set, or removed for null; other parameters are kept. */
export function searchWithService(search: string, serviceId: string | null): string {
  const params = new URLSearchParams(search);
  if (serviceId === null) params.delete(PARAM);
  else params.set(PARAM, serviceId);
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
