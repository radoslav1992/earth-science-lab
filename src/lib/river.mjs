// The River Erosion Sandbox model: a virtual classroom stream table. Water runs from an inlet at the top of
// a tilted tray of sediment down to a "sea" (a pool held at a fixed level by a drain) at the bottom.
// Students set the slope, the water flow, the kind of sediment and how much sediment is fed in with the water.
//
// The model is deliberately simple, deterministic and the same everywhere (server render, browser, tests):
//   1. Grain thresholds, after Hjulström (1935) and Sundborg (1956): a grain on the bed is picked up (eroded)
//      when the water is faster than its erosion speed; a moving grain keeps moving (transported) until the
//      water is slower than its settling speed, and then settles (deposited).
//   2. Water speed from Manning's equation for a channel of fixed width (v grows as flow^0.4 × slope^0.3).
//   3. How much sediment the water can carry (its capacity) grows with speed. Where the water carries less than
//      it could and the bed grains can be lifted, it erodes; where it carries more, it drops the extra.
//   4. The bed changes by the difference between sediment flowing in and out of each 2 cm strip (the Exner
//      equation, the standard sediment budget used in river models); on land the banks slump as it cuts down.
// All lengths are in cm, speeds in cm/s, volumes in cm³ of loose, wet sediment, time in seconds (minutes on screen).
// Every value marked "classroom simplification" is a rounded choice that makes the tray behave like a real one;
// the page says so in "What this model simplifies".

// ---------- Sediment ----------
// Grain-size names follow the Wentworth (1922) scale used by the USGS: clay < 1/256 mm, silt 1/256–1/16 mm,
// sand 1/16–2 mm, gravel > 2 mm. Each choice uses one typical size from its class.
export const GRAINS = [
  { id: 'clay', name: 'Clay', mm: 0.002, color: '#9c7a68', note: 'tiny flakes that stick together' },
  { id: 'silt', name: 'Silt', mm: 0.02, color: '#b49a7a', note: 'feels like flour' },
  { id: 'fine-sand', name: 'Fine sand', mm: 0.2, color: '#dcc08a', note: 'like beach sand' },
  { id: 'coarse-sand', name: 'Coarse sand', mm: 1, color: '#c9a56b', note: 'gritty, like sugar crystals' },
  { id: 'gravel', name: 'Gravel', mm: 3, color: '#9b8c7a', note: 'small pebbles' },
];
export const GRAIN_IDS = GRAINS.map(g => g.id);
export const grainById = id => GRAINS.find(g => g.id === id) ?? GRAINS[2];
// Wentworth class boundaries (mm) for the Hjulström diagram's top strip.
export const SIZE_CLASSES = [
  { name: 'Clay', min: 0.001, max: 1 / 256 },
  { name: 'Silt', min: 1 / 256, max: 1 / 16 },
  { name: 'Sand', min: 1 / 16, max: 2 },
  { name: 'Gravel', min: 2, max: 100 },
];

// Erosion curve: the water speed (cm/s, mean speed in water about 1 m deep) needed to pick up a grain of each
// size from the bed. These anchor points are rounded readings from the middle of the band in the Hjulström (1935)
// diagram as redrawn by Sundborg (1956); between them the curve is a straight line on the log–log diagram.
// Real thresholds vary widely (water depth, grain shape, packing, how long clay has been settling), so the
// page always calls them approximate. The minimum near 0.3 mm is why sand is the easiest sediment to erode.
export const EROSION_ANCHORS = [[0.001, 150], [0.01, 60], [0.1, 25], [0.3, 20], [1, 30], [10, 100], [100, 300]];
export const SIZE_RANGE = [0.001, 100]; // mm, the diagram's grain-size axis
export const SPEED_AXIS = [0.1, 1000]; // cm/s, the diagram's speed axis
const log10 = Math.log10;

/** Approximate speed (cm/s) needed to erode (pick up) a grain of `mm` millimeters from the bed. */
export function erosionSpeed(mm) {
  const x = log10(Math.min(SIZE_RANGE[1], Math.max(SIZE_RANGE[0], mm)));
  for (let k = 0; k < EROSION_ANCHORS.length - 1; k++) {
    const [a, va] = EROSION_ANCHORS[k], [b, vb] = EROSION_ANCHORS[k + 1];
    if (x <= log10(b) + 1e-12) {
      const f = (x - log10(a)) / (log10(b) - log10(a));
      return 10 ** (log10(va) + f * (log10(vb) - log10(va)));
    }
  }
  return EROSION_ANCHORS[EROSION_ANCHORS.length - 1][1];
}

// Settling curve: how fast a grain sinks through still water, a common stand-in for Hjulström's lower
// (deposition) curve. Ferguson & Church (2004, Journal of Sedimentary Research 74: 933–937):
//   w = R g D² / (C1 ν + √(0.75 C2 R g D³)), with C1 = 18 and C2 = 1.0 for natural sieved grains,
// R = 1.65 (quartz, density 2650 kg/m³, in fresh water) and ν = 1.0 × 10⁻⁶ m²/s (water at about 20 °C).
const R = 1.65, G = 9.81, NU = 1.0e-6, C1 = 18, C2 = 1.0;
/** Settling (fall) speed in still water, cm/s, for a quartz grain of `mm` millimeters. */
export function settlingSpeed(mm) {
  const d = mm / 1000;
  return 100 * (R * G * d * d) / (C1 * NU + Math.sqrt(0.75 * C2 * R * G * d * d * d));
}

export const ZONES = ['erode', 'transport', 'deposit'];
export const ZONE_NAMES = { erode: 'Eroded', transport: 'Transported', deposit: 'Deposited' };
/** Which Hjulström zone a grain of `mm` is in at speed `v` (cm/s). */
export const zoneAt = (mm, v) => (v >= erosionSpeed(mm) ? 'erode' : v >= settlingSpeed(mm) ? 'transport' : 'deposit');

// ---------- The stream table ----------
// A 200 cm tray. Sediment slopes down from the inlet (x = 0) to the shoreline at x = 140 cm, where the sea
// starts; the drain holds sea level at height 0. Under the water the sediment drops at the tray's slope
// (at least 10%) to a flat floor 5 cm deep. On land the sediment is 10 cm thick at the inlet.
export const TRAY = { length: 200, width: 60, shore: 140, seaDepth: 5, beach: 0.1, thickness: 10 };
export const DX = 2; // cm between model points
export const NODES = TRAY.length / DX + 1; // 101 points along the tray
export const SHORE_NODE = TRAY.shore / DX;
export const XS = Array.from({ length: NODES }, (_, i) => i * DX);
// Classroom simplifications: a channel 3 cm wide with one Manning roughness for every sediment
// (Strickler's rule, n = D^(1/6) ÷ 21.1, gives about 0.013–0.020 for sand and fine gravel).
export const CHANNEL_WIDTH = 3; // cm
export const MANNING_N = 0.015;
// The water fans out as it enters the sea: its width grows 0.4 cm per cm traveled (about 11° each side).
export const SPREAD = 0.4;
// How much sediment the water can carry: capacity = K × flow × ((v − settling speed) ÷ 30 cm/s)^1.5, in cm³/s.
// The 1.5 power echoes bedload formulas such as Meyer-Peter & Müller (1948); K is a classroom choice that
// lets a stream table move a few hundred cm³ of sand in ten minutes, as real ones do.
export const CAPACITY_K = 0.015;
const CAPACITY_V = 30;
// Banks: on land the channel doesn't just get deeper or shallower. Loose sand walls slump to about 32° (sand's
// angle of repose is roughly 30–35°), so a cut d cm deep is SIDE_CUT × d cm wider on each side at the top;
// sediment dropped on land spreads out more gently, SIDE_FILL × d cm on each side, like a low fan.
// The model keeps the cross-section's change in area, A = width × d + side × d², so every cm³ is counted.
export const SIDE_CUT = 1.6;
export const SIDE_FILL = 3;
const MIN_SLOPE = 0.0001;
const MAX_RATE = 0.02; // cm/s: the bed can't rise or fall faster than this at one spot (keeps the steps stable)
const DT = 0.5; // s per model step
const SNAP_EVERY = 12; // steps between stored snapshots (0.1 minute)

// The student's settings.
export const SLOPE_RANGE = [1, 10]; // percent (cm of drop per 100 cm), step 0.5
export const FLOW_RANGE = [0.5, 8]; // liters per minute, step 0.5
export const SUPPLY_RANGE = [0, 100]; // cm³ of sediment fed in per minute, step 10
export const TIME_RANGE = [0, 20]; // minutes, step 0.5
export const MODES = ['explore', 'challenge'];
export const DEFAULT_STATE = { slope: 4, flow: 3, grain: 'fine-sand', supply: 0, t: 10, mode: 'explore' };

const cm3PerSec = litersPerMinute => (litersPerMinute * 1000) / 60;

/** Water depth (cm) for a flow (cm³/s) in a channel `width` cm wide on a `slope` (fraction): Manning's equation. */
export function normalDepth(q, width, slope) {
  const Q = q * 1e-6, w = width / 100; // SI
  return 100 * ((Q * MANNING_N) / (w * Math.sqrt(slope))) ** 0.6;
}

/** Water speed (cm/s) in the 3 cm channel for a flow in L/min on a slope in percent. */
export function flowSpeed(litersPerMinute, slopePercent) {
  const q = cm3PerSec(litersPerMinute);
  return q / (CHANNEL_WIDTH * normalDepth(q, CHANNEL_WIDTH, Math.max(MIN_SLOPE, slopePercent / 100)));
}

/** Sediment the water could carry (cm³/s) at speed v for a grain with settling speed ws. */
export function capacity(q, v, ws) {
  if (v <= ws) return 0;
  const e = (v - ws) / CAPACITY_V;
  return CAPACITY_K * q * e * Math.sqrt(e);
}

/** The starting shape of the tray: sediment surface, the tray bottom under it, and the flow width. */
export function initialBed(slopePercent) {
  const s = slopePercent / 100, beach = Math.max(s, TRAY.beach);
  const z0 = XS.map(x => (x <= TRAY.shore ? s * (TRAY.shore - x) : -Math.min(TRAY.seaDepth, beach * (x - TRAY.shore))));
  // The tray's bottom is a straight slope: the sediment is 10 cm thick at the inlet and 6 cm at the shoreline,
  // where the bottom meets the sea floor, which has 1 cm of sediment on it.
  const bottomAtShore = -TRAY.seaDepth - 1;
  const floor = z0.map((z, i) => (XS[i] <= TRAY.shore ? z - (TRAY.thickness + (-bottomAtShore - TRAY.thickness) * (XS[i] / TRAY.shore)) : bottomAtShore));
  const width = XS.map(x => (x <= TRAY.shore ? CHANNEL_WIDTH : CHANNEL_WIDTH + SPREAD * (x - TRAY.shore)));
  return { z0, floor, width };
}

// Three bends in the channel on its way to the sea (cm along the tray). The plan view draws them; the model
// compares the water on their inside and outside. Water on the outside of a bend flows faster than on the
// inside; this lab uses 25% faster and 25% slower than the middle (a classroom simplification).
export const BENDS = [30, 70, 110];
export const BEND_FACTOR = 0.25;

function clampSettings(settings) {
  const s = { ...DEFAULT_STATE, ...settings };
  const inRange = (name, [lo, hi]) => (Number.isFinite(Number(s[name])) ? Math.min(hi, Math.max(lo, Number(s[name]))) : DEFAULT_STATE[name]);
  return {
    slope: inRange('slope', SLOPE_RANGE),
    flow: inRange('flow', FLOW_RANGE),
    grain: GRAIN_IDS.includes(s.grain) ? s.grain : DEFAULT_STATE.grain,
    supply: inRange('supply', SUPPLY_RANGE),
  };
}
const runKey = s => `${s.slope}|${s.flow}|${s.grain}|${s.supply}`;
const cache = new Map();
const STEPS = Math.round((TIME_RANGE[1] * 60) / DT);

/**
 * The stream table run for these settings: snapshots every 0.1 minute of the bed heights, the sediment load,
 * the water's speed and depth, and the running totals. Deterministic: the same settings always give the same
 * run. The run is worked out lazily, only as far as someone asks for (snapshotAt and measure do that), and
 * cached, so dragging a slider at 10 minutes never computes the full 20.
 */
export function simulate(settings, { fresh = false } = {}) {
  const s = clampSettings(settings);
  const key = runKey(s);
  if (!fresh && cache.has(key)) return cache.get(key);
  const grain = grainById(s.grain);
  const ve = erosionSpeed(grain.mm), ws = settlingSpeed(grain.mm);
  const q = cm3PerSec(s.flow), supply = s.supply / 60;
  const { z0, floor, width } = initialBed(s.slope);
  const z = Float64Array.from(z0);
  const n = NODES;
  // Per face (between point i and i + 1): the width there and ln((Q n / w)^0.6), so depth = A × slope^−0.3.
  const fw = new Float64Array(n - 1), logA = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    fw[i] = (width[i] + width[i + 1]) / 2;
    logA[i] = Math.log(100 * ((q * 1e-6 * MANNING_N) / (fw[i] / 100)) ** 0.6);
  }
  // Cross-section change (cm²) at each point, and the change it can't go past (the tray's bottom).
  const area = new Float64Array(n), dA = new Float64Array(n), minArea = new Float64Array(n);
  for (let i = 0; i < n; i++) minArea[i] = areaFromDepth(i, floor[i] - z0[i], width);
  const load = new Float64Array(n), speed = new Float64Array(n - 1), depth = new Float64Array(n - 1);
  const bendActive = BENDS.map(() => ({ inside: 0, outside: 0 }));
  let out = 0, fed = 0, step = 0;
  const run = { settings: s, grain, erosion: ve, settling: ws, z0, floor, width, snaps: [], startSpeed: flowSpeed(s.flow, s.slope) };

  function stepOnce() {
    // One pass down the tray: the sediment load carried across each face.
    let carried = supply, hPrev = 0;
    for (let i = 0; i < n - 1; i++) {
      let h;
      if (z[i + 1] < 0) h = Math.max(hPrev, -z[i + 1]); // entering the sea: the water surface is sea level
      else h = Math.exp(logA[i] - 0.3 * Math.log(Math.max(MIN_SLOPE, (z[i] - z[i + 1]) / DX)));
      hPrev = h;
      const v = q / (fw[i] * h);
      speed[i] = v;
      depth[i] = h;
      const cap = capacity(q, v, ws);
      let next = carried;
      if (carried > cap || v >= ve) {
        // The water adjusts its load toward its capacity over about speed × depth ÷ settling speed: the
        // distance a lifted grain travels while sinking back, so fine grains are carried far.
        const f = 1 - Math.exp(-DX / Math.max(DX, (v * h) / ws));
        const maxRate = MAX_RATE * topWidth(i, z[i] - z0[i], width) * DX; // cm³/s
        if (carried > cap) next = Math.max(carried - (carried - cap) * f, carried - maxRate);
        else next = Math.min(carried + (cap - carried) * f, carried + Math.min(maxRate, ((area[i] - minArea[i]) * DX) / DT));
      }
      dA[i] = (-(next - carried) * DT) / DX;
      carried = next;
      load[i] = carried;
    }
    load[n - 1] = carried;
    if (step % SNAP_EVERY === 0) {
      // Bends also count how long their inside has been building a bar and their outside cutting the bank.
      const bends = BENDS.map((x, k) => bendState(z, load, x, q, ve, ws, bendActive[k]));
      bends.forEach((b, k) => {
        if (b.inside === 'deposit') bendActive[k].inside += (SNAP_EVERY * DT) / 60;
        if (b.outside === 'erode') bendActive[k].outside += (SNAP_EVERY * DT) / 60;
      });
      run.snaps.push({ t: (step * DT) / 60, z: Float64Array.from(z), area: Float64Array.from(area), load: Float64Array.from(load), speed: Float32Array.from(speed), depth: Float32Array.from(depth), out, fed, bends });
    }
    for (let i = 0; i < n - 1; i++) {
      if (dA[i] === 0) continue;
      area[i] = Math.max(minArea[i], area[i] + dA[i]);
      z[i] = z0[i] + depthFromArea(i, area[i], width);
    }
    out += carried * DT;
    fed += supply * DT;
    step++;
  }
  /** Works the run out at least as far as `minutes`. */
  run.ensure = minutes => {
    const target = Math.min(STEPS, Math.ceil(Math.round(minutes * 600) / 600 * 60 / DT / SNAP_EVERY) * SNAP_EVERY);
    while (step <= target) stepOnce();
    return run;
  };
  if (fresh) return run;
  if (cache.size > 60) cache.delete(cache.keys().next().value);
  cache.set(key, run);
  return run;
}

const onLand = i => i <= SHORE_NODE;
/** Width (cm) of the bed that rises or falls at point i when it has changed by d cm. */
function topWidth(i, d, width) {
  if (!onLand(i)) return width[i];
  return width[i] + 2 * (d < 0 ? SIDE_CUT : SIDE_FILL) * Math.abs(d);
}
/** Cross-section change (cm²) for a bed change of d cm at point i. */
export function areaFromDepth(i, d, width) {
  if (!onLand(i)) return width[i] * d;
  const k = d < 0 ? SIDE_CUT : SIDE_FILL;
  return Math.sign(d) * (width[i] * Math.abs(d) + k * d * d);
}
/** Bed change (cm) for a cross-section change of A cm² at point i (the inverse of areaFromDepth). */
export function depthFromArea(i, A, width) {
  if (!onLand(i)) return A / width[i];
  const k = A < 0 ? SIDE_CUT : SIDE_FILL, w = width[i], a = Math.abs(A);
  return (Math.sign(A) * (Math.sqrt(w * w + 4 * k * a) - w)) / (2 * k);
}

/** Inside and outside of a bend: is a point bar building, is the bank being cut? */
function bendState(z, load, x, q, ve, ws, active) {
  const i = Math.round(x / DX);
  const slope = Math.max(MIN_SLOPE, (z[i - 5] - z[i + 5]) / (10 * DX));
  const v = q / (CHANNEL_WIDTH * normalDepth(q, CHANNEL_WIDTH, slope));
  const vin = v * (1 - BEND_FACTOR), vout = v * (1 + BEND_FACTOR);
  const carried = load[i];
  // Only grains that sink back within the bend (about speed × depth ÷ settling speed < 20 cm) build a bar:
  // silt and clay stay floating past it.
  const settlesHere = (vin * normalDepth(q, CHANNEL_WIDTH, slope)) / ws < 20;
  const inside = carried > 1e-6 && settlesHere && (vin < ws || carried > capacity(q, vin, ws) + 1e-9) ? 'deposit' : 'none';
  const outside = vout >= ve && z[i] > -1 ? 'erode' : 'none';
  return { x, speed: v, inside, outside, insideSpeed: vin, outsideSpeed: vout, barMinutes: active.inside, bankMinutes: active.outside };
}

/** The snapshot at time t (minutes), rounded to the stored 0.1-minute steps. */
export function snapshotAt(run, t) {
  const k = Math.round(Math.min(TIME_RANGE[1], Math.max(0, t)) * 10);
  run.ensure(k / 10);
  return run.snaps[k];
}

/** What students measure, from the run at time t (minutes). Volumes in cm³, lengths in cm, speeds in cm/s. */
export function measure(run, t = DEFAULT_STATE.t) {
  const snap = snapshotAt(run, t);
  const { z0 } = run;
  let eroded = 0, landDeposit = 0, seaDeposit = 0, deepestCut = 0, cutAt = 0, deltaLength = 0, newShore = TRAY.shore, buildUp = 0;
  for (let i = 0; i < NODES; i++) {
    const d = snap.z[i] - z0[i], vol = snap.area[i] * DX;
    if (vol < 0) eroded -= vol;
    if (i <= SHORE_NODE) {
      if (d < 0 && -d > deepestCut) { deepestCut = -d; cutAt = XS[i]; }
      if (vol > 0) { landDeposit += vol; buildUp = Math.max(buildUp, d); }
    } else {
      if (vol > 0) seaDeposit += vol;
      if (d >= 0.5) deltaLength = XS[i] - TRAY.shore;
      if (snap.z[i] >= 0) newShore = XS[i];
    }
  }
  // Water speed now, from the average slope of the channel between the inlet and the old shoreline.
  const avgSlope = Math.max(MIN_SLOPE, (snap.z[0] - snap.z[SHORE_NODE]) / TRAY.shore);
  const q = cm3PerSec(run.settings.flow);
  const speedNow = q / (CHANNEL_WIDTH * normalDepth(q, CHANNEL_WIDTH, avgSlope));
  return {
    t: snap.t, startSpeed: run.startSpeed, speedNow, eroded, landDeposit, seaDeposit, deepestCut, cutAt, buildUp,
    deltaLength, newShore, washedOut: snap.out, fed: snap.fed, zone: zoneAt(run.grain.mm, run.startSpeed), zoneNow: zoneAt(run.grain.mm, speedNow),
  };
}

/** Erosion and deposition along the tray right now: cm per minute at each point (negative = cutting down). */
export function activity(run, t) {
  const k = Math.max(1, Math.round(Math.min(TIME_RANGE[1], Math.max(0, t)) * 10));
  const a = snapshotAt(run, (k - 1) / 10), b = snapshotAt(run, k / 10);
  const dtMin = b.t - a.t;
  return Array.from(b.z, (zb, i) => (zb - a.z[i]) / dtMin);
}

// ---------- Numbers for people ----------
/** At most `decimals` places, trailing zeros dropped (250, 2.5, 0.25). */
export const fmt = (value, decimals = 1) => String(Number(value.toFixed(decimals)));
/** A volume of sediment for display: two significant figures from 10 cm³ up (1088 → 1100), whole numbers below. */
export function roundVolume(v) {
  if (v < 0.5) return 0;
  if (v < 10) return Math.round(v);
  const p = 10 ** (Math.floor(log10(v)) - 1);
  return Math.round(v / p) * p;
}
export const fmtVolume = v => roundVolume(v).toLocaleString('en-US');
export const fmtSpeed = v => String(Math.round(v));
export const fmtDepth = v => v.toFixed(1);
/** Threshold speeds for display, rounded to match how approximate they are: 110, 46, 2.3, 0.04. */
export function fmtThreshold(v) {
  if (v >= 100) return String(Math.round(v / 10) * 10);
  if (v >= 10) return String(Math.round(v));
  if (v >= 1) return fmt(v, 1);
  return String(Number(v.toPrecision(1)));
}
export const grainLabel = g => `${g.name} (${fmt(g.mm, 3)} mm)`;

/** One line per grain: what happens to it at speed v. */
export function grainsAt(v) {
  return GRAINS.map(g => ({ grain: g, zone: zoneAt(g.mm, v), erosion: erosionSpeed(g.mm), settling: settlingSpeed(g.mm) }));
}

/** A sentence for the results panel and screen readers. */
export function describeRun(run, t) {
  const m = measure(run, t), g = run.grain, parts = [];
  parts.push(`${fmt(run.settings.slope)}% slope, ${fmt(run.settings.flow)} liters per minute, ${g.name.toLowerCase()}${run.settings.supply ? `, ${run.settings.supply} cm³ of sediment fed in per minute` : ''}.`);
  parts.push(`After ${fmt(m.t)} minutes: the water started at ${fmtSpeed(m.startSpeed)} cm/s${m.t > 0 ? ` and now flows about ${fmtSpeed(m.speedNow)} cm/s` : ''}.`);
  if (m.eroded >= 0.5) parts.push(`It has eroded about ${fmtVolume(m.eroded)} cm³ of ${g.name.toLowerCase()} and cut the channel down ${fmtDepth(m.deepestCut)} cm at its deepest.`);
  else if (m.t > 0) parts.push(`The water is too slow to pick up ${g.name.toLowerCase()} from the bed, so the channel hasn't cut down.`);
  if (m.landDeposit >= 0.5) parts.push(`About ${fmtVolume(m.landDeposit)} cm³ has been dropped on land.`);
  if (m.deltaLength > 0) parts.push(`A delta reaches ${m.deltaLength} cm past the old shoreline.`);
  else if (m.seaDeposit >= 0.5) parts.push(`A thin layer of ${g.name.toLowerCase()} has settled in the sea.`);
  if (m.washedOut >= 0.5) parts.push(`About ${fmtVolume(m.washedOut)} cm³ stayed in the water and went down the drain.`);
  return parts.join(' ');
}

// ---------- Share links ----------
const snap = (v, step) => Math.round(v / step) * step;
const num = value => (value === null || value.trim() === '' ? NaN : Number(value));
const quoted = value => `“${value.length > 24 ? value.slice(0, 24) + '…' : value}”`;

/** Reads ?slope=4&flow=3&grain=fine-sand&supply=0&t=10&mode=challenge. Bad values fall back with a friendly note. */
export function parseRiverState(search) {
  const params = new URLSearchParams(search);
  const notes = [];
  const state = { ...DEFAULT_STATE };
  const range = (name, [lo, hi], step, unit, label) => {
    if (!params.has(name)) return;
    const v = num(params.get(name));
    if (Number.isFinite(v) && v >= lo && v <= hi) state[name] = snap(v, step);
    else notes.push(`The ${label} in the link must be between ${lo} and ${hi}${unit}, so ${DEFAULT_STATE[name]}${unit} is used.`);
  };
  range('slope', SLOPE_RANGE, 0.5, '%', 'slope');
  range('flow', FLOW_RANGE, 0.5, ' liters per minute', 'water flow');
  range('supply', SUPPLY_RANGE, 10, ' cm³ per minute', 'sediment supply');
  range('t', TIME_RANGE, 0.5, ' minutes', 'time');
  if (params.has('grain')) {
    const grain = params.get('grain');
    if (GRAIN_IDS.includes(grain)) state.grain = grain;
    else notes.push(`${quoted(grain)} isn’t a sediment in this sandbox, so fine sand is used.`);
  }
  if (params.has('mode')) {
    const mode = params.get('mode');
    if (MODES.includes(mode)) state.mode = mode;
    else notes.push(`${quoted(mode)} isn’t a mode here, so the sandbox opened in Explore mode.`);
  }
  return { state, notes };
}

export function serializeRiverState({ slope, flow, grain, supply, t, mode }) {
  const clampSnap = (v, [lo, hi], step) => fmt(snap(Math.min(hi, Math.max(lo, Number(v) || 0)), step), 1);
  const params = new URLSearchParams();
  params.set('slope', clampSnap(slope, SLOPE_RANGE, 0.5));
  params.set('flow', clampSnap(flow, FLOW_RANGE, 0.5));
  params.set('grain', GRAIN_IDS.includes(grain) ? grain : DEFAULT_STATE.grain);
  params.set('supply', clampSnap(supply, SUPPLY_RANGE, 10));
  params.set('t', clampSnap(t, TIME_RANGE, 0.5));
  if (mode === 'challenge') params.set('mode', 'challenge');
  return params.toString();
}

// ---------- Challenge ----------
// Each answer is worked out by the model, so the questions can never disagree with it. They are built on first
// use (the comparisons run the sandbox several times) and then kept.
const setupName = s => `${fmt(s.slope)}% slope, ${fmt(s.flow)} L/min`;
const run10 = s => measure(simulate(s), 10);
function zoneQuestion(id, v, prompt) {
  const g = grainById(id), zone = zoneAt(g.mm, v), ve = erosionSpeed(g.mm), ws = settlingSpeed(g.mm);
  const name = g.name.toLowerCase();
  const explain = zone === 'erode'
    ? `${v} cm/s is faster than the roughly ${fmtThreshold(ve)} cm/s needed to pick up ${name}, so it is eroded.`
    : zone === 'transport'
      ? `${v} cm/s is too slow to pick ${name} up from the bed (that needs about ${fmtThreshold(ve)} cm/s), but faster than it sinks (about ${fmtThreshold(ws)} cm/s), so grains that are already moving keep moving: transported.`
      : `${v} cm/s is slower than ${name} sinks through water (about ${fmtThreshold(ws)} cm/s), so it settles out: deposited.`;
  return { kind: 'zone', grain: id, speed: v, prompt, choices: [...ZONES], choiceNames: ZONE_NAMES, answer: zone, explain };
}
function compareQuestion({ prompt, setups, metric, label, value }) {
  const results = setups.map(s => run10(s)[metric]);
  const best = results.indexOf(Math.max(...results));
  return {
    kind: 'setups', prompt, setups, metric, values: results,
    choices: setups.map((_, i) => String(i)),
    choiceNames: Object.fromEntries(setups.map((s, i) => [String(i), label(s)])),
    answer: String(best),
    explain: `After 10 minutes: ${setups.map((s, i) => `${String.fromCharCode(65 + i)} (${label(s)}), ${value(results[i])}`).join('; ')}.`,
  };
}

export const CHALLENGE_SETUPS = {
  sand: [
    { slope: 2, flow: 2, grain: 'fine-sand', supply: 0 },
    { slope: 6, flow: 2, grain: 'fine-sand', supply: 0 },
    { slope: 2, flow: 6, grain: 'fine-sand', supply: 0 },
    { slope: 6, flow: 6, grain: 'fine-sand', supply: 0 },
  ],
  delta: ['silt', 'fine-sand', 'coarse-sand', 'gravel'].map(grain => ({ slope: 6, flow: 6, grain, supply: 0 })),
  bend: { setup: { slope: 4, flow: 3, grain: 'fine-sand', supply: 0 }, t: 5, bend: 0 },
  fan: { slope: 2, flow: 2, grain: 'fine-sand', supply: 60 },
};

let challenge = null;
/** The eight Challenge questions, with answers and explanations from the model. */
export function challengeQuestions() {
  if (challenge) return challenge;
  const clay = grainById('clay'), sand = grainById('fine-sand');
  const { bend: b, fan: fanSetup } = CHALLENGE_SETUPS;
  const bend = snapshotAt(simulate(b.setup), b.t).bends[b.bend];
  const fan = run10(fanSetup);
  challenge = [
    zoneQuestion('coarse-sand', 40, 'Coarse sand (1 mm) in water flowing at 40 cm/s: is it eroded, transported or deposited?'),
    zoneQuestion('fine-sand', 10, 'Fine sand (0.2 mm) is being carried along when the water slows to 10 cm/s. Is it eroded, transported or deposited?'),
    zoneQuestion('gravel', 15, 'Gravel (3 mm) in water flowing at 15 cm/s: is it eroded, transported or deposited?'),
    {
      kind: 'clay', prompt: 'Clay has settled on the bed of a stream. Will water flowing at 50 cm/s pick it up again?',
      choices: ['yes', 'no'], answer: erosionSpeed(clay.mm) > 50 ? 'no' : 'yes',
      choiceNames: { yes: 'Yes: clay is tiny and light, so it is easy to lift', no: 'No: settled clay sticks together, so it needs faster water' },
      explain: `Clay needs about ${fmtThreshold(erosionSpeed(clay.mm))} cm/s to be picked up, far more than fine sand (about ${fmtThreshold(erosionSpeed(sand.mm))} cm/s). Its tiny flakes stick together and lie flat in a smooth layer the water slides over. Once clay is floating, though, it sinks so slowly (about ${fmtThreshold(settlingSpeed(clay.mm))} cm/s) that almost any current keeps it moving.`,
    },
    compareQuestion({
      prompt: 'Fine sand, no sediment fed in, 10 minutes. Which setup erodes the most sand?',
      setups: CHALLENGE_SETUPS.sand, metric: 'eroded', label: setupName, value: v => `about ${fmtVolume(v)} cm³`,
    }),
    compareQuestion({
      prompt: 'A 6% slope and 6 L/min for 10 minutes. Which sediment builds the longest delta?',
      setups: CHALLENGE_SETUPS.delta, metric: 'deltaLength', label: s => grainById(s.grain).name.toLowerCase(),
      value: v => (v > 0 ? `${v} cm` : 'no delta, because it stays in the water and goes down the drain'),
    }),
    {
      kind: 'bend', prompt: 'Water carrying sand flows around a bend. Where does sand settle to build a sandbar?',
      choices: ['inside', 'outside', 'middle'], answer: bend.inside === 'deposit' ? 'inside' : bend.outside === 'deposit' ? 'outside' : 'middle',
      choiceNames: { inside: 'On the inside of the bend', outside: 'On the outside of the bend', middle: 'In the middle of the channel' },
      bend: { ...b, speed: bend.speed, insideSpeed: bend.insideSpeed, outsideSpeed: bend.outsideSpeed },
      explain: `In the sandbox (${setupName(b.setup)}, fine sand, after ${b.t} minutes) the middle of the first bend flows about ${fmtSpeed(bend.speed)} cm/s, the outside about ${fmtSpeed(bend.outsideSpeed)} cm/s and the inside only about ${fmtSpeed(bend.insideSpeed)} cm/s. The slow water on the inside can’t carry all its sand, so it drops some there as a point bar, while the fast water on the outside cuts into the bank.`,
    },
    {
      kind: 'fan', setup: fanSetup, prompt: 'Lots of fine sand (60 cm³ per minute) is fed in on a gentle 2% slope at 2 L/min. What happens near the top of the tray?',
      choices: ['cut', 'build', 'nothing'], answer: fan.eroded >= 0.5 ? 'cut' : fan.buildUp >= 0.5 ? 'build' : 'nothing',
      choiceNames: { cut: 'The channel cuts down', build: 'Sand piles up and the bed builds up', nothing: 'Nothing changes' },
      explain: `On a gentle slope the water can’t carry that much sand, so it drops the extra near the inlet: in 10 minutes the bed there builds up about ${fmtDepth(fan.buildUp)} cm, like an alluvial fan where a mountain stream reaches flat ground. Building up makes the slope steeper, until the water is fast enough to carry the load.`,
    },
  ];
  return challenge;
}
export const CHALLENGE_COUNT = 8;
