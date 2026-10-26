// Drawings and panels for the Rock Cycle Builder, shared by the server render and the browser:
// original procedural rock textures (seeded, so every visit draws the same picture), the crust
// cross-section with the rock's journey, the rock cycle diagram, and the card, conditions and journey HTML.
import {
  MATERIALS, FAMILY_NAMES, COMP_NAMES, MELT_C, PLACES, GRADES, NODE_NAMES, nodeOf, magmaOf,
  OPTION_BY_CODE, conditions, startConditions, stepName, fmtRange,
} from './rock-cycle.mjs';

const r1 = v => Math.round(v * 10) / 10;
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pathD = (pts, close = false) => 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + (close ? 'Z' : '');

// ---------- Seeded randomness ----------
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, weighted) => {
  let x = rand() * weighted.reduce((s, [, w]) => s + w, 0);
  for (const [value, w] of weighted) { x -= w; if (x <= 0) return value; }
  return weighted[weighted.length - 1][0];
};

// ---------- Texture helpers ----------
export const SWATCH = { w: 240, h: 150 };
function clipPoly(poly, f) {
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
/** Voronoi cells (interlocking crystals) for jittered points; stretch > 1 elongates them along `angle`. */
function crystals(rand, w, h, cols, rows, { stretch = 1, angle = 0, jitter = 0.9 } = {}) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  // Work in a frame where the long axis of the crystals is squeezed, then map back.
  const toLocal = ([x, y]) => { const u = x * ca + y * sa, v = -x * sa + y * ca; return [u / stretch, v]; };
  const pts = [];
  const cw = (w + 40) / cols, ch = (h + 40) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) pts.push([-20 + (i + 0.5 + (rand() - 0.5) * jitter) * cw, -20 + (j + 0.5 + (rand() - 0.5) * jitter) * ch]);
  const local = pts.map(toLocal);
  return pts.map((p, i) => {
    let poly = [[-2, -2], [w + 2, -2], [w + 2, h + 2], [-2, h + 2]];
    const pl = local[i];
    for (let j = 0; j < pts.length && poly.length; j++) {
      if (j === i) continue;
      const q = local[j], mx = (pl[0] + q[0]) / 2, my = (pl[1] + q[1]) / 2, nx = q[0] - pl[0], ny = q[1] - pl[1];
      if (Math.abs(nx) > 3 * cw && Math.abs(ny) > 3 * ch) continue;
      poly = clipPoly(poly, pt => { const [u, v] = toLocal(pt); return (u - mx) * nx + (v - my) * ny; });
    }
    return { poly, center: p };
  }).filter(c => c.poly.length > 2);
}
// Compact relative path data: "M12 3l4 1.5 -2 .3z" (one decimal, no leading zeros).
const num = v => String(r1(v)).replace(/^(-?)0\./, '$1.');
function rel(pts, close = false) {
  const q = pts.map(([x, y]) => [r1(x), r1(y)]);
  let d = `M${num(q[0][0])} ${num(q[0][1])}`;
  if (q.length > 1) d += 'l' + q.slice(1).map(([x, y], i) => `${num(x - q[i][0])} ${num(y - q[i][1])}`).join(' ');
  return d + (close ? 'z' : '');
}
const polyPath = (poly, fill, extra = '') => `<path d="${rel(poly, true)}" fill="${fill}"${extra}/>`;
/** Crystal cells grouped by color: one path per color. */
function crystalSvg(rand, cells, weighted, stroke, width) {
  const g = group();
  for (const c of cells) g.add(`fill="${pick(rand, weighted)}" stroke="${stroke}" stroke-width="${width}"`, rel(c.poly, true));
  return g.svg();
}
const wave = (rand, y, w, amp, freq, phase = rand() * 6.28, step = 6) => {
  const pts = [];
  for (let x = -6; x <= w + 6; x += step) pts.push([x, y + amp * Math.sin(x * freq + phase) + amp * 0.4 * Math.sin(x * freq * 2.3 + phase * 1.7)]);
  return pts;
};
const line = (pts, stroke, width, extra = '') => `<path d="${rel(pts)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
// Many small shapes of the same style are batched into one <path>, which keeps the markup small.
function group() {
  const m = new Map();
  return {
    add(attrs, d) { if (!m.has(attrs)) m.set(attrs, []); m.get(attrs).push(d); },
    svg() { return [...m].map(([attrs, ds]) => `<path ${attrs} d="${ds.join('')}"/>`).join(''); },
  };
}
const strokeAttrs = (stroke, width, extra = '') => `fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}`;
/** Tiny square specks: zero-length strokes with square caps, grouped by color and size. */
function specks(rand, w, h, n, colors, [s0, s1] = [1, 2]) {
  const g = group();
  for (let i = 0; i < n; i++) {
    const size = Math.round((s0 + rand() * (s1 - s0)) * 2) / 2, x = Math.round(rand() * w), y = Math.round(rand() * h);
    g.add(`stroke="${colors[Math.floor(rand() * colors.length)]}" stroke-width="${size}" stroke-linecap="square"`, `M${x} ${y}h0`);
  }
  return g.svg();
}
/** Round grains: zero-length strokes with round caps, grouped by color and size. */
function dots(rand, w, h, n, colors, [r0, rr], opacity = 1) {
  const g = group();
  for (let i = 0; i < n; i++) {
    const x = Math.round(rand() * w), y = Math.round(rand() * h), r = Math.round((r0 + rand() * rr) * 4) / 4;
    g.add(`stroke="${colors[Math.floor(rand() * colors.length)]}" stroke-width="${r * 2}" stroke-linecap="round"${opacity < 1 ? ` opacity="${opacity}"` : ''}`, `M${x} ${y}h0`);
  }
  return g.svg();
}
/** A rotated ellipse as path arcs (so many can share one <path>). */
function ellipseD(x, y, rx, ry, deg) {
  const a = (deg * Math.PI) / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${num(x - dx)} ${num(y - dy)}a${num(rx)} ${num(ry)} ${Math.round(deg)} 1 0 ${num(2 * dx)} ${num(2 * dy)}a${num(rx)} ${num(ry)} ${Math.round(deg)} 1 0 ${num(-2 * dx)} ${num(-2 * dy)}`;
}
/** Rounded pebbles that don't overlap much (rejection sampling with a fixed number of tries). */
function pebbles(rand, w, h, n, colors, [rx0, rx1], stroke) {
  const placed = [], g = group(), shine = group();
  for (let tries = 0; tries < n * 30 && placed.length < n; tries++) {
    const rx = rx0 + rand() * (rx1 - rx0), ry = rx * (0.55 + rand() * 0.35);
    const x = rand() * w, y = rand() * h;
    if (placed.some(p => Math.hypot((p.x - x) / (p.rx + rx), (p.y - y) / (p.ry + ry)) < 0.82)) continue;
    placed.push({ x, y, rx, ry });
    const rot = (rand() - 0.5) * 50, fill = colors[Math.floor(rand() * colors.length)];
    g.add(`fill="${fill}" stroke="${stroke}" stroke-width="1"`, ellipseD(x, y, rx, ry, rot));
    shine.add('fill="#fff" opacity=".22"', ellipseD(x - rx * 0.25, y - ry * 0.35, rx * 0.35, ry * 0.22, rot));
  }
  return g.svg() + shine.svg();
}
function shell(rand, x, y, s, fill, stroke) {
  // A ribbed, fan-shaped clam shell pointing up, rotated at random.
  const rot = r1((rand() - 0.5) * 120);
  let ribs = '';
  for (let k = -3; k <= 3; k++) ribs += `M0 ${r1(s * 0.35)}L${r1(k * s * 0.24)} ${r1(-s * 0.55 + Math.abs(k) * s * 0.05)}`;
  return `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${rot})"><path d="M${r1(-s * 0.85)} ${r1(-s * 0.15)}Q0 ${r1(-s * 1.05)} ${r1(s * 0.85)} ${r1(-s * 0.15)}L${r1(s * 0.2)} ${r1(s * 0.45)}H${r1(-s * 0.2)}Z" fill="${fill}" stroke="${stroke}" stroke-width="1"/><path d="${ribs}" stroke="${stroke}" stroke-width=".7" fill="none" opacity=".7"/></g>`;
}
function spiral(x, y, s, stroke) {
  const pts = [];
  for (let t = 0; t < 4.2 * Math.PI; t += 0.25) { const rr = s * 0.08 * t; pts.push([x + rr * Math.cos(t), y + rr * Math.sin(t)]); }
  return line(pts, stroke, 1.2);
}

// ---------- The textures ----------
const TEXTURES = {
  granite: (rand, w, h) => crystalSvg(rand, crystals(rand, w, h, 9, 6), [['#e3a58b', 34], ['#efe7dc', 24], ['#b7b2ab', 26], ['#2b2725', 16]], 'rgba(70,45,35,.35)', 0.8),
  diorite: (rand, w, h) => crystalSvg(rand, crystals(rand, w, h, 12, 8), [['#ece8e0', 50], ['#232323', 38], ['#9b9b96', 12]], 'rgba(40,40,40,.3)', 0.7),
  gabbro: (rand, w, h) => crystalSvg(rand, crystals(rand, w, h, 10, 7), [['#2a2f2b', 48], ['#4f574f', 16], ['#8e918b', 36]], 'rgba(10,15,10,.35)', 0.8),
  marble: (rand, w, h) => crystalSvg(rand, crystals(rand, w, h, 14, 9), [['#f6f3ed', 3], ['#ece7de', 3], ['#e3ddd2', 2], ['#faf8f4', 2]], 'rgba(150,140,125,.4)', 0.7)
    + line(wave(rand, h * 0.35, w, 14, 0.025), 'rgba(110,110,118,.35)', 2.2) + line(wave(rand, h * 0.75, w, 10, 0.03), 'rgba(110,110,118,.22)', 1.4),
  quartzite: (rand, w, h) => crystalSvg(rand, crystals(rand, w, h, 16, 10), [['#efdfd2', 3], ['#f4eae1', 3], ['#e4cdbd', 2], ['#f8f1ea', 2]], 'rgba(165,120,100,.35)', 0.7),
  amphibolite: (rand, w, h) => crystalSvg(rand, crystals(rand, w, h, 9, 12, { stretch: 3, angle: -0.18, jitter: 0.8 }), [['#1d2420', 52], ['#2e3a32', 18], ['#cfd1cb', 30]], 'rgba(0,0,0,.35)', 0.7),
  rhyolite: (rand, w, h) => `<rect width="${w}" height="${h}" fill="#d6a797"/>` + specks(rand, w, h, 380, ['#c28877', '#ebd0c3', '#a9786a']) + [0.2, 0.38, 0.55, 0.72, 0.9].map(f => line(wave(rand, h * f, w, 5, 0.04), 'rgba(140,80,70,.32)', 2.5)).join('') + specks(rand, w, h, 10, ['#f2f0ea'], [2.5, 4]),
  andesite: (rand, w, h) => {
    let out = `<rect width="${w}" height="${h}" fill="#8d8e8b"/>` + specks(rand, w, h, 420, ['#777976', '#a5a6a2', '#5f615e']);
    for (let i = 0; i < 22; i++) {
      const x = rand() * w, y = rand() * h, lw = 6 + rand() * 7, lh = 2.4 + rand() * 1.6, rot = r1(rand() * 180);
      out += `<rect x="${r1(x - lw / 2)}" y="${r1(y - lh / 2)}" width="${r1(lw)}" height="${r1(lh)}" fill="${i % 3 ? '#e9e7df' : '#1f1f1f'}" transform="rotate(${rot} ${r1(x)} ${r1(y)})"/>`;
    }
    return out;
  },
  basalt: (rand, w, h) => `<rect width="${w}" height="${h}" fill="#3c3e41"/>` + specks(rand, w, h, 450, ['#2e3033', '#56595c', '#46484b']) + dots(rand, w, h, 7, ['#1b1c1e'], [1.2, 1.5]),
  obsidian: (rand, w, h) => {
    let out = `<rect width="${w}" height="${h}" fill="#121214"/>`;
    for (const [cx, cy] of [[w * 0.25, h * 0.9], [w * 0.8, h * 0.2], [w * 0.6, h * 1.1]]) {
      for (let k = 1; k <= 6; k++) {
        const rr = 14 * k + rand() * 6;
        out += `<path d="M${r1(cx - rr)} ${r1(cy)}A${r1(rr)} ${r1(rr * 0.8)} 0 0 1 ${r1(cx + rr)} ${r1(cy)}" fill="none" stroke="rgba(255,255,255,${k % 2 ? 0.1 : 0.06})" stroke-width="1.2"/>`;
      }
    }
    return out + `<ellipse cx="${w * 0.42}" cy="${h * 0.3}" rx="${w * 0.32}" ry="${h * 0.12}" transform="rotate(-14 ${w * 0.42} ${h * 0.3})" fill="#fff" opacity=".08"/><path d="M${w * 0.2} ${h * 0.33}Q${w * 0.4} ${h * 0.18} ${w * 0.66} ${h * 0.2}" stroke="#fff" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round"/>`;
  },
  pumice: (rand, w, h) => {
    const g = group();
    for (let i = 0; i < 150; i++) {
      const x = Math.round(rand() * w), y = Math.round(rand() * h), rx = r1(1.6 + rand() * 4.6), ry = r1(rx * (0.35 + rand() * 0.3));
      g.add('fill="#a8a092"', `M${r1(x - rx)} ${y}a${rx} ${ry} 0 1 0 ${r1(2 * rx)} 0a${rx} ${ry} 0 1 0 ${r1(-2 * rx)} 0`);
    }
    return `<rect width="${w}" height="${h}" fill="#e5e1d6"/>` + specks(rand, w, h, 200, ['#d6d1c4', '#f1eee6']) + g.svg();
  },
  scoria: (rand, w, h) => {
    let out = `<rect width="${w}" height="${h}" fill="#5c2f24"/>` + specks(rand, w, h, 260, ['#4a241b', '#74402f', '#3a1d17']);
    for (let i = 0; i < 46; i++) {
      const x = rand() * w, y = rand() * h, rr = 2.8 + rand() * 6.5;
      out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(rr)}" fill="#24120e" stroke="#7d4535" stroke-width="1.2"/>`;
    }
    return out;
  },
  magma: (rand, w, h, comp) => {
    const base = { felsic: '#8a2410', intermediate: '#a52f0f', mafic: '#c03a0c' }[comp] ?? '#a52f0f';
    let out = `<rect width="${w}" height="${h}" fill="${base}"/>`;
    for (let i = 0; i < 9; i++) out += line(wave(rand, h * (0.06 + i * 0.11), w, 6 + rand() * 6, 0.03 + rand() * 0.02, undefined, 8), i % 2 ? '#f07a2c' : '#ffb347', r1(2.5 + rand() * 4), ' opacity=".75"');
    out += dots(rand, w, h, 16, ['#ffd86b'], [1.5, 2.5], 0.9);
    const crystalsN = { felsic: 26, intermediate: 16, mafic: 8 }[comp] ?? 12;
    out += specks(rand, w, h, crystalsN, ['#3a1208', '#f4e3c8'], [2, 4]);
    for (let i = 0; i < 6; i++) out += `<circle cx="${r1(rand() * w)}" cy="${r1(rand() * h)}" r="${r1(2 + rand() * 3)}" fill="none" stroke="#5a1a0a" stroke-width="1.2" opacity=".7"/>`;
    return out;
  },
  sediment: (rand, w, h) => {
    let out = `<rect width="${w}" height="${h}" fill="#e9eef0"/>`;
    for (const f of [0.18, 0.45, 0.72, 0.95]) out += line(wave(rand, h * f, w, 4, 0.05), 'rgba(70,140,160,.35)', 1.5);
    out += dots(rand, w, h, 150, ['#c9a77a', '#b08a5f', '#e0c9a0', '#8d7a66'], [0.8, 1.6]);
    for (let i = 0; i < 26; i++) {
      const x = rand() * w, y = rand() * h, s = 3 + rand() * 6, n = 5;
      const poly = Array.from({ length: n }, (_, k) => { const a = (k / n) * 6.283 + rand() * 0.6; const rr = s * (0.6 + rand() * 0.5); return [x + rr * Math.cos(a), y + rr * Math.sin(a)]; });
      out += polyPath(poly, ['#a39889', '#d8c3a5', '#6f6458', '#c8b9a6'][i % 4], ' stroke="rgba(60,50,40,.4)" stroke-width=".7"');
    }
    return out;
  },
  gravel: (rand, w, h) => `<rect width="${w}" height="${h}" fill="#e7dcc7"/>` + dots(rand, w, h, 260, ['#cdb995', '#bca57d'], [0.7, 1.2]) + pebbles(rand, w, h, 34, ['#9b9086', '#cbc4b6', '#7d6b5c', '#b98f6b', '#e6dfd3', '#6e7277'], [7, 16], 'rgba(60,50,40,.55)'),
  conglomerate: (rand, w, h) => `<rect width="${w}" height="${h}" fill="#c3a37b"/>` + specks(rand, w, h, 280, ['#b08f66', '#d4b892', '#9c7b55']) + pebbles(rand, w, h, 40, ['#9b9086', '#cbc4b6', '#7d6b5c', '#b98f6b', '#e6dfd3', '#6e7277'], [6, 15], 'rgba(50,35,25,.7)'),
  sand: (rand, w, h) => `<rect width="${w}" height="${h}" fill="#efe1c2"/>` + [0.3, 0.62, 0.9].map(f => line(wave(rand, h * f, w, 3, 0.09), 'rgba(170,130,80,.35)', 1.3)).join('') + dots(rand, w, h, 520, ['#d9b97f', '#c9a467', '#e8d2a6', '#b58d55', '#f3e6cb'], [0.9, 1.3]),
  sandstone: (rand, w, h) => {
    let out = `<rect width="${w}" height="${h}" fill="#d09a68"/>`;
    for (let k = 0; k < 9; k++) out += line([[k * 34 - 40, h * 0.5], [k * 34 + 30, h * 0.08]], 'rgba(130,70,35,.28)', 1.4) + line([[k * 30 - 30, h * 1.02], [k * 30 + 40, h * 0.58]], 'rgba(130,70,35,.25)', 1.4);
    out += line([[0, h * 0.53], [w, h * 0.5]], 'rgba(120,60,30,.45)', 1.8);
    return out + dots(rand, w, h, 480, ['#e2b483', '#c4895a', '#ecc9a0', '#b97a4c'], [0.8, 1.2]);
  },
  mud: (rand, w, h) => {
    const g = group();
    for (let k = 0; k < 16; k++) g.add(strokeAttrs(k % 2 ? 'rgba(60,50,38,.35)' : 'rgba(190,175,150,.3)', 1.6), rel(wave(rand, (k + 0.5) * (h / 16), w, 1.6, 0.03, undefined, 10)));
    return `<rect width="${w}" height="${h}" fill="#8a7a64"/>` + g.svg() + `<ellipse cx="${w * 0.35}" cy="${h * 0.25}" rx="${w * 0.25}" ry="${h * 0.07}" fill="#fff" opacity=".1"/>`;
  },
  shale: (rand, w, h) => {
    const g = group();
    for (let k = 0; k < 26; k++) g.add(strokeAttrs(k % 3 === 0 ? '#4f4b47' : k % 3 === 1 ? '#74706a' : '#6a6661', 2.6), rel(wave(rand, (k + 0.5) * (h / 26), w, 0.8, 0.02, undefined, 12)));
    let out = `<rect width="${w}" height="${h}" fill="#625e59"/>` + g.svg();
    for (let k = 0; k < 3; k++) { const x = 30 + rand() * (w - 60), y = rand() * h; out += line([[x, y], [x + 18, y + 3], [x + 40, y + 2]], 'rgba(30,28,25,.6)', 1); }
    return out;
  },
  shells: (rand, w, h) => {
    let out = `<rect width="${w}" height="${h}" fill="#ece3cf"/>` + dots(rand, w, h, 240, ['#d9ccb0', '#f6f0e3'], [0.7, 1.4]);
    for (let i = 0; i < 18; i++) out += shell(rand, rand() * w, rand() * h, 8 + rand() * 8, i % 3 ? '#f7f0e3' : '#e6d2b0', '#9d8a6c');
    for (let i = 0; i < 3; i++) out += spiral(20 + rand() * (w - 40), 20 + rand() * (h - 40), 14 + rand() * 6, '#9d8a6c');
    return out;
  },
  limestone: (rand, w, h) => {
    let out = `<rect width="${w}" height="${h}" fill="#cfcabe"/>` + specks(rand, w, h, 280, ['#c2bdb0', '#dcd8cd', '#b8b2a4']);
    for (let i = 0; i < 10; i++) out += shell(rand, rand() * w, rand() * h, 8 + rand() * 7, '#e4e0d6', '#6f685c');
    for (let i = 0; i < 4; i++) { const x = rand() * w, y = rand() * h; out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="4" fill="#e4e0d6" stroke="#6f685c"/><circle cx="${r1(x)}" cy="${r1(y)}" r="1.2" fill="#6f685c"/>`; }
    return out + spiral(w * 0.72, h * 0.62, 18, '#6f685c');
  },
  slate: (rand, w, h) => {
    let out = `<rect width="${w}" height="${h}" fill="#3e454d"/>`;
    for (let k = -10; k < 44; k++) { const y = k * 4.2; out += line([[0, y], [w, y + w * 0.12]], k % 2 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.18)', 1); }
    return out + `<rect y="${h * 0.42}" width="${w}" height="${h * 0.12}" fill="#fff" opacity=".05" transform="rotate(6.8 0 ${h * 0.42})"/>`;
  },
  phyllite: (rand, w, h) => {
    const g = group();
    for (let k = 0; k < 30; k++) g.add(strokeAttrs(k % 2 ? 'rgba(230,240,235,.4)' : 'rgba(40,50,45,.3)', 0.9), rel(wave(rand, (k + 0.5) * (h / 30), w, 1.6, 0.22, k * 0.3, 5)));
    return `<rect width="${w}" height="${h}" fill="#7a8580"/>` + g.svg() + `<ellipse cx="${w * 0.55}" cy="${h * 0.4}" rx="${w * 0.4}" ry="${h * 0.16}" fill="#fff" opacity=".16" transform="rotate(-8 ${w * 0.55} ${h * 0.4})"/>`;
  },
  schist: (rand, w, h) => {
    const g = group(), flakes = group();
    const rows = 13;
    for (let k = 0; k < rows; k++) {
      const y0 = (k + 0.5) * (h / rows), phase = 1.3, slope = x => 3.5 * 0.045 * Math.cos(x * 0.045 + phase);
      const yAt = x => y0 + 3.5 * Math.sin(x * 0.045 + phase) + 1.4 * Math.sin(x * 0.1 + phase * 1.7);
      g.add(strokeAttrs('rgba(55,50,45,.45)', 1.1), rel(wave(rand, y0, w, 3.5, 0.045, phase, 6)));
      for (let i = 0; i < 20; i++) {
        const x = rand() * w, y = yAt(x) + (rand() - 0.5) * 7, len = 3 + rand() * 5, a = Math.atan(slope(x)) + (rand() - 0.5) * 0.4;
        flakes.add(strokeAttrs(['#f4f1e8', '#3b3732', '#cfc9ba', '#fffdf6'][Math.floor(rand() * 4)], 2.2), rel([[x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2], [x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2]]));
      }
    }
    let out = `<rect width="${w}" height="${h}" fill="#8e8a81"/>` + g.svg() + flakes.svg();
    for (let i = 0; i < 7; i++) {
      const x = 15 + rand() * (w - 30), y = 12 + rand() * (h - 24), s = 4 + rand() * 2.5;
      const hex = Array.from({ length: 6 }, (_, k) => [x + s * Math.cos(k * 1.047), y + s * Math.sin(k * 1.047)]);
      out += polyPath(hex, '#8a2a2a', ' stroke="#5a1717" stroke-width="1"') + `<circle cx="${r1(x - s * 0.3)}" cy="${r1(y - s * 0.3)}" r="${r1(s * 0.25)}" fill="#fff" opacity=".45"/>`;
    }
    return out;
  },
  gneiss: (rand, w, h) => {
    const colors = ['#e6dccd', '#3a3531', '#dcb8a6', '#2f2b28', '#ece4d7', '#46403a', '#d7b09c', '#3a3531'];
    const n = colors.length;
    const bounds = Array.from({ length: n + 1 }, (_, k) => wave(rand, -8 + (k * (h + 16)) / n + (rand() - 0.5) * 6, w, 6, 0.035, 0.6 + k * 0.15, 4));
    let out = '';
    for (let k = 0; k < n; k++) out += polyPath([...bounds[k], ...bounds[k + 1].slice().reverse()], colors[k]);
    return out + specks(rand, w, h, 160, ['rgba(255,255,255,.35)', 'rgba(0,0,0,.25)'], [1.5, 3]);
  },
  greenschist: (rand, w, h) => {
    const g = group(), flakes = group();
    for (let k = 0; k < 18; k++) {
      const pts = wave(rand, (k + 0.5) * (h / 18), w, 2.5, 0.05, 0.4, 6);
      g.add(strokeAttrs('rgba(35,55,35,.5)', 1.2), rel(pts));
      for (let i = 0; i < pts.length - 1; i += 2) flakes.add(strokeAttrs(['#93b083', '#3d5a3d', '#b6c99f'][Math.floor(rand() * 3)], 1.8, ' opacity=".8"'), rel([pts[i], pts[i + 1]]));
    }
    return `<rect width="${w}" height="${h}" fill="#5d7a59"/>` + g.svg() + flakes.svg();
  },
};
export const TEXTURE_IDS = Object.keys(TEXTURES);

const TEXTURE_WORDS = {
  granite: 'big pink, white, gray and black crystals locked together', diorite: 'black and white crystals locked together, like salt and pepper',
  gabbro: 'dark crystals locked together', marble: 'pale, sugary crystals locked together, with faint gray veins', quartzite: 'tightly fused pale grains',
  amphibolite: 'long black crystals lined up, with white specks', rhyolite: 'pink rock with tiny specks and faint flow bands', andesite: 'gray rock with tiny specks and a few larger crystals',
  basalt: 'dark gray rock with tiny specks', obsidian: 'smooth black glass with curved, shell-like ripples', pumice: 'pale rock full of small gas holes',
  scoria: 'dark red-brown rock full of round holes', magma: 'glowing orange and red swirls of molten rock', sediment: 'loose grains and rock bits scattered in water',
  gravel: 'loose rounded pebbles and sand', conglomerate: 'rounded pebbles glued in a sandy background', sand: 'loose sand grains with ripple marks',
  sandstone: 'reddish sand grains with slanting layers', mud: 'brown mud in thin wet layers', shale: 'gray rock in very thin layers',
  shells: 'loose shells and coral pieces', limestone: 'pale gray rock with fossil shells', slate: 'dark gray rock with fine parallel lines',
  phyllite: 'silvery green rock with crinkly, shiny lines', schist: 'wavy layers of glittering mica flakes with red garnets', gneiss: 'wavy light and dark stripes',
  greenschist: 'green rock in flaky, wavy layers',
};

/** A rock card drawing: a complete <svg>. label overrides the accessible name (used to hide the answer in challenges). */
export function swatchSvg(id, { comp, label, className = 'rk-swatch' } = {}) {
  const m = MATERIALS[id];
  const { w, h } = SWATCH;
  const rand = rng(hash(`${m.texture}:${id}:${comp ?? m.comp ?? ''}`));
  const inner = TEXTURES[m.texture](rand, w, h, comp ?? m.comp);
  const name = label ?? `Drawing of ${m.name.toLowerCase()}: ${TEXTURE_WORDS[m.texture]}`;
  return `<svg class="${className}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
}
export const textureWords = id => TEXTURE_WORDS[MATERIALS[id].texture];

// ---------- Cross-section of the crust ----------
export const SECTION = { width: 800, height: 470 };
const X0 = 46, Y0 = 110, K = 7; // depth axis edge, sea level (0 km) and pixels per km
export const depthY = km => Y0 + km * K;
// The land and sea floor, drawn smooth through these points (heights above ground are exaggerated).
const SURFACE_PTS = [[40, 146], [90, 145], [118, 139], [140, 125], [170, 120], [222, 119], [248, 116], [262, 110], [290, 106], [322, 103], [352, 100], [382, 93], [412, 72], [440, 45], [458, 35], [478, 41], [506, 62], [536, 83], [566, 92], [600, 81], [626, 57], [646, 36], [656, 30], [662, 35], [668, 30], [678, 36], [700, 58], [730, 80], [770, 90], [806, 93]];
function catmull(points, steps = 8) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
const SURFACE = catmull(SURFACE_PTS);
export function surfaceY(x) {
  for (let i = 1; i < SURFACE.length; i++) if (SURFACE[i][0] >= x) {
    const [xa, ya] = SURFACE[i - 1], [xb, yb] = SURFACE[i];
    return ya + (yb - ya) * (x - xa) / (xb - xa || 1);
  }
  return SURFACE[SURFACE.length - 1][1];
}
const bump = u => (Math.abs(u) >= 1 ? 0 : (1 - u * u) ** 2);
const moho = x => depthY(35) + 6 * K * bump((x - 458) / 130);
const basinBase = x => surfaceY(x) + Math.max(0, 6 * (1 - (x - X0) / 330)) * K;
const range = (a, b, step) => { const out = []; for (let x = a; x < b; x += step) out.push(x); out.push(b); return out; };

// Where the rock sits for each place: [x, depth km] (null depth: on the surface).
const POS = {
  land: [502, null], volcano: [700, null], stream: [386, null], river: [348, null], beach: [272, null], reef: [196, null], seafloor: [88, null],
  buried: [196, 3], pluton: [585, 8.5], meta1: [462, 10], meta2: [462, 14], meta3: [462, 20], meta4: [462, 28],
  'melt-felsic': [652, 29], 'melt-intermediate': [690, 36], 'melt-mafic': [724, 44],
};
export function placeXY(place) {
  const [x, km] = POS[place];
  return [x, r1(km === null ? surfaceY(x) - 5 : depthY(km))];
}
// The zone label that lights up for each process.
const zoneOf = code => (code === 'cs' ? 'slow' : ['cf', 'cg', 'cv'].includes(code) ? 'fast' : code ? OPTION_BY_CODE[code].process : '');
export const FAMILY_COLORS = { magma: '#d8431b', intrusive: '#a8452a', extrusive: '#c4643a', sediment: '#8d7a5b', sedimentary: '#b8862b', metamorphic: '#6b5b95' };

function staticSection() {
  const out = [];
  const W = SECTION.width, H = SECTION.height;
  out.push(`<rect class="rx-sky" x="${X0}" y="0" width="${W - X0}" height="${Y0 + 40}"/>`);
  // Sun and its energy.
  const sun = [96, 40];
  let rays = '';
  for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.283; rays += `M${r1(sun[0] + 21 * Math.cos(a))} ${r1(sun[1] + 21 * Math.sin(a))}L${r1(sun[0] + 29 * Math.cos(a))} ${r1(sun[1] + 29 * Math.sin(a))}`; }
  out.push(`<g class="rx-sun"><path d="${rays}"/><circle cx="${sun[0]}" cy="${sun[1]}" r="15"/></g>`);
  // A rain cloud over the mountains: weathering.
  out.push(`<g class="rx-cloud"><path class="rx-rain" d="M392 40l-6 16M404 40l-6 16M416 40l-6 16M428 40l-6 16"/><circle cx="398" cy="28" r="11"/><circle cx="414" cy="22" r="14"/><circle cx="431" cy="29" r="10"/><rect x="389" y="28" width="50" height="11" rx="5"/></g>`);
  // Mantle and crust.
  out.push(`<rect class="rx-mantle" x="${X0}" y="${depthY(30)}" width="${W - X0}" height="${H - depthY(30)}"/>`);
  for (let k = 0; k < 4; k++) out.push(`<rect class="rx-heat" x="${X0}" y="${r1(depthY(38 + k * 3))}" width="${W - X0}" height="${H}" opacity="${0.1 + k * 0.06}"/>`);
  const crustTop = SURFACE.filter(([x]) => x >= X0 - 6 && x <= W + 6);
  out.push(`<path class="rx-crust" d="${pathD([...crustTop, ...range(X0, W, 8).reverse().map(x => [x, moho(x)])], true)}"/>`);
  out.push(`<path class="rx-moho" d="${pathD(range(X0, W, 8).map(x => [x, moho(x)]))}"/>`);
  // Sea water.
  const sea = SURFACE.filter(([x]) => x <= 264);
  out.push(`<path class="rx-water" d="${pathD([[X0, Y0], [264, Y0], ...sea.slice().reverse().filter(([x]) => x >= X0)], true)}"/>`);
  // Sedimentary layers under the sea and the coastal plain.
  const xs = range(X0, X0 + 330, 6);
  const tones = ['rx-bed1', 'rx-bed2', 'rx-bed3', 'rx-bed4', 'rx-bed5'];
  for (let k = 0; k < tones.length; k++) {
    const top = xs.map(x => [x, surfaceY(x) + (basinBase(x) - surfaceY(x)) * (k / tones.length)]);
    const bot = xs.map(x => [x, surfaceY(x) + (basinBase(x) - surfaceY(x)) * ((k + 1) / tones.length)]);
    out.push(`<path class="${tones[k]}" d="${pathD([...top, ...bot.reverse()], true)}"/>`);
  }
  // Metamorphic zone under the mountains, in grade bands.
  const [mx0, mx1] = [392, 536];
  const bands = [8, 12, 16, 24, 32];
  for (let k = 0; k < 4; k++) {
    const y0 = depthY(bands[k]), y1 = depthY(bands[k + 1]);
    out.push(`<rect class="rx-grade rx-grade-${k + 1}" x="${mx0}" y="${r1(y0)}" width="${mx1 - mx0}" height="${r1(y1 - y0)}"${k === 0 ? ' rx="10"' : k === 3 ? ' rx="10"' : ''}/>`);
  }
  for (let k = 0; k < 5; k++) {
    const y = depthY(10 + k * 5);
    out.push(`<path class="rx-foliation" d="${pathD(range(mx0 + 8, mx1 - 8, 6).map(x => [x, y + 3 * Math.sin((x - mx0) * 0.09 + k)]))}"/>`);
  }
  // Uplift arrow beside the mountain root.
  out.push(`<path class="rx-uplift" d="M552 ${depthY(30)}V${r1(depthY(3))}"/><path class="rx-uplift-head" d="M544 ${r1(depthY(3) + 8)}L552 ${r1(depthY(3) - 6)}L560 ${r1(depthY(3) + 8)}Z"/>`);
  // Melting zone, rising magma, the magma chamber, a cooled pluton and the volcano's lava.
  out.push(`<path class="rx-melt" d="M612 ${depthY(30)}C620 ${depthY(25)} 700 ${depthY(24)} 742 ${depthY(30)}C770 ${depthY(36)} 772 ${depthY(46)} 748 ${depthY(49)}C700 ${depthY(51)} 640 ${depthY(48)} 626 ${depthY(42)}C612 ${depthY(37)} 606 ${depthY(33)} 612 ${depthY(30)}Z"/>`);
  const drops = [[640, 30], [668, 27.5], [700, 29], [728, 31], [652, 36], [684, 34], [716, 38], [742, 41], [664, 43], [700, 45.5], [732, 47]];
  out.push(`<g class="rx-drops">${drops.map(([x, km]) => `<circle cx="${x}" cy="${r1(depthY(km))}" r="3.2"/>`).join('')}</g>`);
  out.push(`<path class="rx-conduit" d="M682 ${depthY(25)}C676 ${depthY(20)} 672 ${depthY(15)} 664 ${depthY(10.5)}M662 ${depthY(7)}V${r1(surfaceY(662) + 2)}"/>`);
  out.push(`<ellipse class="rx-chamber" cx="662" cy="${r1(depthY(9))}" rx="30" ry="14"/>`);
  out.push(`<ellipse class="rx-pluton" cx="585" cy="${r1(depthY(8.5))}" rx="25" ry="34"/>`);
  out.push(`<path class="rx-lava" d="${pathD(range(668, 724, 4).map(x => [x, surfaceY(x) - 1.5]))}"/>`);
  out.push(`<path class="rx-river" d="M338 ${r1(surfaceY(338))}Q348 ${r1(surfaceY(348) + 5)} 358 ${r1(surfaceY(358))}Z"/>`);
  out.push(`<path class="rx-ground" d="${pathD(crustTop)}"/>`);
  // Internal heat arrows.
  out.push(`<g class="rx-heat-arrows">${[120, 300, 480, 760].map(x => `<path d="M${x} ${H - 8}v-16m-5 5l5-5l5 5"/>`).join('')}</g>`);
  return out.join('');
}
const STATIC = staticSection();

// Labels: [x, y, text, anchor, kind, zone]. kind 'minor' labels are hidden on phones.
const LABELS = [
  [96, 84, 'Sun', 'middle', 'minor', ''],
  [356, 18, 'Weathering & erosion', 'end', '', 'weather'],
  [150, 100, 'Deposition', 'middle', '', 'deposit'],
  [70, 132, 'Sea', 'middle', 'minor', ''],
  [196, 165, 'Compaction &', 'middle', '', 'lithify'],
  [196, 187, 'cementation', 'middle', '', 'lithify'],
  [464, 158, 'Heat & pressure', 'middle', '', 'meta'],
  [400, depthY(10) + 4, 'very low', 'start', 'minor', ''],
  [400, depthY(14) + 4, 'low', 'start', 'minor', ''],
  [400, depthY(20) + 4, 'medium', 'start', 'minor', ''],
  [400, depthY(28) + 4, 'high grade', 'start', 'minor', ''],
  [562, depthY(22), 'Uplift', 'start', '', 'uplift'],
  [585, 120, 'Slow cooling', 'middle', '', 'slow'],
  [792, 22, 'Lava cools fast', 'end', '', 'fast'],
  [690, depthY(24) - 6, 'Melting', 'middle', '', 'melt'],
  [120, depthY(22), 'Crust', 'middle', 'minor', ''],
  [120, depthY(41), 'Mantle', 'middle', 'minor', ''],
  [420, SECTION.height - 10, 'Earth’s internal heat', 'middle', 'minor', ''],
];
const DEPTH_TICKS = [0, 10, 20, 30, 40, 50];

/**
 * The cross-section with the journey drawn on it. states: every state visited, oldest first;
 * active: the code of the last step (its zone label is highlighted).
 */
export function sectionSvg(states, { active = '' } = {}) {
  const out = [STATIC];
  out.push('<g class="rx-labels">' + LABELS.map(([x, y, text, anchor, kind, zone]) => `<text class="rx-label${kind ? ' ' + kind : ''}${zone ? ' rx-zone' : ''}${zone && zone === zoneOf(active) ? ' on' : ''}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${esc(text)}</text>`).join('') + '</g>');
  // The journey: a dashed trail through every place visited, numbered.
  const pts = states.map(s => placeXY(s.place));
  if (pts.length > 1) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const bend = Math.min(40, len * 0.18) * (i % 2 ? 1 : -1);
      const cx = (ax + bx) / 2 - ((by - ay) / len) * bend, cy = (ay + by) / 2 + ((bx - ax) / len) * bend;
      d += `Q${r1(cx)} ${r1(cy)} ${bx} ${by}`;
    }
    out.push(`<path class="rx-trail" d="${d}"/>`);
    const shown = new Set();
    const marks = [];
    for (let i = pts.length - 2; i >= 0; i--) {
      const k = pts[i].join(',');
      marks.push(`<circle class="rx-stop" cx="${pts[i][0]}" cy="${pts[i][1]}" r="4.5"/>`);
      if (!shown.has(k) && shown.size < 8) { shown.add(k); marks.push(`<text class="rx-stop-n minor" x="${pts[i][0] + 7}" y="${pts[i][1] - 6}">${i === 0 ? 'Start' : i}</text>`); }
    }
    out.push(`<g class="rx-stops">${marks.reverse().join('')}</g>`);
  }
  // The rock itself.
  const now = states[states.length - 1];
  const [x, y] = pts[pts.length - 1];
  const m = MATERIALS[now.id];
  const color = FAMILY_COLORS[m.family];
  const name = m.name;
  const tw = Math.round(name.length * 7.4 + 16);
  const left = x > 560;
  const tx = left ? -tw - 16 : 16;
  out.push(`<g class="rx-marker" data-marker transform="translate(${x} ${y})"><circle class="rx-halo" r="17"/><circle class="rx-dot" r="10" fill="${color}"/><g class="rx-tag"><rect x="${tx}" y="-12" width="${tw}" height="24" rx="12"/><text x="${tx + tw / 2}" y="5" text-anchor="middle">${esc(name)}</text></g></g>`);
  // Depth axis.
  out.push(`<rect class="rx-axis-bg" x="0" y="0" width="${X0}" height="${SECTION.height}"/>`);
  for (const km of DEPTH_TICKS) out.push(`<path class="rx-tick" d="M${X0 - 10} ${depthY(km)}H${X0}"/><text class="rx-axis" x="${X0 - 13}" y="${depthY(km) + 4}" text-anchor="end">${km}</text>`);
  out.push(`<text class="rx-axis rx-axis-title" x="4" y="${Y0 - 34}">Depth</text><text class="rx-axis rx-axis-title" x="4" y="${Y0 - 18}">(km)</text>`);
  return out.join('');
}
/** One sentence describing where the rock is now, for the SVG's accessible name. */
export function describeSection(states) {
  const now = states[states.length - 1];
  const m = MATERIALS[now.id];
  const where = PLACES[now.place];
  const depth = where.depth[1] === 0 ? 'at the surface' : `about ${fmtRange(where.depth)} km down`;
  return `Cross-section of Earth’s crust from the sea to a mountain range and a volcano, showing where each process happens. ${m.name} is ${where.name.toLowerCase()}, ${depth}.${states.length > 1 ? ` A dashed trail shows its ${states.length - 1}-step journey.` : ''}`;
}

// ---------- The rock cycle diagram ----------
export const CYCLE_VIEW = { width: 380, height: 312 };
const NODE_POS = { sediment: [190, 30], igneous: [80, 128], sedimentary: [300, 128], magma: [100, 268], metamorphic: [280, 268] };
const NODE_W = 124, NODE_H = 34;
// [from, to, label, kind]: 'loop' is the classic textbook loop; 'short' a shortcut.
export const CYCLE_EDGES = [
  ['magma', 'igneous', 'Cooling', 'loop'],
  ['igneous', 'sediment', 'Weathering & erosion', 'loop'],
  ['sediment', 'sedimentary', 'Deposition, compaction & cementation', 'loop'],
  ['sedimentary', 'metamorphic', 'Heat & pressure', 'loop'],
  ['metamorphic', 'magma', 'Melting', 'loop'],
  ['igneous', 'metamorphic', 'Heat & pressure', 'short'],
  ['sedimentary', 'magma', 'Melting', 'short'],
  ['igneous', 'magma', 'Melting', 'short'],
  ['sedimentary', 'sediment', 'Weathering & erosion', 'short'],
  ['metamorphic', 'sediment', 'Weathering & erosion', 'short'],
  ['metamorphic', 'metamorphic', 'More heat & pressure', 'short'],
];
/** Counts how many times a journey used each arrow of the diagram. */
export function cycleUse(states) {
  const use = {};
  for (let i = 1; i < states.length; i++) {
    const a = nodeOf(MATERIALS[states[i - 1].id].family), b = nodeOf(MATERIALS[states[i].id].family);
    if (a === b && a !== 'metamorphic') continue;
    if (a === b && states[i - 1].id === states[i].id) continue; // uplift
    use[`${a}>${b}`] = (use[`${a}>${b}`] ?? 0) + 1;
  }
  return use;
}
function edgeGeometry(from, to, kind) {
  const [ax, ay] = NODE_POS[from], [bx, by] = NODE_POS[to];
  if (from === to) return { d: `M${ax + 63} ${ay - 9}C${ax + 100} ${ay - 32} ${ax + 100} ${ay + 32} ${ax + 66} ${ay + 10}`, end: [ax + 66, ay + 10], dir: [-0.87, -0.49], mid: [ax + 90, ay] };
  const cx0 = 190, cy0 = 165;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const len = Math.hypot(bx - ax, by - ay);
  // Outer loop arrows bow outward; shortcuts bow a little to one side so pairs don't overlap.
  let nx = -(by - ay) / len, ny = (bx - ax) / len;
  const out = (mx - cx0) * nx + (my - cy0) * ny > 0 ? 1 : -1;
  const bow = kind === 'loop' ? 26 * out : -16 * out;
  const cx = mx + nx * bow, cy = my + ny * bow;
  // Trim the ends to the node boxes.
  const trim = (px, py, qx, qy) => {
    const dx = qx - px, dy = qy - py, tx = (NODE_W / 2 + 4) / Math.abs(dx || 1e-9), ty = (NODE_H / 2 + 4) / Math.abs(dy || 1e-9);
    const t = Math.min(tx, ty, 0.45);
    return [px + dx * t, py + dy * t];
  };
  const s = trim(ax, ay, cx, cy), e = trim(bx, by, cx, cy);
  const dir = [e[0] - cx, e[1] - cy];
  const dl = Math.hypot(...dir) || 1;
  return { d: `M${r1(s[0])} ${r1(s[1])}Q${r1(cx)} ${r1(cy)} ${r1(e[0])} ${r1(e[1])}`, end: e, dir: [dir[0] / dl, dir[1] / dl], mid: [0.25 * s[0] + 0.5 * cx + 0.25 * e[0], 0.25 * s[1] + 0.5 * cy + 0.25 * e[1]], out: [nx * out, ny * out] };
}
const LOOP_LABEL_AT = {
  'magma>igneous': [62, 204, 'end'], 'igneous>sediment': [98, 56, 'end'], 'sediment>sedimentary': [284, 56, 'start'],
  'sedimentary>metamorphic': [328, 198, 'start'], 'metamorphic>magma': [190, 308, 'middle'],
};
/** The rock cycle diagram, with the arrows a journey used highlighted and the current stop marked. */
export function cycleSvg(states) {
  const use = cycleUse(states);
  const here = nodeOf(MATERIALS[states[states.length - 1].id].family);
  const out = [];
  for (const [from, to, label, kind] of CYCLE_EDGES) {
    const k = `${from}>${to}`, g = edgeGeometry(from, to, kind), n = use[k] ?? 0;
    const [ex, ey] = g.end, [dx, dy] = g.dir;
    const head = `M${r1(ex)} ${r1(ey)}L${r1(ex - dx * 9 - dy * 5)} ${r1(ey - dy * 9 + dx * 5)}L${r1(ex - dx * 9 + dy * 5)} ${r1(ey - dy * 9 - dx * 5)}Z`;
    out.push(`<g class="cy-edge cy-${kind}${n ? ' used' : ''}"><title>${esc(`${NODE_NAMES[from]} to ${NODE_NAMES[to].toLowerCase()}: ${label}`)}</title><path class="cy-line" d="${g.d}"/><path class="cy-head" d="${head}"/>`
      + (n ? `<circle class="cy-count" cx="${r1(g.mid[0])}" cy="${r1(g.mid[1])}" r="9"/><text class="cy-count-n" x="${r1(g.mid[0])}" y="${r1(g.mid[1] + 4)}" text-anchor="middle">${n}</text>` : '') + '</g>');
  }
  for (const [k, [x, y, anchor]] of Object.entries(LOOP_LABEL_AT)) {
    const label = CYCLE_EDGES.find(([f, t]) => `${f}>${t}` === k)[2];
    const words = label === 'Deposition, compaction & cementation' ? ['Deposition,', 'compaction &', 'cementation'] : label === 'Weathering & erosion' ? ['Weathering', '& erosion'] : label === 'Heat & pressure' ? ['Heat &', 'pressure'] : [label];
    out.push(`<text class="cy-label" x="${x}" y="${y}" text-anchor="${anchor}">${words.map((w, i) => `<tspan x="${x}" dy="${i ? 12 : 0}">${esc(w)}</tspan>`).join('')}</text>`);
  }
  for (const [node, [x, y]] of Object.entries(NODE_POS)) {
    out.push(`<g class="cy-node cy-node-${node}${node === here ? ' here' : ''}"><rect x="${x - NODE_W / 2}" y="${y - NODE_H / 2}" width="${NODE_W}" height="${NODE_H}" rx="17"/><text x="${x}" y="${y + 5}" text-anchor="middle">${esc(NODE_NAMES[node])}</text></g>`);
  }
  return out.join('');
}
export function describeCycle(states) {
  const use = cycleUse(states);
  const here = NODE_NAMES[nodeOf(MATERIALS[states[states.length - 1].id].family)].toLowerCase();
  const used = CYCLE_EDGES.filter(([f, t]) => use[`${f}>${t}`]).map(([f, t, label]) => `${NODE_NAMES[f].toLowerCase()} to ${NODE_NAMES[t].toLowerCase()} (${label.toLowerCase()})`);
  return `Rock cycle diagram: magma, igneous rock, sediment, sedimentary rock and metamorphic rock, joined by arrows for the classic loop and for shortcuts. You are at ${here}.${used.length ? ` Your journey used: ${used.join('; ')}.` : ''}`;
}

// ---------- HTML panels ----------
const meltLine = (id, comp) => {
  const fam = MATERIALS[id].family;
  if (fam === 'magma') return 'Already molten. Cool it to make igneous rock.';
  if (fam === 'sediment') return 'Not rock yet: it must be buried and cemented before it can melt.';
  if (comp === 'quartz') return 'Doesn’t melt in the crust: quartz needs about 1,700 °C.';
  if (comp === 'carbonate') return 'Doesn’t melt in the crust: calcite needs far more heat than the crust reaches.';
  return `Melts into ${MATERIALS[magmaOf(comp)].name.toLowerCase()} at about ${fmtRange(MELT_C[comp], ' °C')}.`;
};
/** The rock card for a state: drawing, family, look, how it forms, everyday example, what it's made of. */
export function cardHtml(state, { headingLevel = 3 } = {}) {
  const m = MATERIALS[state.id];
  const comp = state.comp ?? m.comp;
  const h = `h${headingLevel}`;
  let variant = '';
  if (state.from && m.family === 'sediment') variant = `Weathered from ${MATERIALS[state.from].name.toLowerCase()}.`;
  if (state.id === 'pumice' && comp === 'intermediate') variant = 'This pumice formed from andesitic magma.';
  if ((state.id === 'greenschist' || state.id === 'amphibolite') && comp === 'intermediate') variant = 'This one formed from andesite-type rock.';
  const madeOf = m.family === 'magma' || m.family === 'intrusive' || m.family === 'extrusive' ? `${m.madeOf}. ${COMP_NAMES[comp]}.` : m.madeOf + '.';
  return `<div class="rk-card-art">${swatchSvg(state.id, { comp })}</div>`
    + `<div class="rk-card-body"><p class="rk-badge rk-badge-${m.family}">${esc(FAMILY_NAMES[m.family])}</p>`
    + `<${h} class="rk-card-name">${esc(m.name)}</${h}>`
    + (variant ? `<p class="rk-card-variant">${esc(variant)}</p>` : '')
    + `<p class="rk-card-look">${esc(m.look)}.</p>`
    + `<dl class="rk-dl"><div><dt>How it forms</dt><dd>${esc(m.forms)}</dd></div>`
    + `<div><dt>Everyday example</dt><dd>${esc(m.example)}</dd></div>`
    + `<div><dt>Made of</dt><dd>${esc(madeOf)}</dd></div>`
    + `<div><dt>If it melts</dt><dd>${esc(meltLine(state.id, comp))}</dd></div></dl></div>`;
}
/** The conditions panel for one step (or for where a starting material formed). */
export function conditionsHtml(c, { start = false } = {}) {
  const title = start ? `Where it formed: ${stepName(c.code).toLowerCase()}` : `Last step: ${stepName(c.code).toLowerCase()}`;
  const row = (term, text) => `<div><dt>${term}</dt><dd>${esc(text)}</dd></div>`;
  return `<p class="rk-cond-title">${esc(title.charAt(0).toUpperCase() + title.slice(1))}</p><dl class="rk-dl rk-cond">`
    + row('Where', c.where) + row('Depth', c.depthText) + row('Temperature', c.tempText) + row('Pressure', c.pressureText)
    + row('Time', c.time) + row('Energy', c.energy) + '</dl>';
}
/** The journey log as list items: the start, then one item per step. */
export function journeyItems(states, codes) {
  const items = [];
  const s0 = states[0];
  items.push({ n: 0, step: 'Start', result: MATERIALS[s0.id].name, family: MATERIALS[s0.id].family, where: PLACES[s0.place].name, temp: startConditions(s0).tempText });
  for (let i = 1; i < states.length; i++) {
    const c = conditions(codes[i - 1], states[i], states[i - 1]);
    items.push({ n: i, step: stepName(codes[i - 1]), result: MATERIALS[states[i].id].name, family: MATERIALS[states[i].id].family, where: c.where, temp: c.tempText, depth: c.depthText });
  }
  return items;
}
export function journeyHtml(states, codes) {
  return journeyItems(states, codes).map(it => `<li class="rk-j-item${it.n === states.length - 1 ? ' now' : ''}"><span class="rk-j-n">${it.n === 0 ? 'Start' : it.n}<span class="visually-hidden">:</span></span><span class="rk-j-main">${it.n === 0 ? '' : `<span class="rk-j-step">${esc(it.step)}</span> <span aria-hidden="true">→</span><span class="visually-hidden">, making</span> `}<strong>${esc(it.result)}</strong> <span class="rk-j-fam rk-badge-${it.family}">${esc(FAMILY_NAMES[it.family])}</span><span class="rk-j-where">${esc(it.where)} · ${esc(it.temp)}</span></span></li>`).join('');
}
/** A compact field-guide card for the page below the tool. */
export function guideCardHtml(id, { headingLevel = 4 } = {}) {
  const m = MATERIALS[id];
  const h = `h${headingLevel}`;
  return `<article class="rk-guide-card">${swatchSvg(id)}<${h}>${esc(m.name)}</${h}>`
    + `<p class="rk-guide-look">${esc(m.look)}.</p><p>${esc(m.forms)}</p><p class="rk-guide-example">${esc(m.example)}</p></article>`;
}
export { GRADES };
