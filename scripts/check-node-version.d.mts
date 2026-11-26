export const SUPPORTED_NODE_MAJORS: readonly number[];
export function checkNodeVersion(version: string): { ok: boolean; message: string };
