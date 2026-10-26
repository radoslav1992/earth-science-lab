// Seismology model behind the Earthquake Epicenter Finder.
// A classroom model, not a research one: a uniform crust with constant P and S speeds,
// straight-line paths along the surface and the focus treated as if it were at the surface.
// Real travel times curve with depth and distance, so seismologists use travel-time tables;
// at regional distances (a few hundred kilometers) this straight-line model is close enough to learn from.

export const VP = 6.0; // km/s, P (primary) waves in the upper crust
export const VS = 3.5; // km/s, S (secondary) waves in the upper crust
export const LAG_PER_KM = 1 / VS - 1 / VP; // ≈ 0.119 s of S–P lag per km traveled
export const KM_PER_SECOND_LAG = 1 / LAG_PER_KM; // exactly 8.4 km for every second of S–P lag
export const RECORD_SECONDS = 200; // length of each seismogram

// A fictional coastal region, 600 km east–west by 400 km north–south.
// Map coordinates are kilometers from the north-west corner: x grows east, y grows south.
export const REGION = { width: 600, height: 400 };
export const STATIONS = [
  { id: 'ashford', name: 'Ashford', code: 'ASH', x: 110, y: 95, color: '#a34722' },
  { id: 'bayview', name: 'Bayview', code: 'BAY', x: 505, y: 140, color: '#1f5f66' },
  { id: 'cedar-ridge', name: 'Cedar Ridge', code: 'CDR', x: 250, y: 335, color: '#6b5a1e' },
];
export const TOWNS = [
  { name: 'Millbrook', x: 330, y: 118 },
  { name: 'Pinecrest', x: 140, y: 245 },
  { name: 'Harlow', x: 410, y: 262 },
  { name: 'Saltmarsh', x: 460, y: 352 },
  { name: 'Fenwick', x: 248, y: 50 },
];
// Coast: land to the west, ocean to the east.
export const COAST = [[575, 0], [548, 58], [532, 118], [546, 176], [516, 236], [538, 296], [522, 356], [544, 400]];

export const GUIDED = { quake: { x: 260, y: 200 }, magnitude: 4.6, origin: 10 };
export const EXPLORE_DEFAULT = { quake: { x: 300, y: 200 }, magnitude: 4.5, origin: 10 };

export const round = (value, digits = 1) => { const f = 10 ** digits; return Math.round(value * f) / f; };
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** S–P lag (s) for a distance in km. */
export const lagFromDistance = km => km * LAG_PER_KM;
/** Distance (km) for an S–P lag in s: the classroom “8.4 km per second” rule. */
export const distanceFromLag = seconds => seconds * KM_PER_SECOND_LAG;

/** Arrival times (s on the seismogram clock) for a station `km` away from a quake at `origin` s. */
export function arrivals(km, origin = 0) {
  return { p: origin + km / VP, s: origin + km / VS, lag: km * LAG_PER_KM };
}

/**
 * Local (Richter) magnitude from the largest S-wave amplitude in mm on a standard seismograph
 * and the S–P lag in s. Classroom fit to the Richter nomogram (Lillie, Whole Earth Geophysics):
 * ML = log10(A) + 3·log10(8·Δt) − 2.92. An approximation for teaching, not an official magnitude.
 */
export function localMagnitude(amplitudeMm, lagSeconds) {
  return Math.log10(amplitudeMm) + 3 * Math.log10(8 * lagSeconds) - 2.92;
}
/** Inverse of localMagnitude: the amplitude (mm) a quake of `magnitude` produces at a given lag. */
export function amplitudeFor(magnitude, lagSeconds) {
  return 10 ** (magnitude - 3 * Math.log10(8 * lagSeconds) + 2.92);
}

/** What each station records for a quake. */
export function readings({ quake, magnitude, origin }) {
  return STATIONS.map(station => {
    const km = distance(quake, station);
    const { p, s, lag } = arrivals(km, origin);
    return { station, distance: km, p, s, lag, amplitude: amplitudeFor(magnitude, lag) };
  });
}

/**
 * A careful student's reading of one station: arrival times read to 0.1 s, the lag found by subtracting
 * those two readings, and the distance from the 8.4 rule. The finder's “snap” places markers here,
 * and the worksheet answer key prints these numbers.
 */
export function picked({ p, s }) {
  const P = round(p, 1), S = round(s, 1), lag = round(S - P, 1);
  return { p: P, s: S, lag, km: distanceFromLag(lag) };
}

/**
 * Least-squares point closest to lying on every circle ({x, y, r}), i.e. minimizing Σ(|P − C| − r)².
 * Needs at least three circles. Starts from the linearized solution and refines with Gauss–Newton.
 * Returns the point, the root-mean-square misfit (km) and each circle's residual.
 */
export function trilaterate(circles) {
  if (circles.length < 3) return null;
  const [c0, ...rest] = circles;
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  for (const c of rest) {
    const ax = 2 * (c.x - c0.x), ay = 2 * (c.y - c0.y);
    const b = c0.r ** 2 - c.r ** 2 + c.x ** 2 - c0.x ** 2 + c.y ** 2 - c0.y ** 2;
    a11 += ax * ax; a12 += ax * ay; a22 += ay * ay; b1 += ax * b; b2 += ay * b;
  }
  const det = a11 * a22 - a12 * a12;
  let x = circles.reduce((sum, c) => sum + c.x, 0) / circles.length;
  let y = circles.reduce((sum, c) => sum + c.y, 0) / circles.length;
  if (Math.abs(det) > 1e-9) { x = (a22 * b1 - a12 * b2) / det; y = (a11 * b2 - a12 * b1) / det; }
  for (let i = 0; i < 60; i++) {
    let j11 = 0, j12 = 0, j22 = 0, g1 = 0, g2 = 0;
    for (const c of circles) {
      const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy) || 1e-9, res = d - c.r, jx = dx / d, jy = dy / d;
      j11 += jx * jx; j12 += jx * jy; j22 += jy * jy; g1 += jx * res; g2 += jy * res;
    }
    const d = j11 * j22 - j12 * j12;
    if (Math.abs(d) < 1e-12) break;
    const sx = (j22 * g1 - j12 * g2) / d, sy = (j11 * g2 - j12 * g1) / d;
    x -= sx; y -= sy;
    if (Math.hypot(sx, sy) < 1e-7) break;
  }
  const residuals = circles.map(c => Math.hypot(x - c.x, y - c.y) - c.r);
  return { x, y, rms: Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length), residuals };
}

/** Where two circles cross (0, 1 or 2 points). */
export function circleIntersections(a, b) {
  const d = distance(a, b);
  if (d === 0 || d > a.r + b.r || d < Math.abs(a.r - b.r)) return [];
  const l = (a.r ** 2 - b.r ** 2 + d ** 2) / (2 * d), h = Math.sqrt(Math.max(0, a.r ** 2 - l ** 2));
  const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, mx = a.x + l * ux, my = a.y + l * uy;
  return [{ x: mx + h * uy, y: my - h * ux }, { x: mx - h * uy, y: my + h * ux }];
}

/** For circles that miss each other: the midpoint of their closest approach. */
function nearMiss(a, b) {
  const d = distance(a, b) || 1e-9, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
  if (d > a.r + b.r) { const t = a.r + (d - a.r - b.r) / 2; return { x: a.x + ux * t, y: a.y + uy * t }; }
  // One circle inside the other: midpoint between the facing edges.
  const [big, small, sign] = a.r >= b.r ? [a, b, 1] : [b, a, -1];
  const vx = ux * sign, vy = uy * sign;
  const p1 = { x: big.x + vx * big.r, y: big.y + vy * big.r }, p2 = { x: small.x + vx * small.r, y: small.y + vy * small.r };
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

/**
 * The “error triangle” of three circles: for each pair, the crossing point nearest `near`
 * (or the near-miss point if they don't cross). `size` is the triangle's longest side in km.
 */
export function errorTriangle(circles, near) {
  const pairs = [[0, 1], [1, 2], [0, 2]];
  const points = pairs.map(([i, j]) => {
    const hits = circleIntersections(circles[i], circles[j]);
    if (!hits.length) return nearMiss(circles[i], circles[j]);
    return hits.reduce((best, p) => (distance(p, near) < distance(best, near) ? p : best));
  });
  const size = Math.max(distance(points[0], points[1]), distance(points[1], points[2]), distance(points[0], points[2]));
  return { points, size };
}

/** Small, fast, deterministic PRNG (mulberry32): the same seed always gives the same quake. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random but reproducible quake: same seed, same quake. Never on top of a station. */
export function scenario(seed) {
  const rand = mulberry32(seed);
  let quake = { x: 300, y: 200 };
  for (let tries = 0; tries < 100; tries++) {
    const q = { x: round(40 + rand() * 520, 0), y: round(30 + rand() * 340, 0) };
    if (STATIONS.every(st => distance(q, st) >= 35)) { quake = q; break; }
  }
  return { seed, quake, magnitude: round(3 + rand() * 2.5, 1), origin: round(8 + rand() * 12, 1) };
}

/** Seed for round `index` (0-based) of a challenge identified by `seed`. */
export const roundSeed = (seed, index) => (Math.imul(seed, 31) + index * 7919 + 1) >>> 0;

/** Challenge score for one round: 100 for a perfect guess, one point off per km of error. */
export const roundScore = errorKm => Math.max(0, Math.round(100 - errorKm));
