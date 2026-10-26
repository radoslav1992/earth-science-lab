// Renders public/og-image.png (1200×630) from an HTML card with Playwright: `npm run og-image`.
// Playwright is not a project dependency. The script uses an installed copy (`npx playwright install chromium`
// or a preinstalled one); set PLAYWRIGHT_MODULE / CHROMIUM_PATH to point at a specific install.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { STATIONS, TOWNS, COAST, GUIDED, readings, picked } from '../src/lib/seismology.mjs';
import { site } from '../src/lib/site.mjs';

const require = createRequire(import.meta.url);
const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
let chromium;
for (const name of candidates) { try { ({ chromium } = require(name)); break; } catch {} }
if (!chromium) throw new Error('Playwright not found. Install it (npx playwright install chromium) or set PLAYWRIGHT_MODULE.');
const executablePath = process.env.CHROMIUM_PATH ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const circles = readings(GUIDED).map(r => ({ ...r.station, r: picked(r).km }));
const q = GUIDED.quake;
const star = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 8 : 18;
  return `${i ? 'L' : 'M'}${(q.x + rr * Math.cos(a)).toFixed(1)} ${(q.y + rr * Math.sin(a)).toFixed(1)}`;
}).join('') + 'Z';
const coast = COAST.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
const grid = [100, 200, 300, 400, 500].map(x => `<line x1="${x}" y1="0" x2="${x}" y2="400" stroke="#d9c9ac"/>`).join('') +
  [100, 200, 300].map(y => `<line x1="0" y1="${y}" x2="600" y2="${y}" stroke="#d9c9ac"/>`).join('');
const map = `<svg viewBox="0 0 600 400" width="564" height="376" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="400" fill="#efe3cc"/>${grid}
  <path d="${coast} L600 400 L600 0Z" fill="#cfe2df"/><path d="${coast}" fill="none" stroke="#5d8f93" stroke-width="2.5" stroke-linejoin="round"/>
  ${TOWNS.map(t => `<circle cx="${t.x}" cy="${t.y}" r="4.5" fill="#fff" stroke="#2a2724" stroke-width="1.5"/>`).join('')}
  ${circles.map(c => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${c.color}" fill-opacity=".08" stroke="${c.color}" stroke-width="4"/>`).join('')}
  ${STATIONS.map(s => `<path d="M${s.x} ${s.y - 15} L${s.x + 13} ${s.y + 9} L${s.x - 13} ${s.y + 9}Z" fill="${s.color}" stroke="#fff" stroke-width="2"/>`).join('')}
  <path d="${star}" fill="#b4502b" stroke="#fff" stroke-width="2.5"/>
</svg>`;
const trace = (() => {
  let d = '', w = 0, seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let x = 0; x <= 420; x += 1.5) {
    const t = x / 420 * 100, env = 0.04 + (t > 22 ? 0.3 * Math.exp(-(t - 22) / 8) : 0) + (t > 38 ? Math.exp(-(t - 38) / 14) : 0);
    w = 0.55 * w + 0.45 * rand();
    d += `${x ? 'L' : 'M'}${x.toFixed(1)} ${(30 - env * w * 52).toFixed(1)}`;
  }
  return `<svg viewBox="0 0 420 60" width="420" height="60"><path d="${d}" fill="none" stroke="#f6efe3" stroke-width="1.6"/></svg>`;
})();

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bitter:wght@700&family=DM+Sans:wght@500;700&display=block" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;background:#f6efe3;font-family:'DM Sans',system-ui,sans-serif;color:#2a2724;display:grid;grid-template-columns:540px 1fr;overflow:hidden}
  .left{background:#2a2724;color:#f6efe3;padding:58px 52px;display:flex;flex-direction:column;justify-content:space-between;position:relative}
  .brand{display:flex;align-items:center;gap:14px;font:700 30px 'Bitter',Georgia,serif}
  .brand b{color:#f0b48f}
  h1{font:700 54px/1.08 'Bitter',Georgia,serif;letter-spacing:-.01em}
  .tool{font-size:24px;color:#e6dccb;margin-top:22px;line-height:1.35}
  .tool strong{color:#f0b48f}
  .url{font-size:21px;color:#cfc4b2;font-weight:500}
  .right{display:flex;align-items:center;justify-content:center;padding:30px}
  .card{background:#fffaf2;border:2px solid #ddd0bd;border-radius:24px;padding:14px;box-shadow:0 14px 40px rgba(42,39,36,.14)}
  .card svg{display:block;border-radius:14px}
  .strata{position:absolute;left:0;right:0;bottom:0;height:16px;background:linear-gradient(#b4502b 0 50%,#e2c9a4 50% 100%)}
</style></head><body>
<div class="left">
  <div class="brand"><img src="data:image/svg+xml;base64,${fs.readFileSync(new URL('../public/favicon.svg', import.meta.url)).toString('base64')}" width="56" height="56">Earth Science <b>Lab</b></div>
  <div><h1>${site.tagline}</h1><p class="tool">Free interactive labs. Start with the <strong>Earthquake Epicenter Finder</strong>: read seismograms, triangulate the quake.</p></div>
  <div>${trace}<p class="url">earthsciencelab.org</p></div>
  <div class="strata"></div>
</div>
<div class="right"><div class="card">${map}</div></div>
</body></html>`;

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' }).catch(() => page.setContent(html));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL('../public/og-image.png', import.meta.url).pathname });
await browser.close();
console.log('Wrote public/og-image.png (1200×630).');
