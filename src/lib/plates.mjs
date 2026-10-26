// The Plate Tectonics Explorer model: the seven plate-boundary cases and their evidence, plate-motion
// arithmetic, the deterministic cross-section and map geometry (drawn by the server and animated in the
// browser from the same functions), share links and the challenge questions.
// Facts are conservative classroom values. Rates and depths are approximate ranges, not measurements.

export const TYPES = ['divergent', 'convergent', 'transform'];
export const PLATES = ['oo', 'oc', 'cc'];
export const TYPE_NAMES = { divergent: 'Divergent', convergent: 'Convergent', transform: 'Transform' };
export const PLATE_NAMES = { oo: 'Ocean–ocean', oc: 'Ocean–continent', cc: 'Continent–continent' };
// Which plate pairs each boundary type can have in this lab. Ridges and rifts split one kind of crust,
// so there is no ocean–continent divergent boundary; transforms are shown in ocean and continent crust.
export const VALID = { divergent: ['oo', 'cc'], convergent: ['oc', 'oo', 'cc'], transform: ['oo', 'cc'] };
export const DEFAULT_PLATES = { divergent: 'oo', convergent: 'oc', transform: 'cc' };
export const isValid = (type, plates) => Boolean(VALID[type]?.includes(plates));
export const caseKey = (type, plates) => `${type}-${plates}`;
export const PAIR_HINTS = {
  divergent: 'A divergent boundary splits one kind of plate, so ocean–continent isn’t an option.',
  convergent: 'All three plate pairs can meet at a convergent boundary.',
  transform: 'This lab shows transform faults in ocean crust and in continental crust.',
};

// The depth classes seismologists use for earthquakes.
export const DEPTH_CLASSES = [
  { id: 'shallow', name: 'Shallow', min: 0, max: 70 },
  { id: 'intermediate', name: 'Intermediate', min: 70, max: 300 },
  { id: 'deep', name: 'Deep', min: 300, max: 700 },
];
export const MAX_QUAKE_DEPTH_KM = 700;
export const depthClass = km => (km < 70 ? 'shallow' : km < 300 ? 'intermediate' : 'deep');
export const DEPTH_NAMES = { shallow: 'Shallow', intermediate: 'Intermediate', deep: 'Deep' };
const DEPTH_RANK = { shallow: 0, intermediate: 1, deep: 2 };
export const MOTION_NAMES = { apart: 'Apart', together: 'Together', past: 'Past each other' };

// rate: the explorer's starting speed for the case, in cm per year (relative speed of the two plates).
export const CASES = {
  'divergent-oo': {
    type: 'divergent', plates: 'oo', name: 'Mid-ocean ridge', motion: 'apart', landform: 'Mid-ocean ridge',
    summary: 'Two oceanic plates pull apart. Hot mantle rock rises into the gap, partly melts and cools into new seafloor.',
    landforms: ['A mid-ocean ridge: a long underwater mountain chain', 'A rift valley along the ridge crest', 'New seafloor that gets older the farther it is from the ridge'],
    quakes: 'Shallow (less than 70 km deep), in a narrow band along the ridge.',
    quakeDepth: 'shallow', volcanoes: true,
    volcanoText: 'Yes: runny basalt lava erupts along the ridge, mostly underwater.',
    examples: ['The Mid-Atlantic Ridge, which spreads about 2–5 cm per year', 'Iceland, where the ridge rises above sea level'],
    rate: 3,
  },
  'divergent-cc': {
    type: 'divergent', plates: 'cc', name: 'Continental rift', motion: 'apart', landform: 'Rift valley',
    summary: 'A continent is stretched and pulled apart. The crust thins, blocks drop down along faults, and if rifting goes on long enough a new ocean opens.',
    landforms: ['A rift valley with steep walls of faulted rock', 'Long, deep lakes on the valley floor', 'Volcanoes along and near the rift'],
    quakes: 'Shallow (less than 70 km deep), under the valley and its walls.',
    quakeDepth: 'shallow', volcanoes: true,
    volcanoText: 'Yes: magma rises where the crust has thinned. Mount Kilimanjaro formed near the East African Rift.',
    examples: ['The East African Rift, opening less than 1 cm per year', 'The Red Sea, a rift that has already flooded to make a young ocean'],
    rate: 0.5,
  },
  'convergent-oc': {
    type: 'convergent', plates: 'oc', name: 'Ocean–continent subduction', motion: 'together', landform: 'Trench, volcanic mountains',
    summary: 'Dense oceanic plate sinks (subducts) under lighter continental plate. Water from the sinking slab helps the mantle above it melt.',
    landforms: ['A deep ocean trench offshore', 'A chain of volcanoes (a volcanic arc) on the continent', 'Mountains that grow as the plates squeeze together'],
    quakes: 'Shallow near the trench, then deeper and deeper along the sinking slab, down to about 700 km.',
    quakeDepth: 'deep', volcanoes: true,
    volcanoText: 'Yes: explosive volcanoes in a line roughly 100–300 km inland from the trench.',
    examples: ['The Andes, where the Nazca Plate sinks under South America', 'The Cascades, where the Juan de Fuca Plate sinks under North America'],
    rate: 5,
  },
  'convergent-oo': {
    type: 'convergent', plates: 'oo', name: 'Ocean–ocean subduction', motion: 'together', landform: 'Trench, volcanic island arc',
    summary: 'Two oceanic plates meet and the older, denser one sinks under the other. Magma rising above the slab builds a curved chain of volcanic islands.',
    landforms: ['A deep ocean trench, the deepest places on Earth', 'A curved chain of volcanic islands (an island arc)'],
    quakes: 'Shallow near the trench, then deeper and deeper along the sinking slab, down to about 700 km.',
    quakeDepth: 'deep', volcanoes: true,
    volcanoText: 'Yes: volcanoes build islands in a curved line beside the trench.',
    examples: ['The Mariana Trench and the Mariana Islands', 'Japan, beside the Japan Trench'],
    rate: 5,
  },
  'convergent-cc': {
    type: 'convergent', plates: 'cc', name: 'Continental collision', motion: 'together', landform: 'High mountain range',
    summary: 'Two continents collide. Continental crust is too thick and light to sink far, so it crumples, folds and stacks up into high mountains.',
    landforms: ['A high, wide mountain range', 'Folded and faulted rock layers', 'A thick root of crust under the mountains'],
    quakes: 'Mostly shallow, spread across a wide zone; a few are a bit deeper than 70 km.',
    quakeDepth: 'intermediate', volcanoes: false,
    volcanoText: 'Few or none: no ocean plate is sinking here, so little magma forms.',
    examples: ['The Himalaya, where India pushes into Asia', 'Mount Everest, the highest mountain on Earth'],
    rate: 4,
  },
  'transform-oo': {
    type: 'transform', plates: 'oo', name: 'Oceanic transform fault', motion: 'past', landform: 'Offset ridge, fracture zone',
    summary: 'Two oceanic plates slide past each other along a fault that links two pieces of a mid-ocean ridge.',
    landforms: ['A fault that offsets the ridge into separate segments', 'Long scars on the seafloor (fracture zones)'],
    quakes: 'Shallow (less than 70 km deep), along the fault between the ridge segments.',
    quakeDepth: 'shallow', volcanoes: false,
    volcanoText: 'No: the plates only slide past each other, so no magma forms.',
    examples: ['The transform faults that cut the Mid-Atlantic Ridge into segments'],
    rate: 3,
  },
  'transform-cc': {
    type: 'transform', plates: 'cc', name: 'Continental transform fault', motion: 'past', landform: 'Long straight fault',
    summary: 'Two plates grind past each other sideways. Rock sticks, bends and then slips suddenly in earthquakes.',
    landforms: ['A long, straight fault line with a valley along it', 'Streams, roads and rock layers offset where they cross the fault'],
    quakes: 'Shallow (less than 70 km deep), and they can be large.',
    quakeDepth: 'shallow', volcanoes: false,
    volcanoText: 'No: the plates only slide past each other, so no magma forms.',
    examples: ['The San Andreas Fault in California, between the Pacific Plate and the North American Plate'],
    rate: 4,
  },
};
export const CASE_KEYS = Object.keys(CASES);
export const caseTitle = key => `${TYPE_NAMES[CASES[key].type]} boundary, ${PLATE_NAMES[CASES[key].plates].toLowerCase()}`;

// ---------- Plate-motion arithmetic ----------
// 1 cm per year for 1 million years is 1 000 000 cm = 10 km, so cm/yr × Myr × 10 = km.
export const KM_PER_MYR_PER_CM_PER_YR = 10;
export const kmPerMyr = cmPerYr => cmPerYr * KM_PER_MYR_PER_CM_PER_YR;
export const cmPerYrFromKmPerMyr = km => km / KM_PER_MYR_PER_CM_PER_YR;
export const mmPerYr = cmPerYr => cmPerYr * 10;
export const metersPerCentury = cmPerYr => cmPerYr; // 1 cm/yr × 100 years = 100 cm = 1 m
export const distanceKm = (cmPerYr, myr) => kmPerMyr(cmPerYr) * myr;
export const timeMyr = (km, cmPerYr) => km / kmPerMyr(cmPerYr);
// At a ridge each plate moves away at half the spreading rate, so seafloor age = distance ÷ half-rate.
export const halfRate = fullCmPerYr => fullCmPerYr / 2;
export const seafloorAgeMyr = (kmFromRidge, halfCmPerYr) => kmFromRidge / kmPerMyr(halfCmPerYr);
/** A number for display: at most `decimals` places, trailing zeros dropped (250, 2.5, 0.25). */
export const fmt = (value, decimals = 1) => String(Number(value.toFixed(decimals)));

// ---------- Explorer settings and share links ----------
export const TIME_RANGE = [0, 20]; // million years
export const SPEED_RANGE = [0.5, 10]; // cm per year
export const MODES = ['explore', 'challenge'];
export const DEFAULT_STATE = { type: 'convergent', plates: 'oc', t: 10, speed: CASES['convergent-oc'].rate, mode: 'explore' };
const snapSpeed = v => Math.round(v * 2) / 2;
const snapTime = v => Math.round(v * 10) / 10;
const num = value => (value === null || value.trim() === '' ? NaN : Number(value));
const quoted = value => `“${value.length > 24 ? value.slice(0, 24) + '…' : value}”`;

/** Reads ?type=convergent&plates=oc&t=10&speed=5&mode=challenge. Bad values fall back with a friendly note. */
export function parsePlatesState(search) {
  const params = new URLSearchParams(search);
  const notes = [];
  const state = { ...DEFAULT_STATE };
  if (params.has('type')) {
    const type = params.get('type');
    if (TYPES.includes(type)) state.type = type;
    else notes.push(`${quoted(type)} isn’t a boundary type here, so a convergent boundary is shown.`);
  }
  state.plates = DEFAULT_PLATES[state.type];
  if (params.has('plates')) {
    const plates = params.get('plates');
    const fallback = PLATE_NAMES[state.plates].toLowerCase();
    if (!PLATES.includes(plates)) notes.push(`${quoted(plates)} isn’t a pair of plates here, so ${fallback} plates are shown.`);
    else if (!isValid(state.type, plates)) notes.push(`A ${state.type} boundary between ${PLATE_NAMES[plates].toLowerCase()} plates isn’t part of this lab, so ${fallback} plates are shown.`);
    else state.plates = plates;
  }
  state.speed = CASES[caseKey(state.type, state.plates)].rate;
  if (params.has('t')) {
    const t = num(params.get('t'));
    if (Number.isFinite(t) && t >= TIME_RANGE[0] && t <= TIME_RANGE[1]) state.t = snapTime(t);
    else notes.push(`The time in the link must be between ${TIME_RANGE[0]} and ${TIME_RANGE[1]} million years, so ${DEFAULT_STATE.t} million years is shown.`);
  }
  if (params.has('speed')) {
    const speed = num(params.get('speed'));
    if (Number.isFinite(speed) && speed >= SPEED_RANGE[0] && speed <= SPEED_RANGE[1]) state.speed = snapSpeed(speed);
    else notes.push(`The speed in the link must be between ${SPEED_RANGE[0]} and ${SPEED_RANGE[1]} cm per year, so the usual speed for this boundary is used.`);
  }
  if (params.has('mode')) {
    const mode = params.get('mode');
    if (MODES.includes(mode)) state.mode = mode;
    else notes.push(`${quoted(mode)} isn’t a mode here, so the explorer opened in Explore mode.`);
  }
  return { state, notes };
}

export function serializePlatesState({ type, plates, t, speed, mode }) {
  const params = new URLSearchParams();
  const safeType = TYPES.includes(type) ? type : DEFAULT_STATE.type;
  params.set('type', safeType);
  params.set('plates', isValid(safeType, plates) ? plates : DEFAULT_PLATES[safeType]);
  params.set('t', fmt(snapTime(Math.min(TIME_RANGE[1], Math.max(TIME_RANGE[0], t)))));
  params.set('speed', fmt(snapSpeed(Math.min(SPEED_RANGE[1], Math.max(SPEED_RANGE[0], speed)))));
  if (mode === 'challenge') params.set('mode', 'challenge');
  return params.toString();
}

// ---------- Cross-section geometry ----------
// One drawing frame for every case so earthquake depths can be compared: 0.42 px per km across and down,
// depth 0 at the seafloor. Mountains, ridges, trenches and crust are drawn taller than to scale.
export const VIEW = { width: 800, height: 440 };
const X0 = 48; // the depth axis sits to the left of this
const XR = VIEW.width;
const Y0 = 130; // depth 0
const SEA = 108; // sea level
const LAND = 98; // continental surface
const KM = 0.42; // px per km
const OC_CRUST = 7; // px
const CC_CRUST_Y = Y0 + 35 * KM; // base of continental crust (35 km)
const OC_LITH_KM = 100, CC_LITH_KM = 150;
const CX = (X0 + XR) / 2;
export const depthToY = km => Y0 + km * KM;
const r1 = v => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const bump = u => (Math.abs(u) >= 1 ? 0 : (1 - u * u) ** 2);
const frac = v => v - Math.floor(v);
// Deterministic pseudo-random numbers in [0, 1) from integers (no Math.random, so server and browser agree).
function rand(i, k = 0) {
  let h = Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 40503);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// The sinking slab's top surface, starting where the plate bends down: dip steepens from 12° to 55° over 350 km.
const DIP0 = 12, DIP1 = 55, BEND_KM = 350, STEP_KM = 10;
const dipAt = s => ((DIP0 + (DIP1 - DIP0) * Math.min(1, s / BEND_KM)) * Math.PI) / 180;
function slabTop(lengthKm) {
  const pts = [[0, 0, 0]]; // [x km from trench, depth km, distance along slab]
  let x = 0, z = 0;
  for (let s = 0; s < lengthKm - 1e-9; s += STEP_KM) {
    const ds = Math.min(STEP_KM, lengthKm - s), a = dipAt(s + ds / 2);
    x += ds * Math.cos(a); z += ds * Math.sin(a);
    pts.push([x, z, s + ds]);
  }
  return pts;
}
// Slab length at which its tip reaches 670 km, and where it passes 100 km depth (magma forms above that).
const SLAB_FULL = slabTop(1400);
const along = depth => { const p = SLAB_FULL.find(q => q[1] >= depth); return p[2]; };
export const SLAB_MAX_KM = along(670);
export const SLAB_ARC_KM = along(100);
const SLAB_START_KM = 120; // the slab already reaches about 40 km down at time 0
export const slabLength = d => Math.min(SLAB_MAX_KM, SLAB_START_KM + d);
function pointAt(pts, s) {
  for (let i = 1; i < pts.length; i++) if (pts[i][2] >= s) {
    const [x0, z0, s0] = pts[i - 1], [x1, z1, s1] = pts[i], f = (s - s0) / (s1 - s0 || 1);
    return [x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, Math.atan2(z1 - z0, x1 - x0)];
  }
  const [x, z] = pts[pts.length - 1];
  return [x, z, dipAt(s)];
}

function quake(x, depth) { return { x: r1(x), y: r1(depthToY(depth)), depth: r1(depth), cls: depthClass(depth) }; }
const pts = list => list.map(([x, y]) => [r1(x), r1(y)]);
// Moving tick marks show a plate's motion: spacing in km, speed in km/Myr.
function ticks(x1, x2, yOf, offsetKm, dir) {
  const out = [], step = 80 * KM, shift = (frac(offsetKm / 80) * step) * dir;
  for (let x = x1 - step + shift; x <= x2 + step; x += step) if (x > x1 + 2 && x < x2 - 2) out.push({ x: r1(x), y: r1(yOf(x)) });
  return out;
}
function profile(fn, x1, x2, step = 4) {
  const out = [];
  for (let x = x1; x < x2; x += step) out.push([x, fn(x)]);
  out.push([x2, fn(x2)]);
  return out;
}

/**
 * Everything drawn in the cross-section for one case at time t (Myr) and speed (cm/yr), in SVG units.
 * Pure and deterministic: the same inputs always give the same numbers.
 */
export function scene(key, t = DEFAULT_STATE.t, speed = CASES[key]?.rate ?? 1) {
  const c = CASES[key];
  if (!c) throw new Error(`Unknown boundary case ${key}`);
  t = clamp(Number(t) || 0, TIME_RANGE[0], TIME_RANGE[1]);
  speed = clamp(Number(speed) || SPEED_RANGE[0], SPEED_RANGE[0], SPEED_RANGE[1]);
  const d = distanceKm(speed, t);
  const s = { key, t, speed, distance: d, polys: [], lines: [], ticks: [], volcanoes: [], magma: [], quakes: [], arrows: [], symbols: [], labels: [], deepest: 0 };
  const poly = (cls, list) => s.polys.push({ cls, points: pts(list) });
  const line = (cls, list) => s.lines.push({ cls, points: pts(list) });
  // kind: '' (always shown), 'minor' (smaller, hidden on phones) or 'wide' (hidden on phones, where it would collide).
  const label = (x, y, text, anchor = 'middle', kind = '') => s.labels.push({ x: r1(x), y: r1(y), text, anchor, kind: kind === true ? 'minor' : kind });
  const arrow = (x1, x2, y) => s.arrows.push({ x1: r1(x1), x2: r1(x2), y: r1(y) });
  const volcano = (x, y, h) => s.volcanoes.push({ x: r1(x), y: r1(y), h: r1(h) });
  const magmaPath = (x1, y1, x2, y2, n = 3) => {
    for (let i = 0; i < n; i++) {
      const p = frac(t * 0.9 + i / n);
      s.magma.push({ x: r1(x1 + (x2 - x1) * p + Math.sin((p + i) * 6) * 3), y: r1(y1 + (y2 - y1) * p), r: r1(3.6 - p * 1.2) });
    }
  };
  const mantleLabel = () => label(X0 + 14, 404, 'Mantle: solid rock that flows very slowly', 'start');

  if (c.type === 'divergent' && c.plates === 'oo') {
    const v = kmPerMyr(halfRate(speed)); // km per Myr each way
    const age = x => Math.abs(x - CX) / KM / v;
    const floor = x => Y0 - 14 + Math.min(14, 1.9 * Math.sqrt(age(x))) + 4 * bump((x - CX) / 9);
    const base = x => Y0 + OC_CRUST + KM * Math.min(OC_LITH_KM, 9.5 * Math.sqrt(age(x)));
    const top = profile(floor, X0, XR);
    poly('xs-water', [[X0, SEA], [XR, SEA], ...top.slice().reverse()]);
    poly('xs-litho', [...top.map(([x, y]) => [x, y + OC_CRUST]), ...profile(base, X0, XR).reverse()]);
    poly('xs-ocrust', [...top, ...top.slice().reverse().map(([x, y]) => [x, y + OC_CRUST])]);
    const made = Math.min(XR - CX, d / 2 * KM);
    if (made > 1) poly('xs-ocrust-new', [...profile(floor, CX - made, CX + made, 2), ...profile(floor, CX - made, CX + made, 2).reverse().map(([x, y]) => [x, y + OC_CRUST])]);
    s.ticks.push(...ticks(X0, CX - 6, floor, d / 2, -1), ...ticks(CX + 6, XR, floor, d / 2, 1));
    poly('xs-magma-chamber', [[CX - 16, Y0 + 2], [CX - 6, Y0 - 4], [CX + 6, Y0 - 4], [CX + 16, Y0 + 2], [CX + 6, Y0 + 7], [CX - 6, Y0 + 7]]);
    magmaPath(CX, depthToY(90), CX, Y0 + 3, 4);
    volcano(CX, floor(CX), 5);
    for (let i = 0; i < 8; i++) s.quakes.push(quake(CX + (rand(i, 1) - 0.5) * 40, 2 + rand(i, 2) * 12));
    arrow(CX - 40, CX - 150, 74); arrow(CX + 40, CX + 150, 74);
    label(CX, 52, 'Plates move apart', 'middle', 'wide');
    label(CX, 100, 'Mid-ocean ridge');
    label(X0 + 70, SEA + 15, 'Ocean', 'middle', true);
    label(CX + 175, Y0 + 50, 'New seafloor', 'middle', true);
    if (made > 40) line('xs-leader minor', [[CX + 175, Y0 + 39], [CX + Math.min(made * 0.6, 120), floor(CX + Math.min(made * 0.6, 120)) + 4]]);
    label(XR - 12, Y0 + 30, 'Oceanic plate', 'end');
    label(CX + 30, depthToY(78), 'Rising rock partly melts', 'start', true);
    mantleLabel();
  }

  if (c.type === 'divergent' && c.plates === 'cc') {
    const split = 120; // km of stretching before the continent breaks and a sea floods in
    const stretch = Math.min(d, split);
    const w = 26 + stretch * 0.5, drop = Math.min(30, 6 + stretch * 0.22);
    const ocean = Math.max(0, d - split) * KM / 2; // half-width of new seafloor
    const sea = Math.min(ocean, XR - CX - w - 40);
    // Distance from the rift's own centre line once the new seafloor is cut out.
    const u = x => Math.max(0, Math.abs(x - CX) - sea);
    const surface = x => {
      if (Math.abs(x - CX) < sea) return Y0 - 8 + 6 * (1 - bump((x - CX) / Math.max(sea, 1)));
      const a = u(x);
      if (a < w * 0.55) return LAND + drop;
      if (a < w * 0.6) return LAND + drop - (drop * 0.55) * (a - w * 0.55) / (w * 0.05);
      if (a < w * 0.95) return LAND + drop * 0.45;
      if (a < w) return LAND + drop * 0.45 - (drop * 0.45 + 6) * (a - w * 0.95) / (w * 0.05);
      return LAND - 6 * bump((a - w - 40) / 50);
    };
    const thin = Math.min(16, stretch * 0.13), lift = Math.min(48, stretch * 0.4 + Math.max(0, d - split) * 0.05);
    const crustBase = x => (Math.abs(x - CX) < sea ? surface(x) + OC_CRUST : CC_CRUST_Y - thin * bump(u(x) / (w * 1.8)));
    const lithBase = x => (Math.abs(x - CX) < sea ? Y0 + OC_CRUST + 10 * KM * Math.sqrt((Math.abs(x - CX) / KM) / kmPerMyr(halfRate(speed))) : depthToY(CC_LITH_KM) - lift * bump(u(x) / (w * 2.6)));
    const top = profile(surface, X0, XR, 2);
    poly('xs-litho', [...profile(crustBase, X0, XR, 2), ...profile(lithBase, X0, XR, 2).reverse()]);
    if (sea > 0) {
      const sx = profile(surface, CX - sea, CX + sea, 2);
      poly('xs-water', [[CX - sea - w * 0.6, SEA], [CX + sea + w * 0.6, SEA], ...profile(surface, CX + sea, CX + sea + w * 0.6, 2).reverse(), ...sx.slice().reverse(), ...profile(surface, CX - sea - w * 0.6, CX - sea, 2).reverse()]);
      poly('xs-ocrust-new', [...sx, ...sx.slice().reverse().map(([x, y]) => [x, y + OC_CRUST])]);
    }
    const crust = top.filter(([x]) => Math.abs(x - CX) >= sea);
    const left = crust.filter(([x]) => x < CX), right = crust.filter(([x]) => x > CX);
    for (const part of [left, right]) if (part.length > 1) poly('xs-ccrust', [...part, ...part.slice().reverse().map(([x]) => [x, crustBase(x)])]);
    if (sea === 0 && drop > 10) {
      const lake = LAND + drop - Math.min(7, drop - 8);
      poly('xs-water', [[CX - w * 0.55, lake], [CX + w * 0.55, lake], [CX + w * 0.55, LAND + drop], [CX - w * 0.55, LAND + drop]]);
      label(CX, LAND + drop + 15, 'Rift lake', 'middle', true);
    }
    for (const side of [-1, 1]) for (const f of [0.575, 0.975]) {
      const x = CX + side * (sea + w * f);
      line('xs-fault', [[x, surface(x) - 2], [x + side * 10, CC_CRUST_Y - 4]]);
    }
    s.ticks.push(...ticks(X0, CX - sea - w - 8, surface, d / 2, -1), ...ticks(CX + sea + w + 8, XR, surface, d / 2, 1));
    if (d >= 15) { const vx = CX + sea + w + 22; volcano(vx, surface(vx), 18 + Math.min(10, d * 0.05)); magmaPath(vx - 30, depthToY(110), vx, surface(vx) + 4); }
    if (d >= 50) { const vx = CX - sea - w - 26; volcano(vx, surface(vx), 13); magmaPath(vx + 24, depthToY(100), vx, surface(vx) + 4, 2); }
    if (sea > 0) magmaPath(CX, depthToY(80), CX, Y0 - 2, 3);
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      s.quakes.push(quake(CX + side * (sea + w * (0.45 + rand(i, 3) * 0.65)), 4 + rand(i, 4) * 26));
    }
    arrow(CX - w - sea - 30, CX - w - sea - 140, 50); arrow(CX + w + sea + 30, CX + w + sea + 140, 50);
    label(CX, 30, 'Plates move apart', 'middle', 'wide');
    label(CX, sea > 0 ? SEA - 10 : LAND - 14, sea > 0 ? 'A new ocean opens' : 'Rift valley');
    label(X0 + 70, CC_CRUST_Y - 12, 'Continental crust', 'middle', true);
    label(XR - 12, depthToY(118), 'Continental plate', 'end');
    label(CX, depthToY(170) + 14, 'Hot mantle rises as the plate thins', 'middle', true);
    mantleLabel();
  }

  if (c.type === 'convergent' && c.plates !== 'cc') {
    const oceanOver = c.plates === 'oo';
    const xt = 300; // where the incoming plate starts to bend down
    const L = slabLength(d);
    const slab = slabTop(L);
    const dips = slab.map(p => dipAt(p[2]));
    const topPx = slab.map(([x, z]) => [xt + x * KM, Y0 + z * KM]);
    // Points pushed into the slab along its normal (down and back), `px` pixels below the top surface.
    const inside = px => topPx.map(([x, y], i) => [x - Math.sin(dips[i]) * px, y + Math.cos(dips[i]) * px]);
    const slabY = x => {
      for (let i = 1; i < topPx.length; i++) if (topPx[i][0] >= x) {
        const [x0, y0] = topPx[i - 1], [x1, y1] = topPx[i];
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0 || 1);
      }
      return topPx[topPx.length - 1][1];
    };
    const [tipX, tipZ] = slab[slab.length - 1];
    s.deepest = tipZ;
    // Incoming ocean plate: flat, then bending down into the mantle as the slab.
    poly('xs-litho', [[X0, Y0 + OC_CRUST], ...inside(OC_CRUST), ...inside(OC_LITH_KM * KM).reverse(), [X0, depthToY(OC_LITH_KM)]]);
    poly('xs-ocrust', [[X0, Y0], ...topPx, ...inside(OC_CRUST).reverse(), [X0, Y0 + OC_CRUST]]);
    // Overriding plate: rests on the slab from the trench (toe) down to 50–60 km, then thickens.
    const toe = pointAt(slab, 70), toeX = xt + toe[0] * KM, toeY = Y0 + toe[1] * KM;
    const grip = pointAt(slab, Math.min(L, along(oceanOver ? 50 : 60)));
    const gripX = xt + grip[0] * KM, gripY = Y0 + grip[1] * KM;
    const arcAt = pointAt(SLAB_FULL, SLAB_ARC_KM), arcX = xt + arcAt[0] * KM;
    const baseFar = depthToY(oceanOver ? OC_LITH_KM : CC_LITH_KM);
    const lower = x => (x <= gripX ? slabY(x) : x >= arcX + 70 ? baseFar : gripY + (baseFar - gripY) * (x - gripX) / (arcX + 70 - gripX));
    const arcLive = L >= SLAB_ARC_KM;
    const grown = 1 - Math.exp(-d / 400);
    const coastX = toeX + 28;
    const H = 10 + 48 * grown; // mountain height (px)
    const islandH = oceanOver && arcLive ? Math.min(26, 8 + (L - SLAB_ARC_KM) * 0.04) : 0;
    const over = x => {
      if (oceanOver) {
        const rise = toeY + (Y0 - toeY) * clamp((x - toeX) / 34, 0, 1);
        return rise - (islandH ? (Y0 - SEA + islandH) * bump((x - arcX) / 30) : 0) - 6 * bump((x - arcX) / 70);
      }
      const shelf = toeY + (LAND - toeY) * clamp((x - toeX) / (coastX - toeX), 0, 1) ** 0.7;
      const ramp = clamp((x - coastX + 6) / 40, 0, 1);
      return shelf - H * ramp * bump((x - arcX - 34) / 90) * (1 + 0.1 * Math.sin(x * 0.19) + 0.06 * Math.sin(x * 0.47));
    };
    const crustAt = x => Math.min(lower(x), oceanOver
      ? Math.max(over(x) + OC_CRUST, Y0 + OC_CRUST + (islandH ? 12 * bump((x - arcX) / 40) : 0))
      : Math.max(over(x) + 4, CC_CRUST_Y + 0.35 * H * bump((x - arcX - 34) / 90)));
    const surf = profile(over, toeX, XR, 3);
    const crustLine = profile(crustAt, toeX, XR, 3);
    poly('xs-litho', [...crustLine, ...profile(lower, toeX, XR, 3).reverse()]);
    poly(oceanOver ? 'xs-ocrust' : 'xs-ccrust', [...surf, ...crustLine.slice().reverse()]);
    // Water over the incoming plate, the trench and any sea floor of the overriding plate.
    const floor = [[X0, Y0], ...topPx.filter(([x]) => x < toeX), [toeX, toeY], ...surf].map(([x, y]) => [x, Math.max(y, SEA)]);
    s.polys.unshift({ cls: 'xs-water', points: pts([[X0, SEA], [XR, SEA], ...floor.reverse()]) });
    s.ticks.push(...ticks(X0, xt - 4, () => Y0, d, 1));
    if (arcLive) {
      const vy = over(arcX);
      volcano(arcX, vy, oceanOver ? 12 : 18);
      if (!oceanOver) volcano(arcX + 46, over(arcX + 46), 15);
      magmaPath(arcX + 4, Y0 + arcAt[1] * KM - 8, arcX, vy + 8, 4);
    }
    // Earthquakes inside the slab from the trench to its tip, and a few in the overriding plate.
    for (let i = 0, along_ = 16; along_ < L - 6; i++, along_ += 34 + rand(i, 5) * 22) {
      const [x, z, a] = pointAt(slab, along_), inset = 8 + rand(i, 6) * 26;
      s.quakes.push(quake(xt + (x - Math.sin(a) * inset) * KM, z + Math.cos(a) * inset));
    }
    for (let i = 0; i < 3; i++) s.quakes.push(quake(toeX + 18 + rand(i, 7) * (arcX - toeX), 8 + rand(i, 8) * 22));
    arrow(X0 + 60, X0 + 170, 72); arrow(XR - 50, XR - 140, 72);
    label(X0 + 115, 50, 'Plates move together', 'middle', 'wide');
    label(toeX - 4, toeY + 34, 'Trench');
    line('xs-leader', [[toeX - 4, toeY + 22], [toeX - 2, toeY + 3]]);
    label(X0 + 10, Y0 + 30, oceanOver ? 'Older ocean plate' : 'Ocean plate', 'start');
    label(XR - 12, baseFar - 12, oceanOver ? 'Younger ocean plate' : 'Continental plate', 'end');
    if (arcLive && oceanOver) label(arcX, SEA - islandH - 30, 'Volcanic island arc');
    if (arcLive && !oceanOver) label(arcX - 14, over(arcX) - 16, 'Volcanic arc', 'end');
    if (!arcLive) label(arcX + 10, (oceanOver ? SEA : over(arcX)) - 16, 'No volcanoes yet', 'middle', true);
    const mid = pointAt(slab, Math.min(L * 0.6, 520));
    if (L >= 250) label(xt + mid[0] * KM + 30, Y0 + mid[1] * KM + 4, 'Sinking slab', 'start');
    if (arcLive) label(arcX + 30, Y0 + arcAt[1] * KM + 26, 'Water from the slab helps rock melt', 'start', true);
    label(xt + tipX * KM - 8, Math.min(432, Y0 + tipZ * KM + 52), `Slab tip ≈ ${Math.round(tipZ / 10) * 10} km deep`, 'end', true);
    mantleLabel();
  }

  if (c.type === 'convergent' && c.plates === 'cc') {
    const xs = 380; // suture
    const grown = 1 - Math.exp(-d / 600);
    const H = 14 + 64 * grown, half = 90 + 120 * grown, mid = xs + 40;
    const surface = x => LAND - H * bump((x - mid) / half) * (1 + 0.12 * Math.sin(x * 0.21) + 0.07 * Math.sin(x * 0.53));
    const crustBase = x => CC_CRUST_Y + 0.32 * H * bump((x - mid) / (half * 0.9));
    // India's lithosphere slides under Asia at a low angle; how far grows with time.
    const under = Math.min(320, 90 + d * 0.22) * KM, dip = 0.36;
    const lb = depthToY(CC_LITH_KM);
    const slabTopY = x => crustBase(xs) + (x - xs) * dip;
    const top = profile(surface, X0, XR, 3);
    const thick = lb - crustBase(xs), end = xs + under;
    poly('xs-litho', [...profile(crustBase, X0, xs, 3), [xs, crustBase(xs)], [end, slabTopY(end)], [end, slabTopY(end) + thick], [xs, lb], [X0, lb]]);
    poly('xs-litho xs-litho-b', [...profile(crustBase, xs, XR, 3), [XR, lb], [end, Math.max(lb, slabTopY(end))], [xs, crustBase(xs)]]);
    poly('xs-ccrust', [...top, ...profile(crustBase, X0, XR, 3).reverse()]);
    line('xs-fault', [[xs - 30, surface(xs - 30) + 3], [xs, crustBase(xs)], [xs + under, slabTopY(xs + under)]]);
    for (let k = 0; k < 4; k++) line('xs-fold', profile(x => surface(x) + 10 + k * 9 + 5 * Math.sin((x - xs) * 0.09 + k), mid - half * 0.7, mid + half * 0.7, 6));
    s.ticks.push(...ticks(X0, xs - 70, surface, d, 1));
    for (let i = 0; i < 14; i++) s.quakes.push(quake(mid - half * 0.9 + rand(i, 9) * half * 2, 4 + rand(i, 10) ** 1.6 * 58));
    for (let i = 0; i < 2; i++) s.quakes.push(quake(xs + 30 + rand(i, 11) * 80, 74 + rand(i, 12) * 20));
    arrow(X0 + 40, X0 + 150, 48); arrow(XR - 40, XR - 130, 48);
    label(X0 + 95, 30, 'Plates move together', 'middle', 'wide');
    label(mid, Math.max(18, LAND - H - 12), 'Mountains crumple up', 'middle');
    label(mid, crustBase(mid) + 16, 'Thick crust root', 'middle', true);
    label(X0 + 70, LAND + 26, 'Continental crust', 'middle', true);
    label(xs + under * 0.5, slabTopY(xs + under * 0.5) + 30, 'Plate slides under, but too light to sink far', 'middle', true);
    label(X0 + 12, depthToY(118), 'Continental plate', 'start');
    label(XR - 12, depthToY(118), 'Continental plate', 'end');
    mantleLabel();
  }

  if (c.type === 'transform') {
    const ocean = c.plates === 'oo';
    const fx = CX;
    const surface = ocean ? (x => (x < fx ? Y0 - 5 : Y0 + 1)) : (x => LAND + 7 * bump((x - fx) / 12));
    const crustBase = ocean ? (x => surface(x) + OC_CRUST) : (() => CC_CRUST_Y);
    const base = ocean ? (x => depthToY(x < fx ? 75 : OC_LITH_KM)) : (() => depthToY(CC_LITH_KM));
    if (ocean) s.polys.push({ cls: 'xs-water', points: pts([[X0, SEA], [XR, SEA], [XR, Y0 + 1], [fx, Y0 + 1], [fx, Y0 - 5], [X0, Y0 - 5]]) });
    for (const [a, b] of [[X0, fx], [fx, XR]]) {
      const top = profile(surface, a, b - (b === fx ? 0.01 : 0), 2);
      poly('xs-litho', [...profile(crustBase, a, b - 0.01, 4), [b, base(a + 1)], [a, base(a + 1)]]);
      poly(ocean ? 'xs-ocrust' : 'xs-ccrust', [...top, ...profile(crustBase, a, b - 0.01, 4).reverse()]);
    }
    line('xs-fault xs-fault-main', [[fx, surface(fx) - 1], [fx, depthToY(ocean ? OC_LITH_KM : CC_LITH_KM)]]);
    for (const [x, dir] of [[fx - 150, 1], [fx + 150, -1]]) s.symbols.push({ x: r1(x), y: r1(depthToY(60)), dir });
    for (let i = 0; i < 9; i++) s.quakes.push(quake(fx + (rand(i, 13) - 0.5) * 14, 2 + rand(i, 14) * (ocean ? 14 : 18)));
    label(CX, 40, 'Plates slide past each other', 'middle', 'wide');
    const below = depthToY(ocean ? OC_LITH_KM : CC_LITH_KM) + 22;
    label(fx - 150, below, 'Moves toward you', 'middle');
    label(fx + 150, below, 'Moves away from you', 'middle');
    label(fx, ocean ? SEA - 10 : LAND - 12, ocean ? 'Transform fault on the seafloor' : 'Fault valley', 'middle');
    label(X0 + 12, depthToY(ocean ? 75 : 150) - 8, ocean ? 'Ocean plate' : 'Continental plate', 'start');
    label(XR - 12, depthToY(ocean ? 100 : 150) - 8, ocean ? 'Ocean plate' : 'Continental plate', 'end');
    label(fx + 14, depthToY(260), 'No magma: nothing rises or sinks', 'start', true);
    mantleLabel();
  }
  s.deepest = r1(Math.max(s.deepest, ...s.quakes.map(q => q.depth)));
  return s;
}

// ---------- SVG ----------
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pathD = (list, close) => 'M' + list.map(([x, y]) => `${x} ${y}`).join('L') + (close ? 'Z' : '');
const DEPTH_TICKS = [0, 100, 200, 300, 400, 500, 600, 700];

/** The inner SVG markup for a scene (classes are styled in plates.css). */
export function sceneSvg(sc) {
  const out = [];
  out.push(`<rect class="xs-sky" x="${X0}" y="0" width="${XR - X0}" height="${Y0 - 20}"/>`);
  out.push(`<rect class="xs-mantle" x="${X0}" y="${Y0 - 20}" width="${XR - X0}" height="${VIEW.height - Y0 + 20}"/>`);
  for (const p of sc.polys) out.push(`<path class="${p.cls}" d="${pathD(p.points, true)}"/>`);
  for (const l of sc.lines) out.push(`<path class="${l.cls}" d="${pathD(l.points)}"/>`);
  out.push('<g class="xs-ticks">' + sc.ticks.map(k => `<path d="M${k.x} ${r1(k.y + 1)}v5"/>`).join('') + '</g>');
  out.push('<g class="xs-volcanic">');
  for (const m of sc.magma) out.push(`<circle class="xs-magma" cx="${m.x}" cy="${m.y}" r="${m.r}"/>`);
  for (const v of sc.volcanoes) {
    const w = v.h * 1.25;
    out.push(`<path class="xs-volcano" d="M${r1(v.x - w)} ${r1(v.y + 2)}L${r1(v.x - 3)} ${r1(v.y - v.h)}L${r1(v.x + 3)} ${r1(v.y - v.h)}L${r1(v.x + w)} ${r1(v.y + 2)}Z"/><path class="xs-lava" d="M${r1(v.x - 3)} ${r1(v.y - v.h)}L${v.x} ${r1(v.y - v.h + 4)}L${r1(v.x + 3)} ${r1(v.y - v.h)}Z"/>`);
  }
  out.push('</g>');
  out.push('<g class="xs-quakes">' + sc.quakes.map(q => `<circle class="xs-q xs-q-${q.cls}" cx="${q.x}" cy="${q.y}" r="4.2"/>`).join('') + '</g>');
  for (const a of sc.arrows) {
    const dir = Math.sign(a.x2 - a.x1);
    out.push(`<path class="xs-arrow" d="M${a.x1} ${r1(a.y - 3)}H${r1(a.x2 - dir * 12)}V${r1(a.y - 9)}L${a.x2} ${a.y}L${r1(a.x2 - dir * 12)} ${r1(a.y + 9)}V${r1(a.y + 3)}H${a.x1}Z"/>`);
  }
  for (const m of sc.symbols) {
    out.push(`<g class="xs-symbol"><circle cx="${m.x}" cy="${m.y}" r="13"/>${m.dir > 0 ? `<circle class="xs-dot" cx="${m.x}" cy="${m.y}" r="4"/>` : `<path d="M${m.x - 8} ${m.y - 8}l16 16M${m.x + 8} ${m.y - 8}l-16 16"/>`}</g>`);
  }
  out.push('<g class="xs-labels">' + sc.labels.map(l => `<text class="xs-label${l.kind ? ' ' + l.kind : ''}" x="${l.x}" y="${l.y}" text-anchor="${l.anchor}">${esc(l.text)}</text>`).join('') + '</g>');
  // Depth axis.
  out.push(`<rect class="xs-axis-bg" x="0" y="0" width="${X0}" height="${VIEW.height}"/>`);
  for (const k of DEPTH_CLASSES) out.push(`<rect class="xs-band xs-band-${k.id}" x="${X0 - 7}" y="${r1(depthToY(k.min))}" width="7" height="${r1((k.max - k.min) * KM)}"/>`);
  for (const km of DEPTH_TICKS) out.push(`<path class="xs-tick" d="M${X0 - 12} ${r1(depthToY(km))}H${X0}"/><text class="xs-axis" x="${X0 - 14}" y="${r1(depthToY(km) + 4)}" text-anchor="end">${km}</text>`);
  out.push(`<text class="xs-axis xs-axis-title" x="4" y="${Y0 - 30}">Depth</text><text class="xs-axis xs-axis-title" x="4" y="${Y0 - 14}">(km)</text>`);
  return out.join('');
}

export function describeScene(sc) {
  const c = CASES[sc.key];
  const quakes = sc.quakes.length ? `Earthquakes reach about ${Math.round(sc.deepest / 10) * 10} km deep.` : '';
  return `Cross-section of a ${c.name.toLowerCase()} (${caseTitle(sc.key).toLowerCase()}) after ${fmt(sc.t)} million years at ${fmt(sc.speed)} cm per year: the plates have moved ${Math.round(sc.distance)} km. ${quakes} ${sc.volcanoes.length ? 'Volcanoes are erupting.' : 'There are no volcanoes.'}`.replace(/\s+/g, ' ').trim();
}

/** The evidence panel for a case, as HTML (the server and the browser render the same markup). */
export function evidenceHtml(key) {
  const c = CASES[key];
  const list = items => `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  return `<dl class="pt-dl">`
    + `<div><dt>Plates move</dt><dd>${esc(MOTION_NAMES[c.motion])}. ${esc(c.summary)}</dd></div>`
    + `<div><dt>Landforms</dt><dd>${list(c.landforms)}</dd></div>`
    + `<div><dt>Earthquakes</dt><dd><span class="pt-chip pt-chip-${c.quakeDepth}" aria-hidden="true"></span>${esc(c.quakes)}</dd></div>`
    + `<div><dt>Volcanoes</dt><dd>${esc(c.volcanoText)}</dd></div>`
    + `<div><dt>Real examples</dt><dd>${list(c.examples)}</dd></div>`
    + `</dl>`;
}

// ---------- Map view ----------
export const MAP_VIEW = { width: 280, height: 190 };
const MAP_KM = 0.1; // px per km on the map

export function describeMap(key, t = DEFAULT_STATE.t, speed = CASES[key]?.rate ?? 1) {
  const c = CASES[key];
  const how = { apart: 'moving apart', together: 'moving toward each other', past: 'sliding past each other in opposite directions' }[c.motion];
  return `Map from above of a ${c.name.toLowerCase()}. Arrows show the plates ${how}; in ${fmt(t)} million years at ${fmt(speed)} cm per year they move ${Math.round(distanceKm(speed, t))} km.`;
}

/** The inner SVG markup for the from-above map at time t. */
export function mapSvg(key, t = DEFAULT_STATE.t, speed = CASES[key]?.rate ?? 1) {
  const c = CASES[key];
  if (!c) throw new Error(`Unknown boundary case ${key}`);
  t = clamp(Number(t) || 0, TIME_RANGE[0], TIME_RANGE[1]);
  speed = clamp(Number(speed) || SPEED_RANGE[0], SPEED_RANGE[0], SPEED_RANGE[1]);
  const d = distanceKm(speed, t), W = MAP_VIEW.width, H = 160, mid = W / 2;
  const out = [];
  const fill = (x, w, ocean) => out.push(`<rect class="${ocean ? 'mp-ocean' : 'mp-land'}" x="${r1(x)}" y="0" width="${r1(w)}" height="${H}"/>`);
  const arrowV = (x, y, dx, dy) => {
    const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, hx = x + dx, hy = y + dy;
    out.push(`<path class="mp-arrow" d="M${r1(x)} ${r1(y)}L${r1(hx - ux * 8)} ${r1(hy - uy * 8)}"/><path class="mp-head" d="M${r1(hx)} ${r1(hy)}L${r1(hx - ux * 10 - uy * 6)} ${r1(hy - uy * 10 + ux * 6)}L${r1(hx - ux * 10 + uy * 6)} ${r1(hy - uy * 10 - ux * 6)}Z"/>`);
  };
  const stripes = (x1, x2, dir) => {
    const step = 18, shift = frac((d / 2) * MAP_KM / step) * step * dir;
    for (let x = (dir > 0 ? x1 : x2) + shift; dir > 0 ? x < x2 : x > x1; x += step * dir) if (x > x1 + 1 && x < x2 - 1) out.push(`<path class="mp-stripe" d="M${r1(x)} 0V${H}"/>`);
  };
  const label = (x, y, text, anchor = 'middle', names = true) => out.push(`<text class="mp-label${names ? ' mp-name' : ''}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${esc(text)}</text>`);
  const teeth = (x, side) => { for (let y = 8; y < H; y += 16) out.push(`<path class="mp-teeth" d="M${x} ${y}l${side * 7} 4l${-side * 7} 4Z"/>`); };
  const volcanoes = (x, island) => { for (let y = 18; y < H; y += 30) out.push(island ? `<ellipse class="mp-island" cx="${x + (y % 60 ? 3 : -3)}" cy="${y}" rx="6" ry="8"/>` : '', `<path class="mp-volcano" d="M${x - 5} ${y + 5}L${x} ${y - 5}L${x + 5} ${y + 5}Z"/>`); };

  if (key === 'divergent-oo') {
    fill(0, W, true); stripes(0, mid - 3, -1); stripes(mid + 3, W, 1);
    out.push(`<path class="mp-ridge" d="M${mid - 3} 0V${H}M${mid + 3} 0V${H}"/>`);
    arrowV(mid - 22, 40, -50, 0); arrowV(mid + 22, 40, 50, 0); label(mid, H - 8, 'Ridge');
  } else if (key === 'divergent-cc') {
    const w = Math.min(60, 8 + Math.min(d, 120) * 0.12 + Math.max(0, d - 120) * MAP_KM);
    fill(0, W, false);
    if (d > 120) fill(mid - (d - 120) * MAP_KM / 2, (d - 120) * MAP_KM, true);
    out.push(`<path class="mp-fault" d="M${r1(mid - w)} 0V${H}M${r1(mid + w)} 0V${H}"/>`);
    if (d <= 120) for (let y = 22; y < H; y += 46) out.push(`<ellipse class="mp-ocean" cx="${mid}" cy="${y}" rx="${r1(Math.max(2, w * 0.45))}" ry="14"/>`);
    arrowV(mid - w - 14, 40, -46, 0); arrowV(mid + w + 14, 40, 46, 0); label(mid, H - 8, d > 120 ? 'New sea' : 'Rift valley');
  } else if (c.type === 'convergent' && c.plates !== 'cc') {
    const xt = 96;
    fill(0, xt, true); fill(xt, W - xt, c.plates === 'oo');
    stripes(0, xt - 2, 1);
    out.push(`<path class="mp-trench" d="M${xt} 0V${H}"/>`); teeth(xt, 1);
    if (slabLength(d) >= SLAB_ARC_KM) volcanoes(xt + 54, c.plates === 'oo');
    if (c.plates === 'oc') out.push(`<path class="mp-coast" d="M${xt + 22} 0V${H}"/>`);
    arrowV(20, 40, 52, 0); arrowV(W - 20, 40, -44, 0); label(xt, H - 8, 'Trench', 'middle');
  } else if (key === 'convergent-cc') {
    fill(0, W, false); stripes(0, mid - 12, 1);
    out.push(`<path class="mp-trench" d="M${mid} 0V${H}"/>`); teeth(mid, 1);
    const spread = 10 + 50 * (1 - Math.exp(-d / 600));
    for (let y = 14; y < H; y += 22) for (let k = 0; k < 3; k++) {
      const x = mid + 8 + (k / 2) * spread + (y % 44 ? 4 : 0);
      out.push(`<path class="mp-mountain" d="M${r1(x - 6)} ${y + 5}L${r1(x)} ${y - 5}L${r1(x + 6)} ${y + 5}"/>`);
    }
    arrowV(20, 40, 50, 0); arrowV(W - 20, 40, -44, 0); label(mid, H - 8, 'Mountain belt');
  } else if (key === 'transform-oo') {
    fill(0, W, true);
    const a = 90, b = 190, y = 80;
    out.push(`<path class="mp-fz" d="M0 ${y}H${a}M${b} ${y}H${W}"/>`);
    out.push(`<path class="mp-ridge" d="M${a - 3} 0V${y}M${a + 3} 0V${y}M${b - 3} ${y}V${H}M${b + 3} ${y}V${H}"/>`);
    out.push(`<path class="mp-fault mp-transform" d="M${a} ${y}H${b}"/>`);
    arrowV(a + 14, y - 12, 56, 0); arrowV(b - 14, y + 12, -56, 0);
    arrowV(a - 10, 34, -44, 0); arrowV(b + 10, 126, 44, 0);
    label(mid, y + 40, 'Transform fault'); label(a + 8, 16, 'Ridge', 'start', false); label(b - 8, H - 8, 'Ridge', 'end', false);
  } else if (key === 'transform-cc') {
    fill(0, W, false);
    const off = Math.min(120, d * MAP_KM);
    // A rock layer that once ran straight across: now split by the fault.
    out.push(`<path class="mp-layer" d="M0 ${r1(80 + off / 2)}H${mid}M${mid} ${r1(80 - off / 2)}H${W}"/>`);
    out.push(`<path class="mp-fault mp-transform" d="M${mid} 0V${H}"/>`);
    arrowV(mid - 18, 40, 0, 50); arrowV(mid + 18, 120, 0, -50);
    label(mid + 8, H - 8, `Matching rocks now ${Math.round(d)} km apart`, 'middle');
  }
  out.push(`<rect class="mp-frame" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}"/>`);
  out.push(`<text class="mp-caption" x="4" y="${H + 20}">${esc(`${fmt(speed)} cm/yr × ${fmt(t)} million years = ${Math.round(d)} km`)}</text>`);
  return out.join('');
}

// ---------- Challenge ----------
// Each question shows a cross-section (labels hidden), a map, or a list of evidence. Evidence questions
// carry the facts they describe so tests can check that exactly one answer choice fits.
export const CHALLENGE = [
  {
    show: { kind: 'section', key: 'convergent-oc', t: 12, speed: 5 },
    describe: 'An ocean plate on the left meets a continent with mountains on the right, with a trench between them. A slab sinks under the continent, with earthquakes getting deeper along it to about 500 km, and volcanoes stand on the mountains.',
    prompt: 'Which boundary does this cross-section show?',
    choices: ['convergent-oc', 'convergent-oo', 'convergent-cc', 'divergent-cc'],
    answer: 'convergent-oc',
    explain: 'An ocean plate sinks under a continent: a trench offshore, earthquakes that get deeper along the slab, and volcanoes on top of the continent’s mountains, as in the Andes.',
  },
  {
    show: { kind: 'evidence', facts: { motion: 'past', quakeDepth: 'shallow', volcanoes: false, plates: 'cc' } },
    evidence: ['Earthquakes happen often, and all of them are shallow (less than 70 km deep).', 'There are no volcanoes nearby.', 'Matching rocks on the two sides of a long, straight fault on land are now hundreds of kilometers apart.'],
    prompt: 'Which boundary fits this evidence?',
    choices: ['divergent-cc', 'transform-cc', 'convergent-cc'],
    answer: 'transform-cc',
    explain: 'Shallow earthquakes with no volcanoes, and rocks dragged sideways along a fault: the plates slide past each other at a transform boundary, like the San Andreas Fault.',
  },
  {
    show: { kind: 'evidence', facts: { motion: 'apart', quakeDepth: 'shallow', volcanoes: true, plates: 'oo' } },
    evidence: ['A long underwater mountain chain runs down the middle of an ocean.', 'The seafloor gets older the farther you go from it, on both sides.', 'Shallow earthquakes and basalt lava eruptions happen along its crest.'],
    prompt: 'Which boundary fits this evidence?',
    choices: ['convergent-oo', 'divergent-oo', 'transform-oo'],
    answer: 'divergent-oo',
    explain: 'New seafloor forms at the ridge and moves away on both sides, so it is youngest at the ridge: a divergent boundary, like the Mid-Atlantic Ridge.',
  },
  {
    show: { kind: 'section', key: 'convergent-cc', t: 16, speed: 4 },
    describe: 'Two continents push together. The crust where they meet is crumpled into high mountains with a thick root, and one plate slides a short way under the other. Earthquakes are spread across a wide zone and stay above about 100 km. There are no volcanoes.',
    prompt: 'Which boundary does this cross-section show?',
    choices: ['convergent-oc', 'divergent-cc', 'convergent-cc', 'transform-cc'],
    answer: 'convergent-cc',
    explain: 'Two continents push together. Neither sinks far, so the crust crumples into high mountains with a thick root, there are no volcanoes and the earthquakes stay fairly shallow, as in the Himalaya.',
  },
  {
    show: { kind: 'evidence', facts: { motion: 'together', quakeDepth: 'deep', volcanoes: true, plates: 'oo' } },
    evidence: ['A very deep ocean trench.', 'A curved chain of volcanic islands beside it.', 'Earthquakes get deeper and deeper away from the trench, down to hundreds of kilometers.'],
    prompt: 'Which boundary fits this evidence?',
    choices: ['convergent-oc', 'divergent-oo', 'convergent-oo', 'convergent-cc'],
    answer: 'convergent-oo',
    explain: 'One ocean plate sinks under another. The deepening earthquakes trace the sinking slab, and magma above it builds an island arc, like the Mariana Islands.',
  },
  {
    show: { kind: 'section', key: 'divergent-cc', t: 14, speed: 0.5 },
    describe: 'Continental crust has been pulled apart. Blocks have dropped along faults into a valley with a lake, the plate below has thinned, and magma rises to volcanoes beside the valley. The earthquakes are all shallow.',
    prompt: 'Which boundary does this cross-section show?',
    choices: ['divergent-cc', 'divergent-oo', 'convergent-cc', 'transform-cc'],
    answer: 'divergent-cc',
    explain: 'A continent is pulling apart: blocks have dropped along faults to make a rift valley with a lake, and magma rises where the plate has thinned, as in the East African Rift.',
  },
  {
    show: { kind: 'section', key: 'convergent-oo', t: 14, speed: 5 },
    describe: 'Ocean on both sides. One ocean plate sinks under the other at a trench, earthquakes get deeper along it to almost 600 km, and a volcano has grown up from the seafloor into an island.',
    prompt: 'Which boundary does this cross-section show?',
    choices: ['transform-oo', 'convergent-oo', 'divergent-oo', 'convergent-oc'],
    answer: 'convergent-oo',
    explain: 'There is ocean on both sides of the trench. The older plate sinks, earthquakes deepen along it, and volcanoes rise from the seafloor as islands, as in Japan and the Mariana Islands.',
  },
  {
    show: { kind: 'map', key: 'transform-oo', t: 10, speed: 3 },
    describe: 'Two pieces of a ridge on the seafloor are joined by a fault. Along that fault, arrows show the plates on either side moving in opposite directions.',
    prompt: 'This map shows the seafloor from above, with arrows for plate motion. What kind of boundary joins the two pieces of ridge?',
    choices: ['divergent-oo', 'convergent-oo', 'transform-oo'],
    answer: 'transform-oo',
    explain: 'Between the two ridge pieces the plates slide past each other in opposite directions. That fault is a transform boundary: shallow earthquakes, no volcanoes.',
  },
];
/** True when a case has every fact listed (used to check evidence questions have one right answer). */
export const factsMatch = (key, facts) => Object.entries(facts).every(([k, v]) => CASES[key][k] === v);
export const deeperThan = (a, b) => DEPTH_RANK[a] > DEPTH_RANK[b];
