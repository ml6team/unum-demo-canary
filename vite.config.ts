import { defineConfig } from 'vitest/config';
import { feedPlugin } from './vite-plugin-feed';

export default defineConfig({
  base: '/unum-demo-canary/',
  plugins: [feedPlugin({ pageUrl: 'https://ml6team.github.io/unum-demo-canary/' })],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
