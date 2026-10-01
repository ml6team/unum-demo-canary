import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/unum-demo-canary/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
