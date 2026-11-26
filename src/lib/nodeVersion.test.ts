import { describe, expect, it } from 'vitest';
import readme from '../../README.md?raw';
import { checkNodeVersion } from '../../scripts/check-node-version.mjs';

describe('checkNodeVersion', () => {
  it('AC1: accepts Node 22 and 24', () => {
    expect(checkNodeVersion('22.12.0').ok).toBe(true);
    expect(checkNodeVersion('v24.1.0').ok).toBe(true);
  });

  it('AC2: rejects any other major version', () => {
    for (const version of ['20.19.0', '23.5.0', 'v26.9.0']) {
      expect(checkNodeVersion(version).ok).toBe(false);
    }
  });

  it('AC2: the message names the running version and the supported ones', () => {
    const { message } = checkNodeVersion('v26.9.0');
    expect(message).toContain('26.9.0');
    expect(message).toContain('22 or 24');
  });
});

describe('README', () => {
  it('AC3: says which Node versions are supported', () => {
    expect(readme).toContain('Requires Node 22 or 24');
  });
});
