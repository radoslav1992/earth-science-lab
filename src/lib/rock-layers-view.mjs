// Drawings for the Rock Layers Lab, shared by the server and the browser:
// - the cross-section, built by replaying a section's history (lay down, tilt, erode, fault, intrude) on a
//   list of polygons, so the picture always shows exactly the evidence the model reasons from;
// - the decay curve and the box of atoms for the radiometric dating part.
import {
  RULES, MAX_HALF_LIVES, eventLabel, eventName, eventPhrase, eventStory, constraints, evidenceSentence, shuffledEvents, datedEvents,
  sampleText, bracketQuestion, bracketOrder, fractionLeft, daughterPerParent, atomsLeft, verdict, fmtYears, fmtMyr, fmtPercent, fmtHalfLives,
} from './rock-layers.mjs';

// ---------- Cross-section geometry ----------
// Drawing units: x runs right from 0 to FRAME.width, y runs up from the bottom of the picture (0) to the
// section's ground level. Layers are built much wider and deeper than the frame so that tilting and
// faulting never leave a gap, then everything is cut back to the frame.
export const FRAME = { width: 720, sky: 30 };
const FAR = 900;
const DEEP = -2400;
const rad = deg => (deg * Math.PI) / 180;
const round = v => Math.round(v * 10) / 10;
/** A repeatable number from 0 to 1 for the i-th item of a set. */
const noise = (i, salt = 0) => { const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return v - Math.floor(v); };

/** Keeps the part of a polygon where nx·x + ny·y + c ≥ 0. */
export function clipPolygon(pts, nx, ny, c) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const da = nx * a[0] + ny * a[1] + c, db = nx * b[0] + ny * b[1] + c;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out.length >= 3 ? out : [];
}
/** Keeps the parts of a line where nx·x + ny·y + c ≥ 0; a line can come back in several pieces. */
export function clipLine(pts, nx, ny, c) {
  const pieces = [];
  let piece = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], da = nx * a[0] + ny * a[1] + c;
    if (da >= 0) piece.push(a);
    if (i < pts.length - 1) {
      const b = pts[i + 1], db = nx * b[0] + ny * b[1] + c;
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        piece.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        if (da >= 0) { pieces.push(piece); piece = []; }
      }
    }
  }
  if (piece.length) pieces.push(piece);
  return pieces.filter(p => p.length >= 2);
}
const move = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
const turn = (pts, deg, [cx, cy]) => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); };
const area = pts => Math.abs(pts.reduce((sum, [x, y], i) => { const [nx, ny] = pts[(i + 1) % pts.length]; return sum + x * ny - nx * y; }, 0)) / 2;
export function insidePolygon([x, y], pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distanceToEdges([x, y], pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}
/** A small lump of rock: rounded for pebbles, sharper for broken pieces inside an intrusion. */
function lump(cx, cy, r, seed, sides) {
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 + noise(seed, 3), rr = r * (0.72 + 0.5 * noise(seed * 7 + i, 5));
    return [cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.85];
  });
}
/** Down-dip direction of a fault or dike, and the normal that points into the block above it. */
function plane(dip) {
  const side = dip < 0 ? -1 : 1, t = rad(Math.abs(dip));
  return { down: [Math.cos(t) * side, -Math.sin(t)], up: [Math.sin(t) * side, Math.cos(t)] };
}

/**
 * Replays a section's history and returns what is left inside the frame:
 * polys ({ unit, pts, piece, n }, in drawing order; `piece` marks a pebble or broken piece of that unit and
 * `n` is the event that made it), lines ({ id, kind: 'erosion' | 'fault', pts, n }), each unit's rotation,
 * and where each label goes.
 */
export function buildSection(section) {
  let polys = [], lines = [];
  let top = 0, low = 0; // highest and lowest points of the rock surface so far
  const spin = {};
  const W = FRAME.width;
  section.events.forEach((ev, n) => {
    if (ev.kind === 'deposit') {
      if (top !== low) throw new Error(`${section.id}: ${ev.id} needs a level surface to settle on`);
      const base = n === 0 ? DEEP : top;
      polys.push({ unit: ev.id, n, pts: [[-FAR, base], [W + FAR, base], [W + FAR, top + ev.thick], [-FAR, top + ev.thick]] });
      spin[ev.id] = 0;
      // Pebbles of older rock, scattered through the lower part of the layer.
      const of = ev.inclusions ?? [];
      const count = of.length ? 11 : 0;
      for (let i = 0; i < count; i++) {
        const r = 5.5 + 3 * noise(i, n);
        const x = 34 + ((W - 68) * (i + 0.15 + 0.7 * noise(i, n + 1))) / count;
        const y = top + r + 4 + (ev.thick * 0.5 - 2 * r) * noise(i, n + 2);
        polys.push({ unit: of[i % of.length], piece: ev.id, n, pts: lump(x, y, r, i + n * 13, 9) });
      }
      top = low = top + ev.thick;
    } else if (ev.kind === 'tilt') {
      const pivot = [W / 2, top / 2];
      polys = polys.map(p => ({ ...p, pts: turn(p.pts, ev.deg, pivot) }));
      lines = lines.map(l => ({ ...l, pts: turn(l.pts, ev.deg, pivot) }));
      for (const id of Object.keys(spin)) spin[id] += ev.deg;
      // The lowest corner of the tilted pile inside the frame is the highest level erosion can cut to.
      low = top / 2 + top / 2 / Math.cos(rad(ev.deg)) - (W / 2) * Math.tan(rad(Math.abs(ev.deg)));
    } else if (ev.kind === 'erode') {
      if (ev.level > low) throw new Error(`${section.id}: erosion surface ${ev.id} is above the rock`);
      polys = polys.map(p => ({ ...p, pts: clipPolygon(p.pts, 0, -1, ev.level) })).filter(p => p.pts.length);
      lines = lines.flatMap(l => clipLine(l.pts, 0, -1, ev.level).map(pts => ({ ...l, pts })));
      // A gently wavy line, the usual symbol for a buried erosion surface.
      const wave = [];
      for (let x = -FAR; x <= W + FAR; x += 9) wave.push([x, ev.level + 2.2 * Math.sin(x / 9)]);
      lines.push({ id: ev.id, kind: 'erosion', n, pts: wave });
      top = low = ev.level;
    } else if (ev.kind === 'fault') {
      const { down, up } = plane(ev.dip);
      const c = -(up[0] * ev.x + up[1] * top);
      const slide = [down[0] * ev.slip, down[1] * ev.slip];
      polys = polys.flatMap(p => [
        { ...p, pts: clipPolygon(p.pts, -up[0], -up[1], -c) },
        { ...p, pts: move(clipPolygon(p.pts, up[0], up[1], c), ...slide) },
      ]).filter(p => p.pts.length);
      lines = lines.flatMap(l => [
        ...clipLine(l.pts, -up[0], -up[1], -c).map(pts => ({ ...l, pts })),
        ...clipLine(l.pts, up[0], up[1], c).map(pts => ({ ...l, pts: move(pts, ...slide) })),
      ]);
      lines.push({ id: ev.id, kind: 'fault', n, pts: [[ev.x, top], [ev.x + down[0] * 3000, top + down[1] * 3000]] });
      low = top - ev.slip * Math.sin(rad(Math.abs(ev.dip)));
    } else if (ev.kind === 'dike') {
      const { down } = plane(ev.dip);
      const h = ev.width / 2 / Math.sin(rad(Math.abs(ev.dip)));
      const a = [ev.x - down[0] * 300, top - down[1] * 300], b = [ev.x + down[0] * 3000, top + down[1] * 3000];
      polys.push({ unit: ev.id, n, pts: clipPolygon([[a[0] - h, a[1]], [a[0] + h, a[1]], [b[0] + h, b[1]], [b[0] - h, b[1]]], 0, -1, top) });
      spin[ev.id] = 0;
    } else if (ev.kind === 'pluton') {
      if (ev.top >= low) throw new Error(`${section.id}: intrusion ${ev.id} must stay below the surface`);
      const base = -60, dome = [];
      const shape = (f, scale = 1) => {
        const a = Math.PI * f;
        return [ev.x + scale * (ev.halfWidth * Math.cos(a) + 9 * Math.sin(5 * a + 1)), base + scale * (ev.top - base) * (Math.sin(a) ** 0.62) * (1 - 0.035 * (1 + Math.sin(9 * a)))];
      };
      for (let i = 0; i <= 48; i++) dome.push(shape(i / 48));
      polys.push({ unit: ev.id, n, pts: [[ev.x + ev.halfWidth, DEEP], ...dome, [ev.x - ev.halfWidth, DEEP]] });
      spin[ev.id] = 0;
      // Broken pieces of the rocks it pushed into, caught near its edge.
      const of = ev.inclusions ?? [];
      const spots = [0.2, 0.32, 0.44, 0.58, 0.7, 0.82].map(f => shape(f, 0.8)).filter(([, y]) => y > 30);
      spots.forEach(([x, y], i) => polys.push({ unit: of[i % of.length], piece: ev.id, n, pts: lump(x, y, 8.5, i + n * 17, 6) }));
    } else throw new Error(`${section.id}: unknown event kind ${ev.kind}`);
  });
  if (section.ground > low) throw new Error(`${section.id}: the ground is above the rock`);

  // Today's land surface and the edges of the picture.
  const frame = [[1, 0, 0], [-1, 0, W], [0, 1, 0], [0, -1, section.ground]];
  for (const [nx, ny, c] of frame) {
    polys = polys.map(p => ({ ...p, pts: clipPolygon(p.pts, nx, ny, c) })).filter(p => p.pts.length);
    lines = lines.flatMap(l => clipLine(l.pts, nx, ny, c).map(pts => ({ ...l, pts })));
  }
  polys = polys.filter(p => area(p.pts) > 4);
  return { polys, lines, spin, labels: placeLabels(section, polys, lines) };
}

/** The roomiest spot inside each unit that nothing younger is drawn over, and a spot on each fault and erosion surface. */
function placeLabels(section, polys, lines) {
  const labels = {};
  const W = FRAME.width, step = 6;
  const taken = [];
  for (const ev of section.events) {
    if (ev.kind === 'fault' || ev.kind === 'erode') {
      const pieces = lines.filter(l => l.id === ev.id);
      if (!pieces.length) continue;
      const length = pts => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
      const line = pieces.reduce((a, b) => (length(b.pts) > length(a.pts) ? b : a)).pts;
      let want = length(line) * (ev.labelAt ?? (ev.kind === 'erode' ? 0.93 : 0.5));
      let at = line[line.length - 1];
      for (let i = 1; i < line.length; i++) {
        const seg = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        if (want <= seg) { const t = seg ? want / seg : 0; at = [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t]; break; }
        want -= seg;
      }
      labels[ev.id] = at;
      taken.push(at);
    }
  }
  const ids = section.events.filter(ev => ev.kind !== 'tilt' && ev.kind !== 'fault' && ev.kind !== 'erode').map(ev => ev.id);
  for (const id of ids) {
    let best = null, bestRoom = -1;
    polys.forEach((p, z) => {
      if (p.unit !== id || p.piece) return;
      const above = polys.slice(z + 1);
      const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]);
      for (let x = Math.max(step, Math.min(...xs)); x <= Math.min(W - step, Math.max(...xs)); x += step) {
        for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) {
          const q = [x, y];
          if (!insidePolygon(q, p.pts) || above.some(o => insidePolygon(q, o.pts))) continue;
          let room = distanceToEdges(q, p.pts);
          for (const o of above) room = Math.min(room, distanceToEdges(q, o.pts));
          for (const l of lines) room = Math.min(room, distanceToEdges(q, [...l.pts, ...[...l.pts].reverse()]));
          for (const t of taken) room = Math.min(room, Math.hypot(q[0] - t[0], q[1] - t[1]) - 14);
          // Prefer spots toward the middle of the picture when the room is the same.
          room -= Math.abs(x - W / 2) / 4000;
          if (room > bestRoom) { bestRoom = room; best = q; }
        }
      }
    });
    if (best) { labels[id] = best; taken.push(best); }
  }
  return labels;
}

// ---------- Cross-section drawing ----------
/** Texture marks for each rock type, drawn in a 28 × 28 tile over its base color. */
const TEXTURES = {
  sandstone: ['#ead49f', '<g fill="#b59a5b"><circle cx="4" cy="5" r="1.1"/><circle cx="15" cy="3" r="1"/><circle cx="24" cy="8" r="1.1"/><circle cx="9" cy="13" r="1"/><circle cx="20" cy="16" r="1.1"/><circle cx="3" cy="21" r="1"/><circle cx="13" cy="24" r="1.1"/><circle cx="25" cy="23" r="1"/></g>'],
  shale: ['#b9b3a6', '<g stroke="#817a6d" stroke-width="1.1" stroke-linecap="round"><path d="M2 5h9M17 5h8M8 12h10M22 12h4M1 19h7M13 19h11M5 26h9M19 26h7"/></g>'],
  limestone: ['#d3dccd', '<g stroke="#8c9a86" stroke-width="1" fill="none"><path d="M0 7h28M0 21h28M0 14h28M0 28h28M7 0v7M21 0v7M14 7v7M7 14v7M21 14v7M14 21v7"/></g>'],
  conglomerate: ['#dcc9a6', '<g fill="#f0e4c8" stroke="#8f7a52" stroke-width="1"><ellipse cx="7" cy="7" rx="4.2" ry="3"/><ellipse cx="20" cy="11" rx="3.2" ry="2.4"/><ellipse cx="11" cy="20" rx="3.6" ry="2.6"/><ellipse cx="23" cy="23" rx="2.6" ry="2"/></g>'],
  tuff: ['#efe6ef', '<g stroke="#9a86a3" stroke-width="1.1" fill="none" stroke-linecap="round"><path d="M3 4l2 3 2-3M16 9l2 3 2-3M8 17l2 3 2-3M21 21l2 3 2-3"/></g>'],
  basalt: ['#4d4a48', '<g fill="#8b8782"><circle cx="5" cy="6" r="1.2"/><circle cx="18" cy="4" r="1"/><circle cx="11" cy="15" r="1.2"/><circle cx="24" cy="18" r="1"/><circle cx="6" cy="24" r="1"/></g>'],
  granite: ['#edc3b3', '<g stroke="#8a5a52" stroke-width="1.3" stroke-linecap="round"><path d="M3 5h4M5 3v4M17 8h4M19 6v4M9 17h4M11 15v4M22 22h4M24 20v4"/></g><g fill="#fff6ef"><circle cx="12" cy="6" r="1.4"/><circle cx="24" cy="13" r="1.3"/><circle cx="4" cy="16" r="1.3"/><circle cx="16" cy="25" r="1.4"/></g>'],
};
const path = (pts, close, y) => `M${pts.map(([px, py]) => `${round(px)} ${round(y(py))}`).join('L')}${close ? 'Z' : ''}`;

export const sectionSize = section => ({ width: FRAME.width, height: section.ground + FRAME.sky });

/**
 * The inner SVG of a cross-section. `prefix` keeps pattern ids unique when a page draws several sections;
 * `labels: false` leaves the letters off (for thumbnails).
 */
export function sectionSvg(section, { prefix = `rl-${section.id}`, labels = true } = {}) {
  const { polys, lines, spin, labels: spots } = buildSection(section);
  const { width, height } = sectionSize(section);
  const y = v => FRAME.sky + section.ground - v;
  const units = section.events.filter(ev => ev.rock);
  const defs = units.map(ev => {
    const [fill, marks] = TEXTURES[ev.rock];
    return `<pattern id="${prefix}-${ev.id}" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(${round(-spin[ev.id])})"><rect width="28" height="28" fill="${fill}"/>${marks}</pattern>`;
  }).join('');
  // Drawn in the order things happened, so a dike that crosses an older fault is drawn over the fault line.
  const drawn = section.events.map((_, n) => polys.filter(p => p.n === n).map(p => `<path class="${p.piece ? 'rl-piece' : 'rl-unit'}" fill="url(#${prefix}-${p.unit})" d="${path(p.pts, true, y)}"/>`).join('')
    + lines.filter(l => l.n === n).map(l => `<path class="rl-line rl-${l.kind}" d="${path(l.pts, false, y)}"/>`).join('')).join('');
  const badges = !labels ? '' : section.events.filter(ev => spots[ev.id]).map(ev => {
    const [bx, by] = spots[ev.id];
    return `<g class="rl-badge rl-badge-${ev.kind}" data-badge="${ev.id}" transform="translate(${round(bx)} ${round(y(by))})"><circle r="12.5"/><text y="5.5" text-anchor="middle">${eventLabel(ev)}</text></g>`;
  }).join('');
  return `<defs>${defs}</defs><rect class="rl-sky" width="${width}" height="${FRAME.sky}"/>${drawn}`
    + `<path class="rl-ground" d="M0 ${FRAME.sky}H${width}"/><rect class="rl-frame" x=".5" y=".5" width="${width - 1}" height="${height - 1}"/>${badges}`;
}

/** What the picture shows, in words: every observation the evidence rests on, without the conclusions. */
export function describeSection(section) {
  const rocks = section.events.filter(ev => ev.kind !== 'tilt').map(ev => `${eventLabel(ev)}, ${eventName(ev).toLowerCase()}`).join('; ');
  return `Cross-section of rock layers, “${section.name}”. Labeled: ${rocks}. ${constraints(section).map(c => c.see).join('. ')}.`;
}

// ---------- Decay curve ----------
export const CURVE = { width: 560, height: 320, left: 58, right: 30, top: 16, bottom: 62 };
const cx = h => CURVE.left + (h / MAX_HALF_LIVES) * (CURVE.width - CURVE.left - CURVE.right);
const cy = f => CURVE.top + (1 - f) * (CURVE.height - CURVE.top - CURVE.bottom);
/** Short time labels for the curve's axis: "5,730", "704 million", "1.41 billion". */
const axisTime = years => fmtYears(years).replace(/ years?$/, '');

/** The decay curve for an isotope, with a marker at a number of half-lives. */
export function decaySvg(iso, halfLives) {
  const f = 0.5 ** halfLives;
  const pts = (fn) => Array.from({ length: 101 }, (_, i) => { const h = (i / 100) * MAX_HALF_LIVES; return `${round(cx(h))} ${round(cy(fn(0.5 ** h)))}`; }).join('L');
  const x0 = cx(0), x1 = cx(MAX_HALF_LIVES), y0 = cy(0), y1 = cy(1);
  let grid = '';
  for (const p of [0, 25, 50, 75, 100]) grid += `<path class="dc-grid" d="M${x0} ${cy(p / 100)}H${x1}"/><text class="dc-tick" x="${x0 - 8}" y="${round(cy(p / 100) + 4)}" text-anchor="end">${p}%</text>`;
  for (let h = 0; h <= MAX_HALF_LIVES; h++) {
    grid += `<path class="dc-grid" d="M${round(cx(h))} ${y1}V${y0}"/><text class="dc-tick" x="${round(cx(h))}" y="${y0 + 17}" text-anchor="middle">${h}</text>`;
    if (h % 2 === 0 && h > 0) grid += `<text class="dc-tick dc-years" x="${round(cx(h))}" y="${y0 + 32}" text-anchor="middle">${axisTime(h * iso.halfLife)}</text>`;
  }
  const mx = round(cx(halfLives)), my = round(cy(f));
  return `${grid}<path class="dc-axis" d="M${x0} ${y1}V${y0}H${x1}"/>`
    + `<text class="dc-title" x="${round((x0 + x1) / 2)}" y="${CURVE.height - 8}" text-anchor="middle">Half-lives passed (with years of ${iso.parent.toLowerCase()} decay)</text>`
    + `<text class="dc-title" transform="translate(14 ${round((y0 + y1) / 2)}) rotate(-90)" text-anchor="middle">Share of atoms</text>`
    + `<path class="dc-daughter" d="M${pts(v => 1 - v)}"/><path class="dc-parent" d="M${pts(v => v)}"/>`
    + `<text class="dc-name dc-name-parent" x="${round(cx(0.55))}" y="${round(cy(0.9))}">${iso.parent} (parent)</text>`
    + `<text class="dc-name dc-name-daughter" x="${x1 - 6}" y="${round(cy(0.9))}" text-anchor="end">${iso.daughter} (daughter)</text>`
    + `<path class="dc-drop" d="M${mx} ${y0}V${my}H${x0}"/><circle class="dc-mark" cx="${mx}" cy="${my}" r="6.5"/>`;
}
export function describeDecay(iso, halfLives) {
  const years = halfLives * iso.halfLife;
  const left = 100 * fractionLeft(years, iso.halfLife);
  return `Decay curve for ${iso.parent.toLowerCase()} turning into ${iso.daughter.toLowerCase()}. After ${fmtYears(years)}, ${fmtPercent(left)}% of the parent atoms are left and ${fmtPercent(100 - left)}% have become daughter atoms.`;
}

// ---------- Box of atoms ----------
export const ATOMS = { cols: 20, rows: 10, total: 200, width: 400, height: 200 };
// The order in which the atoms decay: a fixed shuffle, so atoms never switch back as time runs forward.
const DECAY_ORDER = (() => {
  const order = Array.from({ length: ATOMS.total }, (_, i) => i);
  let seed = 20240607;
  for (let i = order.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const rank = [];
  order.forEach((atom, i) => { rank[atom] = i; });
  return rank;
})();
/** 200 atoms: the first to decay are always the same ones, so the picture changes smoothly with time. */
export function atomsSvg(parentsLeft) {
  const decayed = ATOMS.total - parentsLeft;
  let out = '';
  for (let i = 0; i < ATOMS.total; i++) {
    const x = 10 + (i % ATOMS.cols) * 20, y = 10 + Math.floor(i / ATOMS.cols) * 20;
    out += `<circle class="${DECAY_ORDER[i] < decayed ? 'at-daughter' : 'at-parent'}" cx="${x}" cy="${y}" r="7"/>`;
  }
  return out;
}

// ---------- Markup shared by the server and the browser ----------
const cap = text => text[0].toUpperCase() + text.slice(1);
const letter = ev => `<span class="rl-letter rl-letter-${ev.kind}" aria-hidden="true">${eventLabel(ev)}</span>`;
/** An event's name for screen readers: "Limestone M", "Fault F", "Tilting of the layers". */
export const eventTitle = ev => (ev.kind === 'tilt' ? eventName(ev) : `${eventName(ev)} ${ev.id}`);

/** The events still to place, as buttons, in the section's fixed shuffle. */
export function poolHtml(section, order = [], { disabled = false } = {}) {
  const waiting = shuffledEvents(section).filter(id => !order.includes(id)).map(id => section.events.find(ev => ev.id === id));
  if (!waiting.length) return '<p class="rl-pool-done">Every event is placed. Use the arrows to change the order, then check it.</p>';
  return waiting.map(ev => `<button type="button" class="rl-chip" data-add="${ev.id}" aria-label="Place ${eventTitle(ev)} next"${disabled ? ' disabled' : ''}>${letter(ev)}<span>${eventName(ev)}</span></button>`).join('');
}
/** The student's order so far, oldest first, each with move and remove buttons. */
export function orderHtml(section, order = [], { locked = false } = {}) {
  return order.map((id, i) => {
    const ev = section.events.find(e => e.id === id), name = eventTitle(ev);
    const tag = i === 0 ? ' <span class="rl-pos-tag">oldest</span>' : i === section.events.length - 1 ? ' <span class="rl-pos-tag">youngest</span>' : '';
    const buttons = locked ? '' : `<span class="rl-item-btns">`
      + `<button type="button" data-earlier="${id}" aria-label="Move ${name} earlier"${i === 0 ? ' disabled' : ''}>▲</button>`
      + `<button type="button" data-later="${id}" aria-label="Move ${name} later"${i === order.length - 1 ? ' disabled' : ''}>▼</button>`
      + `<button type="button" data-remove="${id}" aria-label="Remove ${name}">✕</button></span>`;
    return `<li class="rl-item" data-item="${id}"><span class="rl-pos">${i + 1}</span>${letter(ev)}<span class="rl-item-name">${eventName(ev)}${tag}</span>${buttons}</li>`;
  }).join('');
}
/** The finished history, oldest first, with the evidence for each step. */
export function storyHtml(section) {
  const evidence = constraints(section);
  return `<ol class="rl-story">${section.events.map((ev, i) => {
    const why = i === 0 ? 'Everything else lies on top of it or cuts through it, so it is the oldest.' : evidence.filter(c => c.younger === ev.id).map(c => `${evidenceSentence(c)} <em>(${RULES[c.rule].name})</em>`).join(' ');
    return `<li><strong>${eventStory(ev)}</strong> ${why}</li>`;
  }).join('')}</ol>`;
}
/** The dated igneous rocks of a section, each with a box for its age. */
export function samplesHtml(section, { disabled = false } = {}) {
  return datedEvents(section).map(ev => {
    const name = eventPhrase(ev), id = `rl-age-${ev.id}`;
    return `<div class="rl-sample" data-sample="${ev.id}">`
      + `<p class="rl-sample-what">${letter(ev)}<span><strong>${cap(name)}.</strong> ${sampleText(section, ev.id)}</span></p>`
      + `<div class="rl-sample-row"><label for="${id}">Age of ${name} (million years)</label>`
      + `<input id="${id}" type="number" inputmode="decimal" min="0" step="any" data-age="${ev.id}"${disabled ? ' disabled' : ''} />`
      + `<button type="button" class="btn small" data-age-check="${ev.id}"${disabled ? ' disabled' : ''}>Check</button>`
      + `<button type="button" class="btn small" data-open-decay="${ev.id}"${disabled ? ' disabled' : ''}>Work it out in part 2</button></div>`
      + `<p class="rl-sample-result" data-age-result="${ev.id}" hidden></p></div>`;
  }).join('');
}
/** The bracketing question's answer buttons. */
export function bracketHtml(section, { disabled = false } = {}) {
  const q = bracketQuestion(section);
  return bracketOrder(section).map(id => `<button type="button" class="btn rl-choice" data-bracket-choice="${id}"${disabled ? ' disabled' : ''}>${q.choices[id]}</button>`).join('');
}

/** A time in the isotope's own unit, as a bare number: years for carbon-14, million years for the rest. */
export const fmtInUnit = (iso, years) => (iso.unitYears === 1 ? fmtYears(years).replace(/ years?$/, '') : fmtMyr(years));
const fmtRatio = r => (r >= 1000 ? Math.round(r).toLocaleString('en-US') : String(Number(r.toPrecision(3))));
/** The decay lab's readout for an isotope after a number of half-lives. */
export function resultsHtml(iso, halfLives) {
  const years = halfLives * iso.halfLife;
  const f = fractionLeft(years, iso.halfLife), left = 100 * f;
  const v = verdict(iso, years);
  const stats = [
    ['Parent left', `${fmtPercent(left)}%`, `${atomsLeft(f, ATOMS.total)} of ${ATOMS.total} atoms in the box`],
    ['Daughter formed', `${fmtPercent(100 - left)}%`, `${ATOMS.total - atomsLeft(f, ATOMS.total)} atoms`],
    ['Daughter ÷ parent', fmtRatio(daughterPerParent(f)), 'daughter atoms for each parent atom'],
    ['Half-lives passed', fmtHalfLives(halfLives), `one half-life is ${fmtYears(iso.halfLife)}`],
    ['Age', fmtYears(years), iso.unitYears === 1 || years < 1e9 ? '' : `${fmtMyr(years)} million years`],
  ];
  return `<dl class="rl-stats">${stats.map(([k, val, more]) => `<div><dt>${k}</dt><dd><strong>${val}</strong>${more ? ` <small>${more}</small>` : ''}</dd></div>`).join('')}</dl>`
    + `<p class="formula rl-formula">age = half-life × log₂(100 ÷ % left) = ${fmtInUnit(iso, iso.halfLife)} × log₂(100 ÷ ${fmtPercent(left)}) = ${fmtInUnit(iso, iso.halfLife)} × ${Number(halfLives.toFixed(4))} = ${fmtInUnit(iso, years)} ${iso.unit}</p>`
    + `<p class="rl-verdict rl-verdict-${v.status}"><strong>${v.status === 'ok' ? 'Good fit.' : 'Poor fit.'}</strong> ${v.text}</p>`;
}
/** What an isotope pair is used for. */
export function methodHtml(iso) {
  return `<h3>${iso.method}: ${iso.parent.toLowerCase()} → ${iso.daughter.toLowerCase()}</h3>`
    + `<dl class="rl-method"><div><dt>Half-life</dt><dd>${fmtYears(iso.halfLife)}</dd></div><div><dt>What it dates</dt><dd>${iso.dates}</dd></div>`
    + `<div><dt>Useful for ages of roughly</dt><dd>${fmtYears(iso.range[0])} to ${fmtYears(iso.range[1])}</dd></div></dl><p class="rl-method-note">${iso.note}</p>`;
}
