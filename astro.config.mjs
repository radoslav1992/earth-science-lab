import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/lib/site.mjs';

export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  // Teacher answer keys are noindex and stay out of the sitemap, like the 404 page.
  integrations: [sitemap({ filter: page => !/\/404(?:\/|\.html)?$/.test(page) && !page.includes('/teachers/answers/') })],
  vite: { server: { allowedHosts: ['terminal.local'] } },
});
