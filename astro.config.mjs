import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/lib/site.mjs';
import { isIndexable } from './src/lib/indexing.mjs';

export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  // The sitemap lists only indexable pages: the 404 page, teacher answer keys and printable activities are noindex
  // (src/lib/indexing.mjs explains why).
  integrations: [sitemap({ filter: isIndexable })],
  vite: { server: { allowedHosts: ['terminal.local'] } },
});
