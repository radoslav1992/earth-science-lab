// SVG markup for the topographic map and the cross-section chart, shared by the server-rendered map
// (no JavaScript, worksheet, answer key) and the browser, so both draw exactly the same thing.
// Map units: 1 unit = 10 m, so the 6 km × 4 km map is 600 × 400.
import { WIDTH, HEIGHT, sample, slopeAt, summits, pits, riverPath, presetById, range } from './terrain.mjs';
import { contourMap, regionRings, hachures, labelSpots, contains, pathData, levelsFor } from './contours.mjs';
import { rampColor, rgb } from './relief.mjs';

export const SCALE = 0.1;
export const MAP_W = WIDTH * SCALE;
export const MAP_H = HEIGHT * SCALE;
export const OVERLAYS = ['steep', 'vrule', 'hills', 'index'];
export const STEEP_DEGREES = 15;

const f1 = v => (v * SCALE).toFixed(1);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Runs of a contour line where the ground is steeper than STEEP_DEGREES, as polylines. */
function steepRuns(t, line) {
  const p = line.points, runs = [];
  let run = null;
  const n = p.length / 2;
  for (let k = 0; k < n + (line.closed ? 1 : 0); k++) {
    const m = k % n, steep = slopeAt(t, p[2 * m], p[2 * m + 1]).degrees >= STEEP_DEGREES;
    if (steep) { if (!run) runs.push((run = [])); run.push(p[2 * m], p[2 * m + 1]); }
    else run = null;
  }
  return runs.filter(r => r.length >= 4);
}

/** Where the river crosses each contour level, from its upstream end: [{ x, y, level }]. */
export function riverCrossings(t, river, levels) {
  const out = [];
  for (let k = 1; k < river.length; k++) {
    const [p, q] = [river[k - 1], river[k]], hp = sample(t, p[0], p[1]), hq = sample(t, q[0], q[1]);
    for (const level of levels) {
      if ((hp - level) * (hq - level) < 0) {
        const f = (level - hp) / (hq - hp);
        out.push({ x: p[0] + (q[0] - p[0]) * f, y: p[1] + (q[1] - p[1]) * f, level });
      }
    }
  }
  return out;
}

function arrowsAlong(points, every = 750) {
  let d = '', walked = every / 2;
  for (let k = 1; k < points.length; k++) {
    const [p, q] = [points[k - 1], points[k]], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (!len) continue;
    while (walked <= len) {
      const f = walked / len, x = p[0] + (q[0] - p[0]) * f, y = p[1] + (q[1] - p[1]) * f;
      const ux = (q[0] - p[0]) / len, uy = (q[1] - p[1]) / len, s = 70;
      d += `M${f1(x - ux * s + uy * s * 0.7)} ${f1(y - uy * s - ux * s * 0.7)}L${f1(x)} ${f1(y)}L${f1(x - ux * s - uy * s * 0.7)} ${f1(y - uy * s + ux * s * 0.7)}`;
      walked += every;
    }
    walked -= len;
  }
  return d;
}

/**
 * The map's layers as markup strings. options: interval, seaLevel, overlays (names from OVERLAYS),
 * river (draw the preset's river), arrows (flow arrows even without the V-rule overlay).
 */
export function mapLayers(t, { interval = 20, seaLevel = 0, overlays = ['index'], river = true, arrows = false } = {}) {
  const on = new Set(overlays), map = contourMap(t, { interval, seaLevel });
  const indexOn = on.has('index');
  const layers = { water: '', under: '', lines: '', river: '', labels: '', over: '' };

  if (map.span.min < seaLevel) layers.water = `<path class="cm-water" fill-rule="evenodd" d="${pathData(regionRings(t, seaLevel, true))}"/>`;

  const plain = map.lines.filter(l => !(indexOn && l.index)), bold = map.lines.filter(l => indexOn && l.index);
  const ticks = map.lines.filter(l => l.depression).flatMap(l => hachures(l));
  layers.lines = `<path class="cm-line" d="${pathData(plain)}"/>`
    + (bold.length ? `<path class="cm-line cm-index" d="${pathData(bold)}"/>` : '')
    + (ticks.length ? `<path class="cm-hachure" d="${pathData(ticks)}"/>` : '')
    + (map.coast.length ? `<path class="cm-coast" d="${pathData(map.coast)}"/>` : '');

  if (indexOn) {
    layers.labels = bold.flatMap(line => labelSpots(line).map(s =>
      `<text class="cm-label" x="${f1(s.x)}" y="${f1(s.y)}" transform="rotate(${s.angle.toFixed(0)} ${f1(s.x)} ${f1(s.y)})">${line.level}</text>`)).join('');
  }

  if (on.has('steep')) {
    const runs = map.lines.flatMap(l => steepRuns(t, l));
    if (runs.length) layers.under += `<path class="cm-steep" d="${pathData(runs)}"/>`;
  }

  if (on.has('hills')) {
    const loops = map.lines.filter(l => l.closed);
    layers.under += loops.map(l => `<path class="${l.depression ? 'cm-hollow-fill' : 'cm-hill-fill'}" d="${pathData([l])}"/>`).join('');
    const hillLoops = loops.filter(l => !l.depression), hollowLoops = loops.filter(l => l.depression);
    for (const s of summits(t, { above: seaLevel })) {
      if (!hillLoops.some(l => contains(l, s.x, s.y))) continue;
      const x = s.x * SCALE, y = s.y * SCALE;
      layers.over += `<g class="cm-summit"><path d="M${x.toFixed(1)} ${(y - 6).toFixed(1)}l5.5 9h-11z"/><text x="${(x + 8).toFixed(1)}" y="${(y + 4).toFixed(1)}">${Math.round(s.h)} m</text></g>`;
    }
    for (const s of pits(t, { above: seaLevel })) {
      if (!hollowLoops.some(l => contains(l, s.x, s.y))) continue;
      const x = s.x * SCALE, y = s.y * SCALE;
      layers.over += `<g class="cm-pit"><path d="M${(x - 4).toFixed(1)} ${(y - 4).toFixed(1)}l8 8m0 -8l-8 8"/><text x="${(x + 8).toFixed(1)}" y="${(y + 4).toFixed(1)}">${Math.round(s.h)} m</text></g>`;
    }
  }

  const preset = presetById(t.preset);
  const path = river && preset.river ? riverPath(t, preset.river, seaLevel) : [];
  if (path.length > 1) {
    layers.river = `<path class="cm-river" d="${pathData([path.flat()])}"/>`;
    if (on.has('vrule') || arrows) layers.river += `<path class="cm-flow" d="${arrowsAlong(path)}"/>`;
    if (on.has('vrule')) {
      const levels = levelsFor(map.span, interval, seaLevel);
      layers.over += riverCrossings(t, path, levels).map(c => `<circle class="cm-vtip" cx="${f1(c.x)}" cy="${f1(c.y)}" r="5"/>`).join('');
    }
  }
  return layers;
}

/** North arrow and a 1 km scale bar. */
export const FURNITURE = `<g class="cm-furniture" aria-hidden="true">`
  + `<g transform="translate(22 32)"><path class="cm-north" d="M0 -17L7 6L0 1L-7 6Z"/><text x="0" y="20" text-anchor="middle">N</text></g>`
  + `<g transform="translate(14 384)"><rect class="cm-scale-back" x="-6" y="-17" width="124" height="27" rx="4"/><rect class="cm-scale" width="50" height="6"/><rect class="cm-scale alt" x="50" width="50" height="6"/>`
  + `<text x="0" y="-5">0</text><text x="50" y="-5" text-anchor="middle">500</text><text x="100" y="-5" text-anchor="middle">1 km</text></g></g>`;

/** Labelled points and an optional A–B line, for worksheets and challenges. marks: [{ x, y, label }] (meters). */
export function marksMarkup(marks = [], line = null) {
  let out = '';
  if (line) out += sectionMarkup(line.a, line.b, line.labels);
  for (const m of marks) {
    const x = m.x * SCALE, y = m.y * SCALE, dx = m.dx ?? 9, anchor = dx < 0 ? 'end' : 'start';
    out += `<g class="cm-mark"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"/><text x="${(x + dx).toFixed(1)}" y="${(y + (m.dy ?? -6)).toFixed(1)}" text-anchor="${anchor}">${esc(m.label)}</text></g>`;
  }
  return out;
}

/** The cross-section line A–B on the map. */
export function sectionMarkup(a, b, labels = ['A', 'B']) {
  const [ax, ay, bx, by] = [a.x, a.y, b.x, b.y].map(v => (v * SCALE).toFixed(1));
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  const lab = (x, y, s, text) => `<text x="${(x * SCALE + s * ux * 13).toFixed(1)}" y="${(y * SCALE + s * uy * 13 + 5).toFixed(1)}" text-anchor="middle">${text}</text>`;
  return `<g class="cm-section"><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/><circle cx="${ax}" cy="${ay}" r="4.5"/><circle cx="${bx}" cy="${by}" r="4.5"/>${lab(a.x, a.y, -1, labels[0])}${lab(b.x, b.y, 1, labels[1])}</g>`;
}

/** A complete map SVG. options: those of mapLayers plus label, className, marks, line, interactive. */
export function mapSvg(t, options = {}) {
  const layers = mapLayers(t, options);
  const attrs = options.interactive
    ? `role="application" tabindex="0" data-map aria-label="${esc(options.label ?? 'Topographic map')}"`
    : `role="img" aria-label="${esc(options.label ?? 'Topographic map')}"`;
  return `<svg class="cmap ${options.className ?? ''}" viewBox="0 0 ${MAP_W} ${MAP_H}" ${attrs}>`
    + `<rect class="cm-land" width="${MAP_W}" height="${MAP_H}"/>`
    + `<g data-layer="water">${layers.water}</g><g data-layer="under">${layers.under}</g><g data-layer="lines">${layers.lines}</g>`
    + `<g data-layer="river">${layers.river}</g><g data-layer="labels">${layers.labels}</g><g data-layer="over">${layers.over}</g>`
    + FURNITURE
    + `<g data-layer="marks">${marksMarkup(options.marks, options.line)}</g><g data-layer="cursor"></g>`
    + `<rect class="cm-frame" width="${MAP_W}" height="${MAP_H}"/></svg>`;
}

/** Layered height tints (no hillshade): the landscape view's fallback without JavaScript. */
export function tintSvg(t, { seaLevel = 0, step = 50, label = 'Landscape colored by height' } = {}) {
  const { min, max } = range(t);
  let body = `<rect width="${MAP_W}" height="${MAP_H}" fill="${rgb(rampColor(Math.max(min, seaLevel)))}"/>`;
  for (let level = Math.ceil(Math.max(min, seaLevel) / step) * step; level <= max; level += step) {
    body += `<path fill="${rgb(rampColor(level + step / 2))}" fill-rule="evenodd" d="${pathData(regionRings(t, level, false))}"/>`;
  }
  if (min < seaLevel) body += `<path class="cm-water" fill-rule="evenodd" d="${pathData(regionRings(t, seaLevel, true))}"/>`;
  return `<svg class="cm-tints" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
}

/** Round numbers for chart axes. */
function niceStep(span, target = 5) {
  const raw = span / target, mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

export const PROFILE_BOX = { width: 600, height: 236, left: 54, right: 14, top: 32, bottom: 46 };

/**
 * The cross-section chart: elevation against distance from A, with axes, sea, the highest and lowest
 * points labeled and the vertical exaggeration stated. Returns { svg, stats }.
 */
export function profileSvg(points, { seaLevel = 0, labels = ['A', 'B'], label = 'Cross-section', className = '' } = {}) {
  const { width: W, height: H, left, right, top, bottom } = PROFILE_BOX;
  const pw = W - left - right, ph = H - top - bottom, length = points[points.length - 1].d || 1;
  let high = points[0], low = points[0];
  for (const p of points) { if (p.h > high.h) high = p; if (p.h < low.h) low = p; }
  // Axis from a round number below the lowest point to one above the highest, with room for the labels.
  const step = niceStep(Math.max(40, high.h - low.h), 4);
  const y0 = Math.floor(low.h / step) * step - (low.h - Math.floor(low.h / step) * step < step * 0.5 ? step : 0);
  const y1 = Math.ceil(high.h / step) * step + (Math.ceil(high.h / step) * step - high.h < step * 0.5 ? step : 0);
  const sx = d => left + (d / length) * pw, sy = h => top + ((y1 - h) / (y1 - y0)) * ph;
  const ve = (ph / (y1 - y0)) / (pw / length);
  const xStep = niceStep(length / 1000, 5) * 1000;
  let grid = '', axis = '';
  for (let v = y0; v <= y1 + 1e-6; v += step) {
    grid += `<line class="cs-grid" x1="${left}" x2="${W - right}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/>`;
    axis += `<text class="cs-tick" x="${left - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end">${Math.round(v)}</text>`;
  }
  for (let d = 0; d <= length + 1e-6; d += xStep) {
    axis += `<text class="cs-tick" x="${sx(d).toFixed(1)}" y="${H - bottom + 16}" text-anchor="middle">${(d / 1000).toFixed(xStep < 1000 ? 1 : 0)}</text>`;
  }
  const line = points.map((p, k) => `${k ? 'L' : 'M'}${sx(p.d).toFixed(1)} ${sy(p.h).toFixed(1)}`).join('');
  const ground = `${line}L${sx(length).toFixed(1)} ${top + ph}L${left} ${top + ph}Z`;
  let sea = '';
  if (low.h < seaLevel) {
    const waterTop = sy(Math.min(seaLevel, y1));
    sea = `<rect class="cs-sea" x="${left}" y="${waterTop.toFixed(1)}" width="${pw}" height="${(top + ph - waterTop).toFixed(1)}"/>`;
  }
  const mark = (p, cls, text, above) => {
    const x = sx(p.d), y = sy(p.h), anchor = x < left + 70 ? 'start' : x > W - right - 70 ? 'end' : 'middle';
    return `<g class="${cls}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/><text x="${x.toFixed(1)}" y="${(y + (above ? -9 : 17)).toFixed(1)}" text-anchor="${anchor}">${text}</text></g>`;
  };
  const svg = `<svg class="cs-chart ${className}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`
    + grid + sea
    + `<path class="cs-ground" d="${ground}"/><path class="cs-line" d="${line}"/>`
    + `<line class="cs-axis" x1="${left}" x2="${left}" y1="${top}" y2="${top + ph}"/><line class="cs-axis" x1="${left}" x2="${W - right}" y1="${top + ph}" y2="${top + ph}"/>`
    + axis
    + `<text class="cs-title" x="${left - 40}" y="18">Elevation (m)</text>`
    + `<text class="cs-title" x="${left + pw / 2}" y="${H - 4}" text-anchor="middle">Distance from ${labels[0]} (km)</text>`
    + `<text class="cs-end" x="${left}" y="${H - 3}">${labels[0]}</text><text class="cs-end" x="${W - right}" y="${H - 3}" text-anchor="end">${labels[1]}</text>`
    + `<text class="cs-ve" x="${W - right}" y="18" text-anchor="end">Vertical exaggeration ×${ve.toFixed(1)}</text>`
    + mark(low, 'cs-low', `Lowest ${Math.round(low.h)} m`, true)
    + mark(high, 'cs-high', `Highest ${Math.round(high.h)} m`, true)
    + `</svg>`;
  return { svg, stats: { length, high, low, ve } };
}

const km = m => `${(m / 1000).toFixed(1)} km`;

/** One or two sentences about a cross-section, for screen readers and the caption under the chart. */
export function describeProfile({ length, high, low, ve }, from = 'A', to = 'B') {
  const where = p => (p.d < 50 ? `at ${from}` : length - p.d < 50 ? `at ${to}` : `${km(p.d)} from ${from}`);
  const scale = ve >= 1.05
    ? `Heights are stretched ×${ve.toFixed(1)} (vertical exaggeration) so the shape is easy to see.`
    : `Heights are drawn at ×${ve.toFixed(1)} (vertical exaggeration), close to their true scale.`;
  return `${from} to ${to} is ${km(length)} long. The highest point is ${Math.round(high.h)} m, ${where(high)}; the lowest is ${Math.round(low.h)} m, ${where(low)}. ${scale}`;
}

/** An empty elevation grid for students to sketch a cross-section on (worksheet question). */
export function sketchSvg({ length, min, max, step = 20, labelEvery = 100, labels = ['A', 'B'] }) {
  const { width: W, left, right, top } = PROFILE_BOX, H = 190, bottom = 30;
  const pw = W - left - right, ph = H - top - bottom;
  const sx = d => left + (d / length) * pw, sy = h => top + ((max - h) / (max - min)) * ph;
  let out = '';
  for (let v = min; v <= max + 1e-6; v += step) {
    out += `<line class="cs-grid" x1="${left}" x2="${W - right}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"${v % labelEvery === 0 ? ' stroke-width="1.6"' : ''}/>`;
    if (v % labelEvery === 0) out += `<text x="${left - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
  }
  for (let d = 0; d <= length + 1e-6; d += 250) {
    out += `<line class="cs-grid" x1="${sx(d).toFixed(1)}" x2="${sx(d).toFixed(1)}" y1="${top}" y2="${top + ph}"/>`;
    if (d % 500 === 0) out += `<text x="${sx(d).toFixed(1)}" y="${H - bottom + 15}" text-anchor="middle">${(d / 1000).toFixed(1)}</text>`;
  }
  out += `<text x="${left}" y="13">Elevation (m)</text><text x="${W - right}" y="${H - 2}" text-anchor="end">Distance from ${labels[0]} (km)</text>`;
  out += `<text class="cs-end" x="${left + 6}" y="${top + 14}">${labels[0]}</text><text class="cs-end" x="${W - right - 6}" y="${top + 14}" text-anchor="end">${labels[1]}</text>`;
  return `<svg class="cm-sketch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Blank grid for sketching the cross-section from ${labels[0]} to ${labels[1]}">${out}</svg>`;
}
