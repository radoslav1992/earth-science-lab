// Contour Map Playground model: a heightmap of 96 × 64 cells (97 × 65 corner nodes) covering 6 km × 4 km.
// Elevations are in meters. Positions are meters from the map's north-west corner, x east and y south,
// like the epicenter map. Shared by the browser, the build (server-rendered map, worksheet) and the tests.

export const NX = 97;
export const NY = 65;
export const CELL = 62.5;
export const WIDTH = (NX - 1) * CELL;
export const HEIGHT = (NY - 1) * CELL;
export const MIN_ELEVATION = -200;
export const MAX_ELEVATION = 1000;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const gauss = (x, y, cx, cy, sx, sy = sx) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2) / 2);
const sigmoid = v => 1 / (1 + Math.exp(-v));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A gentle, seeded bend of the map coordinates, so the landforms look natural rather than geometric.
 * Its slope stays well below 1, so it never adds or removes hills, hollows or saddles.
 */
function warp(seed, amount) {
  const r = mulberry32(seed);
  const [a, b, c, d] = [r(), r(), r(), r()].map(v => v * 2 * Math.PI);
  return (x, y) => [
    x + amount * (110 * Math.sin(y / 640 + a) + 55 * Math.sin((x + y) / 410 + b)),
    y + amount * (110 * Math.sin(x / 700 + c) + 55 * Math.sin((x - y) / 450 + d)),
  ];
}

// The ridge-and-valley preset's valley floor: it meanders west across the map and falls 0.045 m per meter.
const valleyY = x => 2050 + 380 * Math.sin(x / 950 + 0.6);
// The cliff preset's escarpment line.
const scarpX = y => 3300 + 260 * Math.sin(y / 800 + 0.4);

/**
 * Deterministic starting landscapes. height(x, y) is evaluated on the warped coordinates.
 * river: where a river rises (it then follows the steepest way down); used by the V-rule overlay.
 */
export const PRESETS = [
  {
    id: 'hill', name: 'Single hill', summary: 'one rounded hill rising from a plain', warp: 1,
    height: (x, y) => 140 + 345 * gauss(x, y, 3000, 2050, 1150, 900),
  },
  {
    id: 'steep', name: 'Steep and gentle', summary: 'a hill with a steep east side and a gentle west side', warp: 0.8,
    height: (x, y) => 120 + 380 * gauss(x, y, 3300, 2000, x < 3300 ? 1500 : 420, 1000),
  },
  {
    id: 'river', name: 'Ridge and valley', summary: 'a river valley between a steep northern ridge and gentle southern slopes', warp: 0.5,
    river: 'east',
    height: (x, y) => {
      const dy = y - valleyY(x), w = dy < 0 ? 300 : 900;
      return 150 + 0.045 * x + 170 * (1 - Math.exp(-(dy * dy) / (2 * w * w))) + 60 * Math.exp(-((dy + 1150) ** 2) / (2 * 450 * 450));
    },
  },
  {
    id: 'volcano', name: 'Volcano', summary: 'a steep cone with a crater (a hollow) at its summit', warp: 0.7,
    height: (x, y) => {
      const r = Math.hypot(x - 3000, y - 2000), rim = 380;
      return r < rim ? 712 - 108 * (1 - (r / rim) ** 2) : 100 + 612 * Math.exp(-(r - rim) / 850);
    },
  },
  {
    id: 'island', name: 'Island', summary: 'an island with two hills, surrounded by sea', warp: 1,
    height: (x, y) => -70 + 330 * gauss(x, y, 2600, 2100, 1000, 760) + 250 * gauss(x, y, 4350, 1650, 450),
  },
  {
    id: 'saddle', name: 'Saddle', summary: 'two peaks joined by a lower saddle', warp: 0.8,
    height: (x, y) => 120 + 380 * gauss(x, y, 2050, 2000, 750) + 320 * gauss(x, y, 4050, 2050, 700),
  },
  {
    id: 'cliff', name: 'Cliff', summary: 'a plateau ending in a steep east-facing cliff above a lowland', warp: 0.6,
    height: (x, y) => {
      const s = sigmoid((scarpX(y) - x) / 90);
      return 170 + 0.008 * (WIDTH - x) * (1 - s) + s * (300 - 0.035 * (scarpX(y) - x));
    },
  },
];
export const PRESET_IDS = PRESETS.map(p => p.id);
export const DEFAULT_PRESET = 'hill';
export const presetById = id => PRESETS.find(p => p.id === id) ?? PRESETS[0];

/** A heightmap from any function of (x, y) in meters; used for presets and tests. */
export function fromFunction(fn, preset = null) {
  const h = new Float64Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) h[j * NX + i] = fn(i * CELL, j * CELL);
  return { preset, nx: NX, ny: NY, cell: CELL, h };
}

export function createTerrain(id = DEFAULT_PRESET) {
  const p = presetById(id), bend = warp(PRESETS.indexOf(p) + 11, p.warp);
  return fromFunction((x, y) => {
    const [wx, wy] = bend(x, y);
    return Math.round(clamp(p.height(wx, wy), MIN_ELEVATION, MAX_ELEVATION) * 100) / 100;
  }, p.id);
}

export const cloneTerrain = t => ({ ...t, h: Float64Array.from(t.h) });

export function range(t) {
  let min = Infinity, max = -Infinity;
  for (const v of t.h) { if (v < min) min = v; if (v > max) max = v; }
  return { min, max };
}

/** Bilinear interpolation between the four nodes around (x, y); positions outside the map are clamped. */
export function sample(t, x, y) {
  const fx = clamp(x / t.cell, 0, t.nx - 1), fy = clamp(y / t.cell, 0, t.ny - 1);
  const i = Math.min(t.nx - 2, Math.floor(fx)), j = Math.min(t.ny - 2, Math.floor(fy));
  const u = fx - i, v = fy - j, k = j * t.nx + i, h = t.h;
  return (h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + t.nx] * (1 - u) + h[k + t.nx + 1] * u) * v;
}

/** Elevations along the straight line a → b: n evenly spaced points, d = meters from a. */
export function profile(t, a, b, n = 161) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return Array.from({ length: n }, (_, k) => {
    const f = k / (n - 1), x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    return { d: f * length, x, y, h: sample(t, x, y) };
  });
}

/** Highest and lowest points of a profile and its length. */
export function profileStats(points) {
  let high = points[0], low = points[0];
  for (const p of points) { if (p.h > high.h) high = p; if (p.h < low.h) low = p; }
  return { length: points[points.length - 1].d, high, low };
}

/** Slope at (x, y) from the elevation one cell either side: rise per meter, degrees, percent, downhill unit vector. */
export function slopeAt(t, x, y) {
  const x0 = clamp(x - t.cell, 0, WIDTH), x1 = clamp(x + t.cell, 0, WIDTH);
  const y0 = clamp(y - t.cell, 0, HEIGHT), y1 = clamp(y + t.cell, 0, HEIGHT);
  const gx = (sample(t, x1, y) - sample(t, x0, y)) / (x1 - x0);
  const gy = (sample(t, x, y1) - sample(t, x, y0)) / (y1 - y0);
  const gradient = Math.hypot(gx, gy);
  return {
    gradient,
    degrees: (Math.atan(gradient) * 180) / Math.PI,
    percent: gradient * 100,
    downhill: gradient > 1e-9 ? { x: -gx / gradient, y: -gy / gradient } : { x: 0, y: 0 },
  };
}

export const BRUSHES = ['raise', 'lower', 'smooth', 'flatten'];
export const BRUSH_LIFT = 8; // meters a full-strength raise or lower dab moves the center

/**
 * One dab of a brush centered on (x, y). radius in meters, strength 0–1, target (flatten) in meters.
 * Raise/lower add a smooth bump; smooth relaxes toward the neighbors' mean; flatten moves toward target.
 * Every mode keeps elevations within MIN_ELEVATION…MAX_ELEVATION. Returns the changed node box, or null.
 */
export function applyBrush(t, { mode, x, y, radius, strength, target = 0 }) {
  const r = radius / t.cell, ci = x / t.cell, cj = y / t.cell, s = clamp(strength, 0, 1);
  const i0 = Math.max(0, Math.floor(ci - r)), i1 = Math.min(t.nx - 1, Math.ceil(ci + r));
  const j0 = Math.max(0, Math.floor(cj - r)), j1 = Math.min(t.ny - 1, Math.ceil(cj + r));
  if (i0 > i1 || j0 > j1 || !(r > 0) || !s) return null;
  const h = t.h, before = mode === 'smooth' ? Float64Array.from(h) : h;
  let changed = false;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const dist = Math.hypot(i - ci, j - cj);
      if (dist >= r) continue;
      const w = 0.5 * (1 + Math.cos((Math.PI * dist) / r)) * s, k = j * t.nx + i;
      let v = h[k];
      if (mode === 'raise') v += BRUSH_LIFT * w;
      else if (mode === 'lower') v -= BRUSH_LIFT * w;
      else if (mode === 'smooth') {
        let sum = 0, n = 0;
        for (let b = Math.max(0, j - 1); b <= Math.min(t.ny - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(t.nx - 1, i + 1); a++) { sum += before[b * t.nx + a]; n++; }
        v += (sum / n - v) * 0.6 * w;
      } else if (mode === 'flatten') v += (target - v) * 0.5 * w;
      v = clamp(v, MIN_ELEVATION, MAX_ELEVATION);
      if (v !== h[k]) { h[k] = v; changed = true; }
    }
  }
  return changed ? { i0, i1, j0, j1 } : null;
}

/**
 * Where the preset's river runs on the current landscape: from its source (the lowest point on the given
 * map edge) it steps to the lowest of the eight neighboring nodes, while that is lower, until it reaches
 * another edge or the sea. Returns smoothed points in meters, upstream first, or [] without a river.
 */
export function riverPath(t, edge, seaLevel = -Infinity) {
  if (!edge) return [];
  const H = t.h, at = (i, j) => H[j * t.nx + i];
  let i = edge === 'east' ? t.nx - 1 : 0, j = 0;
  for (let b = 1; b < t.ny; b++) if (at(i, b) < at(i, j)) j = b;
  const nodes = [[i, j]];
  for (let step = 0; step < t.nx * t.ny; step++) {
    let best = null, drop = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const ni = i + a, nj = j + b;
      if ((a || b) && ni >= 0 && nj >= 0 && ni < t.nx && nj < t.ny) {
        const slope = (at(i, j) - at(ni, nj)) / Math.hypot(a, b);
        if (slope > drop) { drop = slope; best = [ni, nj]; }
      }
    }
    if (!best) break;
    [i, j] = best;
    nodes.push(best);
    if (at(i, j) < seaLevel || i === 0 || j === 0 || i === t.nx - 1 || j === t.ny - 1) break;
  }
  let pts = nodes.map(([a, b]) => [a * t.cell, b * t.cell]);
  for (let pass = 0; pass < 3 && pts.length > 2; pass++) {
    const next = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [p, q] = [pts[k], pts[k + 1]];
      next.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

/** Highest nodes that are higher than all eight neighbors (summits), at least `gap` meters apart. */
export function summits(t, { above = -Infinity, limit = 6, gap = 900 } = {}) {
  const found = [];
  for (let j = 0; j < t.ny; j++) for (let i = 0; i < t.nx; i++) {
    const v = t.h[j * t.nx + i];
    if (v <= above) continue;
    let top = true;
    for (let b = -1; b <= 1 && top; b++) for (let a = -1; a <= 1; a++) {
      const ni = i + a, nj = j + b;
      if ((a || b) && ni >= 0 && nj >= 0 && ni < t.nx && nj < t.ny && t.h[nj * t.nx + ni] >= v) { top = false; break; }
    }
    if (top) found.push({ x: i * t.cell, y: j * t.cell, h: v });
  }
  found.sort((p, q) => q.h - p.h);
  const kept = [];
  for (const p of found) if (kept.length < limit && kept.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= gap)) kept.push(p);
  return kept;
}

/** Lowest interior nodes that are lower than all eight neighbors (the bottoms of hollows). */
export function pits(t, { above = -Infinity } = {}) {
  const found = [];
  for (let j = 1; j < t.ny - 1; j++) for (let i = 1; i < t.nx - 1; i++) {
    const v = t.h[j * t.nx + i];
    if (v <= above) continue;
    let low = true;
    for (let b = -1; b <= 1 && low; b++) for (let a = -1; a <= 1; a++) if ((a || b) && t.h[(j + b) * t.nx + i + a] <= v) { low = false; break; }
    if (low) found.push({ x: i * t.cell, y: j * t.cell, h: v });
  }
  return found.sort((p, q) => p.h - q.h);
}

/** Compact text form of a sculpted heightmap (whole decimeters, base64) for local storage. */
export function encodeHeights(t) {
  const dm = new Int16Array(t.h.length);
  for (let k = 0; k < dm.length; k++) dm[k] = Math.round(t.h[k] * 10);
  const bytes = new Uint8Array(dm.buffer);
  let text = '';
  for (let k = 0; k < bytes.length; k += 0x8000) text += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(text);
}

/** The heightmap back from encodeHeights, or null if the text is not a valid map. */
export function decodeHeights(text, preset = null) {
  try {
    const raw = atob(text);
    if (raw.length !== NX * NY * 2) return null;
    const bytes = new Uint8Array(raw.length);
    for (let k = 0; k < raw.length; k++) bytes[k] = raw.charCodeAt(k);
    const dm = new Int16Array(bytes.buffer), h = new Float64Array(NX * NY);
    for (let k = 0; k < h.length; k++) h[k] = clamp(dm[k] / 10, MIN_ELEVATION, MAX_ELEVATION);
    return { preset, nx: NX, ny: NY, cell: CELL, h };
  } catch {
    return null;
  }
}
