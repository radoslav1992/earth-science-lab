// Contour lines by marching squares, for any heightmap grid { nx, ny, cell, h, x0 = 0, y0 = 0 }.
// Each crossing point is linearly interpolated along a cell edge. Every segment is oriented so the higher
// ground lies on its right (x east, y south), which lets segments join end to start into polylines and
// tells a hilltop loop from a hollow: walking a loop clockwise on the map keeps the higher ground inside.
// Ambiguous saddle cells are split with the bilinear saddle value (the asymptotic decider), so lines
// match the bilinear surface that sample() reads and never cross each other.
import { range } from './terrain.mjs';

// Local cell edges: top, right, bottom, left. Corners: top-left 8, top-right 4, bottom-right 2, bottom-left 1.
const T = 0, R = 1, B = 2, L = 3;
const CASES = [
  [], [[L, B]], [[B, R]], [[L, R]], [[R, T]], null, [[B, T]], [[L, T]],
  [[T, L]], [[T, B]], null, [[T, R]], [[R, L]], [[R, B]], [[B, L]], [],
];
// Saddles, keyed by case then by whether the cell's center is high: [high center, low center].
const SADDLES = {
  5: [[[L, T], [R, B]], [[R, T], [L, B]]],
  10: [[[T, R], [B, L]], [[T, L], [B, R]]],
};

/** Every contour polyline at one level: { level, points: [x0, y0, x1, y1, …] in meters, closed, area }. */
export function isolines(grid, level, scratch = makeScratch(grid)) {
  const { nx, ny, h } = grid, hc = (nx - 1) * ny;
  const { next, mark, touched } = scratch;
  touched.length = 0;
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      const a = h[k], b = h[k + 1], c = h[k + nx + 1], d = h[k + nx];
      const index = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
      if (index === 0 || index === 15) continue;
      const edges = [j * (nx - 1) + i, hc + j * nx + i + 1, (j + 1) * (nx - 1) + i, hc + j * nx + i];
      let segs = CASES[index];
      if (!segs) segs = SADDLES[index][(a * c - b * d) / (a + c - b - d) >= level ? 0 : 1];
      for (const [from, to] of segs) {
        next[edges[from]] = edges[to];
        mark[edges[to]] |= 1; // has an incoming segment
        touched.push(edges[from], edges[to]);
      }
    }
  }
  const lines = [];
  const point = (e, out) => {
    let i, j, t;
    if (e < hc) {
      j = Math.floor(e / (nx - 1)); i = e - j * (nx - 1);
      const p = h[j * nx + i], q = h[j * nx + i + 1];
      t = (level - p) / (q - p);
      out.push((grid.x0 ?? 0) + (i + t) * grid.cell, (grid.y0 ?? 0) + j * grid.cell);
    } else {
      const f = e - hc;
      j = Math.floor(f / nx); i = f - j * nx;
      const p = h[j * nx + i], q = h[(j + 1) * nx + i];
      t = (level - p) / (q - p);
      out.push((grid.x0 ?? 0) + i * grid.cell, (grid.y0 ?? 0) + (j + t) * grid.cell);
    }
  };
  const trace = (start, closed) => {
    const points = [];
    let e = start;
    do {
      mark[e] |= 2; // visited
      point(e, points);
      e = next[e];
    } while (e !== -1 && e !== start);
    lines.push({ level, points, closed, area: closed ? shoelace(points) : 0 });
  };
  // Open lines start on the map edge (an edge with an outgoing segment but none coming in), then loops.
  for (const e of touched) if (next[e] !== -1 && !(mark[e] & 3)) trace(e, false);
  for (const e of touched) if (next[e] !== -1 && !(mark[e] & 2)) trace(e, true);
  for (const e of touched) { next[e] = -1; mark[e] = 0; }
  return lines;
}

function makeScratch(grid) {
  const edges = (grid.nx - 1) * grid.ny + grid.nx * (grid.ny - 1);
  return { next: new Int32Array(edges).fill(-1), mark: new Uint8Array(edges), touched: [] };
}

/** Signed area: positive when the loop runs clockwise on the map (higher ground inside: a hill). */
export function shoelace(points) {
  let sum = 0;
  for (let k = 0, n = points.length; k < n; k += 2) {
    const m = (k + 2) % n;
    sum += points[k] * points[m + 1] - points[m] * points[k + 1];
  }
  return sum / 2;
}

/** Every fifth contour line, counting from 0 m, is an index contour: thicker and labeled. */
export const isIndex = (level, interval) => Math.round(level / interval) % 5 === 0;

/** Contour levels strictly above sea level, within the landscape's height range. */
export function levelsFor({ min, max }, interval, seaLevel = -Infinity) {
  const levels = [];
  const first = Math.max(Math.floor(seaLevel / interval) + 1, Math.ceil(min / interval));
  for (let k = first; k * interval <= max; k++) levels.push(k * interval);
  return levels;
}

/**
 * The whole map: contour lines (index and depression flags set) above sea level, and the coastline.
 * A depression is a closed loop with lower ground inside; maps mark it with hachures.
 */
export function contourMap(t, { interval, seaLevel = 0 }) {
  const span = range(t), scratch = makeScratch(t);
  const lines = [];
  for (const level of levelsFor(span, interval, seaLevel)) {
    for (const line of isolines(t, level, scratch)) {
      line.index = isIndex(level, interval);
      line.depression = line.closed && line.area < 0;
      lines.push(line);
    }
  }
  const coast = span.min < seaLevel && span.max >= seaLevel ? isolines(t, seaLevel, scratch) : [];
  return { lines, coast, span, interval, seaLevel };
}

/**
 * Closed rings around the part of the map below (or at and above) a level. The grid is padded with a
 * border on the other side of the level, so every ring closes along the map edge; fill with even-odd.
 */
export function regionRings(t, level, below = true) {
  const nx = t.nx + 2, ny = t.ny + 2, h = new Float64Array(nx * ny).fill(below ? level + 1e6 : level - 1e6);
  for (let j = 0; j < t.ny; j++) h.set(t.h.subarray(j * t.nx, (j + 1) * t.nx), (j + 1) * nx + 1);
  return isolines({ nx, ny, cell: t.cell, h, x0: -t.cell, y0: -t.cell }, level);
}

/** Cumulative arc length along a flat point list (closing back to the start for loops). */
function lengths(points, closed) {
  const out = [0];
  const n = points.length / 2;
  for (let k = 1; k < n + (closed ? 1 : 0); k++) {
    const a = (k - 1) % n, b = k % n;
    out.push(out[k - 1] + Math.hypot(points[2 * b] - points[2 * a], points[2 * b + 1] - points[2 * a + 1]));
  }
  return out;
}

/** Position and direction (unit vector) at arc length s along a polyline. */
function along(points, closed, cum, s) {
  const n = points.length / 2;
  let k = 1;
  while (k < cum.length - 1 && cum[k] < s) k++;
  const a = (k - 1) % n, b = k % n, seg = cum[k] - cum[k - 1] || 1, f = (s - cum[k - 1]) / seg;
  const dx = points[2 * b] - points[2 * a], dy = points[2 * b + 1] - points[2 * a + 1], len = Math.hypot(dx, dy) || 1;
  return { x: points[2 * a] + dx * f, y: points[2 * a + 1] + dy * f, ux: dx / len, uy: dy / len };
}

export const lineLength = line => { const cum = lengths(line.points, line.closed); return cum[cum.length - 1]; };

/**
 * Hachure ticks for a depression loop: short marks every `spacing` meters, pointing downhill (into the
 * hollow), which is always to the left of the line's direction. Returns [[x1, y1, x2, y2], …].
 */
export function hachures(line, spacing = 160, size = 70) {
  const cum = lengths(line.points, line.closed), total = cum[cum.length - 1];
  const count = Math.max(4, Math.round(total / spacing)), ticks = [];
  for (let k = 0; k < count; k++) {
    const p = along(line.points, line.closed, cum, ((k + 0.5) * total) / count);
    const tick = Math.min(size, total / 8);
    ticks.push([p.x, p.y, p.x + p.uy * tick, p.y - p.ux * tick]);
  }
  return ticks;
}

/**
 * Where to print an index contour's height: one label per `spacing` meters of line, kept `margin` meters
 * inside the map, rotated along the line and kept upright. Returns [{ x, y, angle }].
 */
export function labelSpots(line, { spacing = 2600, margin = 180, width = 6000, height = 4000, minLength = 700 } = {}) {
  const cum = lengths(line.points, line.closed), total = cum[cum.length - 1];
  if (total < minLength) return [];
  const count = Math.max(1, Math.floor(total / spacing)), spots = [];
  for (let k = 0; k < count; k++) {
    for (const shift of [0, 0.2, -0.2, 0.35, -0.35]) {
      const s = (((k + 0.5 + shift) / count) * total + total) % total;
      const p = along(line.points, line.closed, cum, s);
      if (p.x < margin || p.y < margin || p.x > width - margin || p.y > height - margin) continue;
      let angle = (Math.atan2(p.uy, p.ux) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      spots.push({ x: p.x, y: p.y, angle });
      break;
    }
  }
  return spots;
}

/** Does the closed loop contain the point? (Even-odd ray test.) */
export function contains(line, x, y) {
  const p = line.points, n = p.length;
  let inside = false;
  for (let k = 0, m = n - 2; k < n; m = k, k += 2) {
    if ((p[k + 1] > y) !== (p[m + 1] > y) && x < ((p[m] - p[k]) * (y - p[k + 1])) / (p[m + 1] - p[k + 1]) + p[k]) inside = !inside;
  }
  return inside;
}

/** SVG path data for polylines, scaled from meters to map units (default 1 unit = 10 m). */
export function pathData(lines, scale = 0.1) {
  let d = '';
  for (const line of lines) {
    const p = line.points ?? line;
    for (let k = 0; k < p.length; k += 2) d += `${k ? 'L' : 'M'}${Math.round(p[k] * scale * 10) / 10} ${Math.round(p[k + 1] * scale * 10) / 10}`;
    if (line.closed) d += 'Z';
  }
  return d;
}
