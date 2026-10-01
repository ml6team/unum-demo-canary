export interface Flag {
  key: string;
  description: string;
  owner: string;
  enabled: boolean;
  /** ISO date, YYYY-MM-DD. */
  createdAt: string;
}

export type Plan = 'free' | 'pro' | 'team' | 'enterprise';

export interface User {
  id: string;
  plan: Plan;
}

export interface Counts {
  requests: number;
  errors: number;
}

/** Traffic for one flag, split by rollout group. */
export interface FlagMetrics {
  canary: Counts;
  baseline: Counts;
}

export interface MetricsSnapshot {
  window: string;
  flags: Record<string, FlagMetrics>;
}
