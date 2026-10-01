import { describe, expect, it } from 'vitest';
import { exposedUsers, isEnabled, setEnabled } from './flags';
import type { Flag, User } from './types';

const flag = (overrides: Partial<Flag> = {}): Flag => ({
  key: 'search-v2',
  description: 'Search',
  owner: 'Discovery',
  enabled: true,
  createdAt: '2026-08-12',
  ...overrides,
});

const users: User[] = [
  { id: 'user-000', plan: 'free' },
  { id: 'user-001', plan: 'pro' },
  { id: 'user-002', plan: 'team' },
];

describe('isEnabled', () => {
  it('returns true for every user when the flag is on', () => {
    expect(users.every((u) => isEnabled(flag({ enabled: true }), u.id))).toBe(true);
  });

  it('returns false for every user when the flag is off', () => {
    expect(users.some((u) => isEnabled(flag({ enabled: false }), u.id))).toBe(false);
  });
});

describe('exposedUsers', () => {
  it('counts all users for an enabled flag', () => {
    expect(exposedUsers(flag({ enabled: true }), users)).toBe(3);
  });

  it('counts no users for a disabled flag', () => {
    expect(exposedUsers(flag({ enabled: false }), users)).toBe(0);
  });

  it('handles an empty user list', () => {
    expect(exposedUsers(flag(), [])).toBe(0);
  });
});

describe('setEnabled', () => {
  const flags = [flag({ key: 'a', enabled: false }), flag({ key: 'b', enabled: true })];

  it('updates only the matching flag', () => {
    const next = setEnabled(flags, 'a', true);
    expect(next.map((f) => f.enabled)).toEqual([true, true]);
  });

  it('does not mutate the input', () => {
    setEnabled(flags, 'a', true);
    expect(flags[0]?.enabled).toBe(false);
  });

  it('returns an equal list for an unknown key', () => {
    expect(setEnabled(flags, 'missing', true)).toEqual(flags);
  });
});
