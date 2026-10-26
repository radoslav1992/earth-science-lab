// Post-build checks on dist/: run `npm run build && npm run check`.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { activities } from '../src/lib/activities.mjs';
import { site } from '../src/lib/site.mjs';

const root = path.resolve('dist');
const pages = fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('.html'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const titles = new Map();
const h1s = new Map();
let links = 0, structured = 0;

for (const file of pages) {
  const html = read(file);
  const h1 = [...html.matchAll(/<h1[\s>][\s\S]*?<\/h1>/g)];
  assert.equal(h1.length, 1, `${file}: exactly one H1`);
  const h1Text = h1[0][0].replace(/<[^>]+>/g, '').trim();
  assert.ok(!h1s.has(h1Text), `${file}: H1 "${h1Text}" also used on ${h1s.get(h1Text)}`);
  h1s.set(h1Text, file);

  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  assert.ok(title, `${file}: title`);
  assert.ok(!titles.has(title), `${file}: title "${title}" also used on ${titles.get(title)}`);
  titles.set(title, file);
  assert.match(html, /<meta name="description" content="[^"]{50,}"/, `${file}: meta description`);
  assert.match(html, /<link rel="canonical" href="https:\/\/earthsciencelab\.org\//, `${file}: canonical`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, `${file}: duplicate IDs`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    const data = JSON.parse(m[1]);
    assert.equal(data['@context'], 'https://schema.org', `${file}: JSON-LD context`);
    structured++;
  }
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const target = decodeURIComponent(m[1]);
    if (target.startsWith('//')) continue;
    const resolved = path.join(root, target);
    assert.ok(fs.existsSync(resolved) && (!fs.statSync(resolved).isDirectory() || fs.existsSync(path.join(resolved, 'index.html'))), `${file}: broken link ${target}`);
    links++;
  }
  assert.ok(!/NaN|undefined/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), `${file}: NaN or undefined in rendered text`);
  // The Google tag renders only once an analytics ID is configured; the consent defaults always run.
  assert.equal(html.includes('googletagmanager.com/gtag/js'), Boolean(site.analyticsId), `${file}: Google tag must match site.analyticsId`);
  assert.ok(html.includes("gtag('consent', 'default'"), `${file}: consent defaults`);
}

// Teacher answer keys: noindex, ad-free, out of the sitemap. The teacher hub is ad-free too.
const keys = pages.filter(file => file.startsWith(`teachers${path.sep}answers${path.sep}`));
assert.equal(keys.length, activities.length, 'one answer key per activity');
for (const file of [...keys, path.join('teachers', 'index.html')]) {
  const html = read(file);
  if (keys.includes(file)) assert.match(html, /<meta name="robots" content="noindex"/, `${file}: noindex`);
  assert.ok(!html.includes('class="ad-slot'), `${file}: ads`);
}
assert.match(read('404.html'), /<meta name="robots" content="noindex"/, '404: noindex');
const sitemap = fs.readFileSync(path.join(root, 'sitemap-0.xml'), 'utf8');
assert.ok(!sitemap.includes('/teachers/answers/'), 'answer keys must stay out of the sitemap');
assert.ok(!sitemap.includes('/404'), '404 must stay out of the sitemap');
for (const page of ['/', '/tools/earthquake-epicenter/', '/tools/earthquake-epicenter/activity/', '/teachers/', '/about/', '/privacy/']) {
  assert.ok(sitemap.includes(`<loc>https://earthsciencelab.org${page}</loc>`), `sitemap lists ${page}`);
}
for (const file of ['robots.txt', 'llms.txt', 'favicon.svg', 'og-image.png', '_headers']) assert.ok(fs.existsSync(path.join(root, file)), `dist/${file}`);

console.log(`Verified ${pages.length} pages: unique titles and H1s, ${structured} JSON-LD blocks, unique IDs, ${links} local links/assets; answer keys noindex, ad-free and out of the sitemap.`);
