import type { Incident, Service } from '../lib/types';
import incidentsJson from './incidents.json';
import servicesJson from './services.json';

/** The fixed current time of the page, so the fixtures read the same on any date. */
export const NOW = new Date('2026-10-01T12:00:00Z');

export const services = servicesJson as Service[];
export const incidents = incidentsJson as Incident[];

/** The public URL of the page; the feed's links are built from it. */
export const SITE_URL = 'https://ml6team.github.io/unum-demo-canary/';
