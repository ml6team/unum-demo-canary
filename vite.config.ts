import { defineConfig, type Plugin } from 'vitest/config';
import { incidents, NOW, SITE_URL, services } from './src/data';
import { buildAtomFeed } from './src/lib/feed';

/** Writes feed.xml next to the page in every production build. */
function atomFeed(): Plugin {
  return {
    name: 'atom-feed',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'feed.xml',
        source: buildAtomFeed(incidents, services, NOW, SITE_URL),
      });
    },
  };
}

export default defineConfig({
  base: '/unum-demo-canary/',
  plugins: [atomFeed()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
