import type { Flag, MetricsSnapshot, User } from '../lib/types';
import flagsJson from './flags.json';
import metricsJson from './metrics.json';
import usersJson from './users.json';

export const flags: Flag[] = flagsJson;
export const users = usersJson as User[];
export const metrics: MetricsSnapshot = metricsJson;
