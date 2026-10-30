import type { Plugin } from 'vite';
import { incidents, NOW, services } from './src/data/index';
import { buildAtomFeed } from './src/lib/feed';

export function feedPlugin(options: { pageUrl: string }): Plugin {
  return {
    name: 'vite-plugin-feed',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'feed.xml',
        source: buildAtomFeed(incidents, services, NOW, options.pageUrl),
      });
    },
  };
}
