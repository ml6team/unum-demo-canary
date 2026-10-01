import type { Flag, User } from './types';

export function isEnabled(flag: Flag, _userId: string): boolean {
  return flag.enabled;
}

export function exposedUsers(flag: Flag, users: readonly User[]): number {
  return users.filter((user) => isEnabled(flag, user.id)).length;
}

export function setEnabled(flags: readonly Flag[], key: string, enabled: boolean): Flag[] {
  return flags.map((flag) => (flag.key === key ? { ...flag, enabled } : flag));
}
