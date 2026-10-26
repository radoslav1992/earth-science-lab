import type { APIRoute } from 'astro';

// Teacher answer keys are not disallowed here on purpose: crawlers must be able to fetch them to see their noindex tag.
export const GET: APIRoute = ({ site }) => new Response(
  `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', site).href}\n`,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
