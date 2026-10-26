// The Water Cycle Explorer model: Earth's water reservoirs and how much they hold, the places a water droplet
// can visit and how long it typically stays, the processes that move it (and whether the sun's energy or gravity
// drives each one), the chances of each move, seeded chance for replayable journeys, share links, the
// "where is Earth's water?" zoom bars and the challenge questions. Shared by the server render, the browser
// and the tests.
//
// Sources
// - Reservoir volumes: USGS Water Science School, "Where is Earth's water?", after Shiklomanov (1993), in
//   Gleick (ed.), Water in Crisis. Volumes in cubic kilometers; the fresh/saline split of groundwater and lakes
//   is from the same table. Percentages here are computed from these volumes.
// - Residence times: the commonly reproduced table of typical residence times in Pidwirny, Fundamentals of
//   Physical Geography, 2nd ed. (2006), Table 8b-2: Antarctica 20,000 years, oceans 3,200 years, glaciers
//   20–100 years, soil moisture 1–2 months, shallow groundwater 100–200 years, deep groundwater 10,000 years,
//   lakes 50–100 years, rivers 2–6 months, atmosphere 9 days. Living things (biospheric water): about one week
//   (OpenStax Biology 2e, Fig. 46.12). Where a source gives a range, the model uses the middle of the range.
//   These are averages: a real water molecule can stay much shorter or much longer.
// - The chance that a droplet leaving the air lands on the ocean (77 in 100) follows the global water budget of
//   Trenberth et al. (2007, J. Hydrometeorology 8): about 373 thousand km³ a year of precipitation falls on the
//   ocean and 113 thousand km³ on land. Every other chance is a rounded classroom value that only follows the
//   real pattern (for example, most water that soaks into the soil goes back to the air through plants).
// - Climate shifts are qualitative: warmer means more evaporation, transpiration and melting and less snow;
//   colder means the opposite. The multipliers below show the direction of each change, not measured amounts.

// ---------- Units ----------
export const DAYS_PER_YEAR = 365.25;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;
/** A time { value, unit } in years. */
export const toYears = ({ value, unit }) => (unit === 'years' ? value : unit === 'months' ? value / MONTHS_PER_YEAR : unit === 'weeks' ? (value * DAYS_PER_WEEK) / DAYS_PER_YEAR : value / DAYS_PER_YEAR);

/** A number for display: at most `decimals` places, trailing zeros dropped (250, 2.5, 0.25). */
export const fmt = (value, decimals = 1) => String(Number(value.toFixed(decimals)));
/** Whole numbers with thousands separators: 3200 → "3,200". */
export const grouped = value => Math.round(value).toLocaleString('en-US');

/** A length of time in plain words: "9 days", "1 week", "1.5 months", "60 years", "3,200 years". */
export function formatDuration(years) {
  const days = years * DAYS_PER_YEAR;
  if (days < 0.5) return 'less than a day';
  if (days < 28) {
    const d = Math.round(days);
    if (d % DAYS_PER_WEEK === 0 && d <= 21) return d === 7 ? '1 week' : `${d / 7} weeks`;
    return d === 1 ? '1 day' : `${d} days`;
  }
  if (years < 1) {
    const months = fmt(years * MONTHS_PER_YEAR);
    return months === '1' ? '1 month' : `${months} months`;
  }
  if (years < 10) return fmt(years) === '1' ? '1 year' : `${fmt(years)} years`;
  return `${grouped(years)} years`;
}

// ---------- Where is Earth's water? (USGS, after Shiklomanov 1993) ----------
// km3: volume in cubic kilometers; fresh: the fresh part of it. The ten rows do not overlap and add up to the total.
export const RESERVOIRS = [
  { id: 'oceans', name: 'Oceans, seas and bays', short: 'Oceans', km3: 1338000000, fresh: 0 },
  { id: 'ice', name: 'Ice caps, glaciers and permanent snow', short: 'Ice and snow', km3: 24064000, fresh: 24064000 },
  { id: 'groundwater', name: 'Groundwater (fresh and salty)', short: 'Groundwater', km3: 23400000, fresh: 10530000 },
  { id: 'permafrost', name: 'Ground ice and permafrost', short: 'Permafrost', km3: 300000, fresh: 300000 },
  { id: 'lakes', name: 'Lakes (fresh and salty)', short: 'Lakes', km3: 176400, fresh: 91000 },
  { id: 'soil', name: 'Soil moisture', short: 'Soil', km3: 16500, fresh: 16500 },
  { id: 'atmosphere', name: 'Atmosphere (water vapor and clouds)', short: 'Atmosphere', km3: 12900, fresh: 12900 },
  { id: 'swamps', name: 'Swamp water', short: 'Swamps', km3: 11470, fresh: 11470 },
  { id: 'rivers', name: 'Rivers', short: 'Rivers', km3: 2120, fresh: 2120 },
  { id: 'living', name: 'Living things', short: 'Living things', km3: 1120, fresh: 1120 },
];
export const RESERVOIR = Object.fromEntries(RESERVOIRS.map(r => [r.id, r]));
export const TOTAL_KM3 = RESERVOIRS.reduce((sum, r) => sum + r.km3, 0);
export const FRESH_KM3 = RESERVOIRS.reduce((sum, r) => sum + r.fresh, 0);
export const SALTY_GROUNDWATER_KM3 = RESERVOIR.groundwater.km3 - RESERVOIR.groundwater.fresh;
/** Percent of all of Earth's water. */
export const pctOfAll = id => (RESERVOIR[id].km3 / TOTAL_KM3) * 100;
/** Percent of Earth's fresh water. */
export const pctOfFresh = id => (RESERVOIR[id].fresh / FRESH_KM3) * 100;
export const FRESH_PCT = (FRESH_KM3 / TOTAL_KM3) * 100;
/** If all of Earth's water (or all of its fresh water) filled a 1-liter bottle: milliliters. */
export const mlPerLiter = (id, kind = 'all') => (kind === 'fresh' ? pctOfFresh(id) : pctOfAll(id)) * 10;
const amount = (id, kind) => (kind === 'fresh' ? RESERVOIR[id].fresh : RESERVOIR[id].km3);

/** A percentage with two significant figures for small values: 96.5, 1.7, 0.022, 0.00093. */
export function formatPct(pct) {
  if (pct >= 1) return fmt(pct, 1);
  if (pct <= 0) return '0';
  const digits = Math.min(8, 1 - Math.floor(Math.log10(pct)));
  return String(Number(pct.toFixed(digits)));
}
/** Milliliters in plain words with two significant figures: 965, 17, 0.22, 0.0093. */
export const formatMl = ml => (ml >= 100 ? grouped(ml) : formatPct(ml));

/** Typical time water stays in each reservoir, in words (Pidwirny 2006; living things: OpenStax Biology 2e). */
export const RESIDENCE_TEXT = {
  oceans: 'about 3,200 years',
  ice: 'mountain glaciers 20 to 100 years; Antarctica about 20,000 years',
  groundwater: 'shallow 100 to 200 years; deep about 10,000 years',
  permafrost: null,
  lakes: '50 to 100 years',
  soil: '1 to 2 months',
  atmosphere: 'about 9 days',
  swamps: null,
  rivers: '2 to 6 months',
  living: 'about 1 week',
};

// Each bar shows the pieces that are at least 1% of it; everything smaller is grouped and zoomed into on the next bar.
export const ZOOM_THRESHOLD = 0.01;
/**
 * The zoom bars for all water ('all') or fresh water only ('fresh'). Each level: { total, zoom (how many times
 * bigger than the first bar), items: [{ id, km3, share }], rest: { ids, km3, share } | null }.
 */
export function whereLevels(kind = 'all') {
  let ids = RESERVOIRS.filter(r => amount(r.id, kind) > 0).map(r => r.id);
  const first = ids.reduce((sum, id) => sum + amount(id, kind), 0);
  const levels = [];
  while (ids.length) {
    const total = ids.reduce((sum, id) => sum + amount(id, kind), 0);
    let shown = ids.filter(id => amount(id, kind) / total >= ZOOM_THRESHOLD);
    let small = ids.filter(id => !shown.includes(id));
    if (small.length === 1) { shown = ids; small = []; }
    const restKm3 = small.reduce((sum, id) => sum + amount(id, kind), 0);
    levels.push({
      total,
      zoom: first / total,
      items: shown.map(id => ({ id, km3: amount(id, kind), share: amount(id, kind) / total })),
      rest: small.length ? { ids: small, km3: restKm3, share: restKm3 / total } : null,
    });
    ids = small;
  }
  return levels;
}

// ---------- The journey: places, processes and moves ----------
// Each place (stop) belongs to one of the reservoirs above. stay: the typical time a droplet spends there
// (the middle of the source's range, see the header); range: the source's wording.
export const STOPS = [
  { id: 'ocean', code: 'oc', name: 'Ocean', label: 'Ocean', reservoir: 'oceans', stay: { value: 3200, unit: 'years' }, range: 'about 3,200 years' },
  { id: 'atmosphere', code: 'at', name: 'Atmosphere', label: 'Atmosphere', reservoir: 'atmosphere', stay: { value: 9, unit: 'days' }, range: 'about 9 days' },
  { id: 'glacier', code: 'gl', name: 'Mountain glacier', label: 'Glacier', reservoir: 'ice', stay: { value: 60, unit: 'years' }, range: '20 to 100 years' },
  { id: 'icesheet', code: 'is', name: 'Ice sheet', label: 'Ice sheet', reservoir: 'ice', stay: { value: 20000, unit: 'years' }, range: 'about 20,000 years (Antarctica)' },
  { id: 'soil', code: 'so', name: 'Soil', label: 'Soil', reservoir: 'soil', stay: { value: 1.5, unit: 'months' }, range: '1 to 2 months' },
  { id: 'plants', code: 'lt', name: 'Living things', label: 'Plants', reservoir: 'living', stay: { value: 1, unit: 'weeks' }, range: 'about 1 week' },
  { id: 'river', code: 'ri', name: 'River', label: 'River', reservoir: 'rivers', stay: { value: 4, unit: 'months' }, range: '2 to 6 months' },
  { id: 'lake', code: 'la', name: 'Lake', label: 'Lake', reservoir: 'lakes', stay: { value: 75, unit: 'years' }, range: '50 to 100 years' },
  { id: 'groundwater', code: 'gw', name: 'Groundwater', label: 'Groundwater', reservoir: 'groundwater', stay: { value: 150, unit: 'years' }, range: '100 to 200 years (shallow)' },
  { id: 'deep', code: 'dg', name: 'Deep groundwater', label: 'Deep groundwater', reservoir: 'groundwater', stay: { value: 10000, unit: 'years' }, range: 'about 10,000 years' },
];
export const STOP = Object.fromEntries(STOPS.map(s => [s.id, s]));
export const STOP_IDS = STOPS.map(s => s.id);
const BY_CODE = Object.fromEntries(STOPS.map(s => [s.code, s.id]));
/** Typical time at a place, in years. */
export const stayYears = id => toYears(STOP[id].stay);
/** "about 3,200 years" */
export const stayText = id => `about ${formatDuration(stayYears(id))}`;
/** "the ocean", "a mountain glacier", "living things" */
export const placeName = id => ({ ocean: 'the ocean', atmosphere: 'the atmosphere', glacier: 'a mountain glacier', icesheet: 'an ice sheet', soil: 'the soil', plants: 'living things', river: 'a river', lake: 'a lake', groundwater: 'the groundwater', deep: 'deep groundwater' })[id];

// The two drivers of the cycle. Condensation is cooling: it happens when rising air cools, and gives heat away.
export const DRIVERS = {
  sun: { name: 'The sun’s energy', short: 'Sun', summary: 'lifts water up into the air' },
  gravity: { name: 'Gravity', short: 'Gravity', summary: 'pulls water down and downhill' },
};
export const PROCESSES = {
  evaporation: { name: 'Evaporation', driver: 'sun', what: 'Liquid water warms up and turns into water vapor, an invisible gas.' },
  transpiration: { name: 'Transpiration', driver: 'sun', what: 'Plants give off water vapor through tiny holes in their leaves.' },
  sublimation: { name: 'Sublimation', driver: 'sun', what: 'Ice and snow turn straight into water vapor without melting first.' },
  melting: { name: 'Melting', driver: 'sun', what: 'Ice warms up and turns into liquid water.' },
  uptake: { name: 'Uptake by roots', driver: 'sun', what: 'Roots draw water from the soil. The pull comes from water evaporating out of the leaves, so the sun powers it.' },
  condensation: { name: 'Condensation', driver: null, what: 'Water vapor cools and turns into the tiny droplets and ice crystals that make clouds.' },
  precipitation: { name: 'Precipitation', driver: 'gravity', what: 'Cloud droplets join until they are heavy enough to fall as rain or snow.' },
  accumulation: { name: 'Snow accumulation', driver: 'gravity', what: 'Snow falls and piles up. Over years, buried snow is squeezed and freezes into glacier ice.' },
  runoff: { name: 'Runoff', driver: 'gravity', what: 'Water flows downhill over the ground and in streams and rivers.' },
  infiltration: { name: 'Infiltration', driver: 'gravity', what: 'Water soaks down into the ground.' },
  groundwater: { name: 'Groundwater flow', driver: 'gravity', what: 'Water creeps slowly through tiny spaces in soil and rock, downhill underground.' },
};
export const PROCESS_IDS = Object.keys(PROCESSES);

// Every move in the model. w: the chance out of 100 in today's climate. via: a process that happens on the way.
export const EDGES = [
  { from: 'ocean', to: 'atmosphere', process: 'evaporation', w: 100, text: 'Evaporates from the sea surface' },

  { from: 'atmosphere', to: 'ocean', process: 'precipitation', via: 'condensation', w: 77, text: 'Falls as rain on the ocean' },
  { from: 'atmosphere', to: 'soil', process: 'precipitation', via: 'condensation', w: 19, text: 'Falls as rain on land and soaks into the soil' },
  { from: 'atmosphere', to: 'lake', process: 'precipitation', via: 'condensation', w: 2, text: 'Falls as rain on a lake' },
  { from: 'atmosphere', to: 'glacier', process: 'accumulation', via: 'condensation', w: 1, text: 'Falls as snow on a mountain glacier' },
  { from: 'atmosphere', to: 'icesheet', process: 'accumulation', via: 'condensation', w: 1, text: 'Falls as snow on a polar ice sheet' },

  { from: 'glacier', to: 'river', process: 'melting', w: 80, text: 'Melts into a mountain stream' },
  { from: 'glacier', to: 'atmosphere', process: 'sublimation', w: 20, text: 'Turns straight into vapor in the dry mountain air' },

  { from: 'icesheet', to: 'ocean', process: 'melting', w: 90, text: 'Flows to the coast, breaks off as an iceberg and melts' },
  { from: 'icesheet', to: 'atmosphere', process: 'sublimation', w: 10, text: 'Turns straight into vapor in the cold, dry air' },

  { from: 'soil', to: 'plants', process: 'uptake', w: 35, text: 'Is drawn up by plant roots' },
  { from: 'soil', to: 'atmosphere', process: 'evaporation', w: 25, text: 'Evaporates from the ground' },
  { from: 'soil', to: 'groundwater', process: 'infiltration', w: 25, text: 'Soaks deeper, down to the groundwater' },
  { from: 'soil', to: 'river', process: 'runoff', w: 15, text: 'Runs downhill over the ground into a river' },

  { from: 'plants', to: 'atmosphere', process: 'transpiration', w: 100, text: 'Escapes from a leaf as vapor' },

  { from: 'river', to: 'ocean', process: 'runoff', w: 70, text: 'Flows downstream to the ocean' },
  { from: 'river', to: 'lake', process: 'runoff', w: 15, text: 'Flows into a lake' },
  { from: 'river', to: 'atmosphere', process: 'evaporation', w: 10, text: 'Evaporates from the river' },
  { from: 'river', to: 'groundwater', process: 'infiltration', w: 5, text: 'Seeps through the riverbed into the ground' },

  { from: 'lake', to: 'river', process: 'runoff', w: 45, text: 'Flows out of the lake into a river' },
  { from: 'lake', to: 'atmosphere', process: 'evaporation', w: 40, text: 'Evaporates from the lake' },
  { from: 'lake', to: 'groundwater', process: 'infiltration', w: 15, text: 'Seeps through the lake bed into the ground' },

  { from: 'groundwater', to: 'river', process: 'groundwater', w: 60, text: 'Seeps into a riverbed or spring' },
  { from: 'groundwater', to: 'ocean', process: 'groundwater', w: 15, text: 'Seeps out under the sea at the coast' },
  { from: 'groundwater', to: 'deep', process: 'groundwater', w: 15, text: 'Sinks slowly into deeper rock' },
  { from: 'groundwater', to: 'lake', process: 'groundwater', w: 10, text: 'Seeps into a lake from below' },

  { from: 'deep', to: 'ocean', process: 'groundwater', w: 70, text: 'Creeps all the way to the sea floor' },
  { from: 'deep', to: 'river', process: 'groundwater', w: 30, text: 'Rises in a spring that feeds a river' },
];
export const edge = (from, to) => EDGES.find(e => e.from === from && e.to === to);
/** "Condensation, then precipitation" for moves with a process on the way. */
export const moveName = e => (e.via ? `${PROCESSES[e.via].name}, then ${PROCESSES[e.process].name.toLowerCase()}` : PROCESSES[e.process].name);
export const driverOf = e => PROCESSES[e.process].driver;

// ---------- Conditions ----------
export const CLIMATES = ['colder', 'today', 'warmer'];
export const CLIMATE_NAMES = { colder: 'Colder', today: 'Today', warmer: 'Warmer' };
// Direction-only multipliers on a move's chance (classroom values, not measurements). Colder slows melting more
// than sublimation, so in the cold more of a glacier's loss is sublimation, as in Antarctica's dry valleys.
export const CLIMATE_SHIFTS = {
  colder: { accumulation: 3, melting: 0.5, evaporation: 0.8, transpiration: 0.8, uptake: 0.8 },
  today: {},
  warmer: { accumulation: 0.5, melting: 2, evaporation: 1.25, transpiration: 1.25, uptake: 1.25 },
};
export const DEFAULT_CONDITIONS = { climate: 'today', sun: true, gravity: true };
/** Is this move possible? The sun and gravity switches are thought experiments: off, their processes stop. */
export const moveAllowed = (e, cond = DEFAULT_CONDITIONS) => {
  const driver = driverOf(e);
  return !((driver === 'sun' && cond.sun === false) || (driver === 'gravity' && cond.gravity === false));
};

/** The ways out of a place and their chances (0–1, adding up to 1), largest first. Empty when the droplet is stuck. */
export function exits(id, cond = DEFAULT_CONDITIONS) {
  const shift = CLIMATE_SHIFTS[cond.climate] ?? {};
  const options = EDGES.filter(e => e.from === id && moveAllowed(e, cond)).map(e => ({ edge: e, weight: e.w * (shift[e.process] ?? 1) }));
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  return options.map(o => ({ ...o.edge, chance: o.weight / total })).sort((a, b) => b.chance - a.chance);
}
/** A chance for display: "77%", "2.9%", "0.5%". */
export const formatChance = p => `${p >= 0.095 ? Math.round(p * 100) : fmt(p * 100)}%`;
/** Why a droplet can't move from here (the sun and gravity switches are the only way to get stuck). */
export function stuckReason(id, cond) {
  const out = EDGES.filter(e => e.from === id);
  const names = [...new Set(out.map(e => PROCESSES[e.process].name.toLowerCase()))];
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  const drivers = [...new Set(out.map(driverOf))];
  const need = drivers.length > 1 ? 'the sun’s energy or gravity, and both are' : drivers[0] === 'sun' ? 'the sun’s energy, which is' : 'gravity, which is';
  return `The droplet is stuck in ${placeName(id)}: every way out (${list}) needs ${need} switched off.`;
}

// ---------- Seeded chance ----------
export const SEED_RANGE = [1, 9999];
/** A number in [0, 1) that depends only on the chance code and the step number, so links replay exactly. */
export function chanceDraw(seed, step) {
  let h = (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul((step >>> 0) + 0x632be5ab, 0x85ebca77)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** The exit a draw lands on: each exit owns a slice of [0, 1) as wide as its chance. */
export function pickExit(options, r) {
  let cumulative = 0;
  for (const o of options) {
    cumulative += o.chance;
    if (r < cumulative) return o;
  }
  return options.at(-1) ?? null;
}
/** The move chance would make as move number `step` (1, 2, 3…) from `id`. */
export const chanceMove = (id, seed, step, cond = DEFAULT_CONDITIONS) => pickExit(exits(id, cond), chanceDraw(seed, step));
/** A whole journey made by chance: [start, …places], stopping early if the droplet gets stuck. */
export function chanceJourney(start, seed, steps, cond = DEFAULT_CONDITIONS) {
  const path = [start];
  for (let k = 1; k <= steps; k++) {
    const move = chanceMove(path.at(-1), seed, k, cond);
    if (!move) break;
    path.push(move.to);
  }
  return path;
}

// ---------- Journeys ----------
/** The journey log: one row per move, with the time spent at the place it left and the running total (years). */
export function journeyLog(path) {
  let total = 0;
  return path.slice(1).map((to, i) => {
    const from = path[i], e = edge(from, to);
    if (!e) throw new Error(`No move from ${from} to ${to}`);
    total += stayYears(from);
    return { step: i + 1, from, to, edge: e, stay: stayYears(from), total };
  });
}
export const journeyYears = path => path.slice(0, -1).reduce((sum, id) => sum + stayYears(id), 0);
/** The longest stop in a journey (the place it spent the most time in). */
export function longestStop(path) {
  return path.slice(0, -1).reduce((best, id) => (best === null || stayYears(id) > stayYears(best) ? id : best), null);
}
/** Chance of following exactly this path, move by move. */
export function pathChance(path, cond = DEFAULT_CONDITIONS) {
  return path.slice(1).reduce((p, to, i) => p * (exits(path[i], cond).find(e => e.to === to)?.chance ?? 0), 1);
}
/** Fewest moves from one place to another (breadth-first search). */
export function shortestPath(from, to, cond = DEFAULT_CONDITIONS) {
  const prev = { [from]: null }, queue = [from];
  while (queue.length) {
    const id = queue.shift();
    if (id === to) break;
    for (const e of exits(id, cond)) if (!(e.to in prev)) { prev[e.to] = id; queue.push(e.to); }
  }
  if (!(to in prev)) return null;
  const path = [];
  for (let id = to; id !== null; id = prev[id]) path.unshift(id);
  return path;
}
/** Quickest route in total time (Dijkstra): the time counted is the stay at each place left. */
export function fastestPath(from, to, cond = DEFAULT_CONDITIONS) {
  const best = { [from]: 0 }, prev = { [from]: null }, done = new Set();
  while (true) {
    const open = Object.keys(best).filter(id => !done.has(id));
    if (!open.length) return null;
    const id = open.reduce((a, b) => (best[a] <= best[b] ? a : b));
    if (id === to) break;
    done.add(id);
    for (const e of exits(id, cond)) {
      const t = best[id] + stayYears(id);
      if (!(e.to in best) || t < best[e.to]) { best[e.to] = t; prev[e.to] = id; }
    }
  }
  const path = [];
  for (let id = to; id !== null; id = prev[id]) path.unshift(id);
  return path;
}
/** Every place a droplet can reach from here, and those where it gets stuck. */
export function reachable(from, cond = DEFAULT_CONDITIONS) {
  const seen = new Set([from]), queue = [from];
  while (queue.length) for (const e of exits(queue.shift(), cond)) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
  return { places: [...seen], stuck: [...seen].filter(id => !exits(id, cond).length) };
}

// ---------- Share links ----------
export const MODES = ['explore', 'challenge'];
export const VIEWS = ['journey', 'where'];
export const WATER_KINDS = ['all', 'fresh'];
export const UNITS = ['pct', 'km3', 'ml'];
export const MAX_STEPS = 60;
export const DEFAULT_SEED = 2026;
export const DEFAULT_STATE = { mode: 'explore', view: 'journey', path: ['ocean'], seed: DEFAULT_SEED, climate: 'today', sun: true, gravity: true, water: 'all', unit: 'pct' };
const quoted = value => `“${value.length > 24 ? value.slice(0, 24) + '…' : value}”`;
const num = value => (value === null || value.trim() === '' ? NaN : Number(value));

/** Reads ?path=oc.at.so&seed=2026&climate=warmer&sun=off&mode=challenge&view=where&water=fresh&unit=ml. */
export function parseWaterState(search) {
  const params = new URLSearchParams(search);
  const notes = [];
  const state = { ...DEFAULT_STATE, path: [...DEFAULT_STATE.path] };
  if (params.has('mode')) {
    const mode = params.get('mode');
    if (MODES.includes(mode)) state.mode = mode;
    else notes.push(`${quoted(mode)} isn’t a mode here, so the explorer opened in Explore mode.`);
  }
  if (params.has('view')) {
    const view = params.get('view');
    if (VIEWS.includes(view)) state.view = view;
    else notes.push(`${quoted(view)} isn’t a view here, so the droplet journey is shown.`);
  }
  if (params.has('climate')) {
    const climate = params.get('climate');
    if (CLIMATES.includes(climate)) state.climate = climate;
    else notes.push(`${quoted(climate)} isn’t a climate here, so today’s climate is used.`);
  }
  for (const name of ['sun', 'gravity']) {
    if (!params.has(name)) continue;
    const value = params.get(name);
    if (value === 'on' || value === 'off') state[name] = value === 'on';
    else notes.push(`The ${name === 'sun' ? 'sun’s energy' : 'gravity'} switch in the link must be on or off, so it was left on.`);
  }
  if (params.has('seed')) {
    const seed = num(params.get('seed'));
    if (Number.isInteger(seed) && seed >= SEED_RANGE[0] && seed <= SEED_RANGE[1]) state.seed = seed;
    else notes.push(`Chance codes are whole numbers from ${SEED_RANGE[0]} to ${grouped(SEED_RANGE[1])}, so code ${DEFAULT_SEED} is used.`);
  }
  if (params.has('path')) {
    const codes = params.get('path').split('.').filter(Boolean);
    const path = [];
    let problem = '';
    for (const code of codes) {
      if (path.length > MAX_STEPS) { problem = `Journeys can be up to ${MAX_STEPS} moves long, so the link’s journey was cut short.`; break; }
      const id = BY_CODE[code];
      if (!id) { problem = `The journey in the link has a place this lab doesn’t know (${quoted(code)})`; break; }
      if (path.length && !edge(path.at(-1), id)) { problem = `In this model a droplet can’t go straight from ${placeName(path.at(-1))} to ${placeName(id)}`; break; }
      path.push(id);
    }
    if (!path.length) notes.push(`${problem || 'The journey in the link was empty'}, so the droplet starts in the ocean.`);
    else {
      state.path = path;
      if (problem) notes.push(problem.endsWith('.') ? problem : `${problem}, so the journey stops just before that.`);
    }
  }
  if (params.has('water')) {
    const water = params.get('water');
    if (WATER_KINDS.includes(water)) state.water = water;
    else notes.push(`${quoted(water)} isn’t a choice here, so all of Earth’s water is shown.`);
  }
  if (params.has('unit')) {
    const unit = params.get('unit');
    if (UNITS.includes(unit)) state.unit = unit;
    else notes.push(`${quoted(unit)} isn’t a unit here, so percentages are shown.`);
  }
  return { state, notes };
}

export function serializeWaterState({ mode, view, path, seed, climate, sun, gravity, water, unit }) {
  const params = new URLSearchParams();
  if (mode === 'challenge') params.set('mode', 'challenge');
  if (view === 'where') params.set('view', 'where');
  const valid = [];
  for (const id of path ?? []) {
    if (!STOP[id] || (valid.length && !edge(valid.at(-1), id)) || valid.length > MAX_STEPS) break;
    valid.push(id);
  }
  params.set('path', (valid.length ? valid : DEFAULT_STATE.path).map(id => STOP[id].code).join('.'));
  params.set('seed', String(Number.isInteger(seed) && seed >= SEED_RANGE[0] && seed <= SEED_RANGE[1] ? seed : DEFAULT_SEED));
  params.set('climate', CLIMATES.includes(climate) ? climate : 'today');
  if (sun === false) params.set('sun', 'off');
  if (gravity === false) params.set('gravity', 'off');
  if (water === 'fresh') params.set('water', 'fresh');
  if (unit && unit !== 'pct' && UNITS.includes(unit)) params.set('unit', unit);
  return params.toString();
}

// ---------- The scene (a schematic cross-section of land, sea and sky; 800 × 500 units) ----------
export const VIEW = { width: 800, height: 500 };
// Where the droplet sits at each place, and where the place's name goes.
export const ANCHORS = {
  atmosphere: { x: 402, y: 88, lx: 402, ly: 46, anchor: 'middle' },
  glacier: { x: 116, y: 170, lx: 116, ly: 214, anchor: 'middle' },
  icesheet: { x: 768, y: 258, lx: 792, ly: 184, anchor: 'end', sub: 'near the poles' },
  ocean: { x: 664, y: 376, lx: 664, ly: 420, anchor: 'middle' },
  river: { x: 262, y: 280, lx: 222, ly: 302, anchor: 'end' },
  lake: { x: 374, y: 314, lx: 374, ly: 345, anchor: 'middle' },
  plants: { x: 528, y: 252, lx: 486, ly: 262, anchor: 'end' },
  soil: { x: 492, y: 328, lx: 492, ly: 366, anchor: 'middle' },
  groundwater: { x: 430, y: 378, lx: 404, ly: 384, anchor: 'end' },
  deep: { x: 430, y: 456, lx: 458, ly: 461, anchor: 'start' },
};
// How much each move's arrow bows to the left of its direction (a fraction of its length).
const BEND = {
  'ocean>atmosphere': 0.12, 'atmosphere>ocean': 0.12, 'atmosphere>soil': -0.08, 'atmosphere>lake': 0.1, 'atmosphere>glacier': 0.14,
  'atmosphere>icesheet': -0.16, 'glacier>river': -0.2, 'glacier>atmosphere': 0.14, 'icesheet>ocean': -0.25, 'icesheet>atmosphere': -0.16,
  'soil>plants': 0.3, 'soil>atmosphere': 0.16, 'soil>groundwater': -0.18, 'soil>river': 0.22, 'plants>atmosphere': 0.16,
  'river>ocean': -0.28, 'river>lake': -0.3, 'river>atmosphere': 0.14, 'river>groundwater': -0.18, 'lake>river': -0.3,
  'lake>atmosphere': 0.08, 'lake>groundwater': 0.25, 'groundwater>river': 0.18, 'groundwater>ocean': 0.06, 'groundwater>deep': 0.3,
  'groundwater>lake': 0.25, 'deep>ocean': 0.08, 'deep>river': -0.22,
};
const r1 = v => Math.round(v * 10) / 10;
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Points along a move's curved arrow, trimmed clear of the droplet at each end. */
export function edgePoints(from, to, samples = 28) {
  const a = ANCHORS[from], b = ANCHORS[to];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const bend = BEND[`${from}>${to}`] ?? 0.15;
  const cx = (a.x + b.x) / 2 + (dy / len) * bend * len, cy = (a.y + b.y) / 2 - (dx / len) * bend * len;
  const at = t => [(1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x, (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y];
  const t0 = Math.min(0.3, 17 / len), t1 = 1 - Math.min(0.3, 22 / len);
  return Array.from({ length: samples + 1 }, (_, k) => at(t0 + ((t1 - t0) * k) / samples).map(r1));
}
const line = pts => 'M' + pts.map(([x, y]) => `${x} ${y}`).join('L');
function arrowHead(pts, size = 11) {
  const [x2, y2] = pts.at(-1), [x1, y1] = pts.at(-3);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const tip = [x2 + ux * size * 0.6, y2 + uy * size * 0.6];
  return `M${r1(tip[0])} ${r1(tip[1])}L${r1(tip[0] - ux * size - uy * size * 0.55)} ${r1(tip[1] - uy * size + ux * size * 0.55)}L${r1(tip[0] - ux * size + uy * size * 0.55)} ${r1(tip[1] - uy * size - ux * size * 0.55)}Z`;
}
export const DROPLET_PATH = 'M0 -15C5 -8 10 -2 10 4A10 10 0 0 1 -10 4C-10 -2 -5 -8 0 -15Z';

// The textbook arrows for each process, drawn on the scene (driver colors them).
const PROCESS_ARROWS = [
  { process: 'evaporation', d: 'M642 300C640 268 640 236 642 200', label: [650, 236, 'start'] },
  { process: 'evaporation', d: 'M376 300C374 286 374 274 376 262', label: null },
  { process: 'transpiration', d: 'M532 244C534 224 536 204 536 182', label: [544, 202, 'start'] },
  { process: 'sublimation', d: 'M86 156C76 136 70 118 70 98', label: [18, 88, 'start'] },
  { process: 'accumulation', d: 'M176 100C170 118 162 132 152 146', label: [190, 124, 'start'] },
  { process: 'precipitation', d: 'M444 130C452 160 456 184 458 214', label: [436, 192, 'end'] },
  { process: 'melting', d: 'M190 214C204 230 214 244 226 258', label: [218, 230, 'start'] },
  { process: 'runoff', d: 'M404 298C420 298 440 299 458 301', label: [430, 289, 'middle'] },
  { process: 'infiltration', d: 'M530 324C530 338 530 348 530 362', label: [538, 352, 'start'] },
  { process: 'groundwater', d: 'M478 398C520 398 552 394 592 382', label: [486, 414, 'start'] },
  { process: 'melting', d: 'M708 300C700 312 694 320 686 330', label: null },
];

/** The fixed part of the scene: sky, land, sea, ice, underground layers and the process arrows. */
export function sceneBaseSvg() {
  const out = [];
  out.push('<rect class="wc-sky" x="0" y="0" width="800" height="330"/>');
  // Sun, top right, and its rays.
  out.push('<g class="wc-sun"><circle cx="742" cy="56" r="26"/>' + Array.from({ length: 12 }, (_, k) => {
    const a = (k * Math.PI) / 6, c = Math.cos(a), s = Math.sin(a);
    return `<path d="M${r1(742 + c * 33)} ${r1(56 + s * 33)}L${r1(742 + c * 43)} ${r1(56 + s * 43)}"/>`;
  }).join('') + '</g>');
  // Rock body under the land and the sea floor.
  const surface = 'M0 250L38 214L82 170L116 140L150 162L186 200L222 244L258 272L300 292L340 302L352 304L362 312L374 320L388 316L398 306L440 304L480 306L540 308L590 312L606 330L634 402L712 410L740 336L800 330';
  out.push(`<path class="wc-rock" d="${surface}L800 500L0 500Z"/>`);
  // Underground layers: shallow groundwater above a clay layer, deep groundwater below it.
  out.push('<path class="wc-aquifer" d="M0 316C120 320 260 334 400 340C480 343 560 344 612 344L630 394L0 394Z"/>');
  out.push('<path class="wc-watertable" d="M0 316C120 320 260 334 400 340C480 343 560 344 612 344"/>');
  out.push('<path class="wc-clay" d="M0 394L630 394L634 402L712 410L740 336L740 412L800 412L800 422L0 422Z"/>');
  out.push('<rect class="wc-deep" x="0" y="422" width="800" height="56"/>');
  out.push('<rect class="wc-bedrock" x="0" y="478" width="800" height="22"/>');
  // Topsoil along the land surface.
  out.push('<path class="wc-soil" d="M222 244L258 272L300 292L340 302L352 304L362 312L374 320L388 316L398 306L440 304L480 306L540 308L590 312L606 330L600 340L540 320L480 318L440 316L398 318L388 328L374 332L362 324L352 316L340 314L300 304L258 284L216 252Z"/>');
  // Sea, with the ice shelf floating at the polar end.
  out.push('<path class="wc-sea" d="M590 312L800 312L800 330L740 336L712 410L634 402L606 330Z"/>');
  out.push('<path class="wc-sea-line" d="M590 312H712"/>');
  // Lake and river (river from the glacier's snout, through the lake, to the coast).
  out.push('<path class="wc-lake" d="M352 304C356 314 366 322 376 322C388 322 394 312 398 306Z"/>');
  out.push('<path class="wc-river" d="M196 226C214 246 236 266 262 280C290 294 320 300 352 306M398 306C440 306 480 307 520 308C556 309 576 310 592 312"/>');
  // Mountain glacier and the polar ice sheet with an iceberg.
  out.push('<path class="wc-ice" d="M62 196L90 162L116 140L150 162L172 186L196 226C184 214 172 206 160 204C140 206 120 198 100 202C86 204 74 202 62 196Z"/>');
  out.push('<path class="wc-ice" d="M712 296L712 318L740 320L740 336L800 330L800 214C772 222 744 246 726 270C718 282 712 290 712 296Z"/>');
  out.push('<path class="wc-ice" d="M676 312L682 302L696 300L700 312L696 320L680 320Z"/>');
  // Trees.
  for (const [x, s] of [[504, 1], [530, 1.25], [560, 1.05]]) {
    out.push(`<g class="wc-tree"><path class="wc-trunk" d="M${x - 2.5} 308V${r1(308 - 26 * s)}H${x + 2.5}V308Z"/><circle cx="${x}" cy="${r1(308 - 30 * s)}" r="${r1(14 * s)}"/><circle cx="${x - 9 * s}" cy="${r1(308 - 22 * s)}" r="${r1(9 * s)}"/><circle cx="${x + 9 * s}" cy="${r1(308 - 22 * s)}" r="${r1(9 * s)}"/></g>`);
  }
  // Clouds: the snow cloud over the mountain and the main cloud.
  const cloud = (x, y, s) => `<g class="wc-cloud"><circle cx="${x - 22 * s}" cy="${y + 6 * s}" r="${16 * s}"/><circle cx="${x}" cy="${y - 4 * s}" r="${22 * s}"/><circle cx="${x + 24 * s}" cy="${y + 6 * s}" r="${15 * s}"/><rect x="${x - 38 * s}" y="${y + 4 * s}" width="${76 * s}" height="${16 * s}" rx="${8 * s}"/></g>`;
  out.push(cloud(190, 74, 0.8), cloud(402, 92, 1.25), cloud(612, 168, 0.7));
  out.push('<g class="wc-flakes">' + [[160, 112], [178, 124], [170, 140], [196, 108], [152, 128]].map(([x, y]) => `<path d="M${x - 3} ${y}h6M${x} ${y - 3}v6"/>`).join('') + '</g>');
  out.push('<g class="wc-rain">' + [[430, 124], [446, 132], [462, 122], [438, 150], [454, 156]].map(([x, y]) => `<path d="M${x} ${y}l-3 9"/>`).join('') + '</g>');
  // Process arrows and their names.
  out.push('<g class="wc-processes" aria-hidden="true">');
  for (const a of PROCESS_ARROWS) {
    const driver = PROCESSES[a.process].driver;
    out.push(`<path class="wc-parrow wc-${driver}" d="${a.d}"/>`);
    const end = a.d.split(/[A-Z]/).pop().trim().split(/[ ,]+/).map(Number);
    const prev = a.d.split(/[A-Z]/).pop().trim().split(/[ ,]+/).map(Number);
    const [ex, ey] = [end.at(-2), end.at(-1)], [px, py] = [prev.at(-4), prev.at(-3)];
    out.push(`<path class="wc-phead wc-${driver}" d="${arrowHead([[px, py], [px, py], [ex, ey]], 9)}"/>`);
    if (a.label) out.push(`<text class="wc-plabel" x="${a.label[0]}" y="${a.label[1]}" text-anchor="${a.label[2]}">${esc(PROCESSES[a.process].name)}</text>`);
  }
  out.push('<text class="wc-plabel" x="402" y="138" text-anchor="middle">Condensation</text>');
  out.push('</g>');
  // Labels for the places.
  out.push('<g class="wc-names">');
  for (const s of STOPS) {
    const a = ANCHORS[s.id];
    out.push(`<text class="wc-name" data-name="${s.id}" x="${a.lx}" y="${a.ly}" text-anchor="${a.anchor}">${esc(s.label)}</text>`);
    if (a.sub) out.push(`<text class="wc-sub" x="${a.lx}" y="${a.ly + 16}" text-anchor="${a.anchor}">${esc(a.sub)}</text>`);
  }
  out.push('</g>');
  return out.join('');
}

/**
 * The changing part of the scene: the trail so far, the ways out of the current place (arrows colored by their
 * driver, with their chances) and the droplet. `moving` = { from, to, t } draws the droplet part-way along a move.
 */
export function sceneDynamicSvg({ path, cond = DEFAULT_CONDITIONS, moving = null, showExits = true, trail = 6 }) {
  if (!path.length) return '';
  const out = [];
  const at = path.at(-1);
  const steps = path.slice(1).map((to, i) => [path[i], to]).slice(-trail);
  out.push('<g class="wc-trail">');
  steps.forEach(([from, to], i) => out.push(`<path d="${line(edgePoints(from, to, 18))}" style="opacity:${r1(0.35 + (0.65 * (i + 1)) / steps.length)}"/>`));
  out.push('</g>');
  if (showExits && !moving) {
    out.push('<g class="wc-exits">');
    for (const e of exits(at, cond)) {
      const pts = edgePoints(at, e.to), driver = driverOf(e);
      const [bx, by] = pts[Math.round(pts.length * 0.55)];
      const label = formatChance(e.chance);
      const w = 12 + label.length * 8.6;
      out.push(`<g class="wc-exit wc-${driver}" data-exit="${e.to}"><path class="wc-exit-line" d="${line(pts)}"/><path class="wc-exit-head" d="${arrowHead(pts)}"/>`
        + `<g class="wc-badge"><rect x="${r1(bx - w / 2)}" y="${r1(by - 11)}" width="${r1(w)}" height="22" rx="11"/><text x="${bx}" y="${r1(by + 5)}" text-anchor="middle">${label}</text></g></g>`);
    }
    out.push('</g>');
  }
  out.push('<g class="wc-here">');
  for (const s of STOPS) if (s.id === at && !moving) out.push(`<circle class="wc-ring" cx="${ANCHORS[s.id].x}" cy="${ANCHORS[s.id].y}" r="21"/>`);
  let x = ANCHORS[at].x, y = ANCHORS[at].y;
  if (moving) {
    const pts = edgePoints(moving.from, moving.to, 40);
    const k = Math.min(pts.length - 1, Math.max(0, Math.round(moving.t * (pts.length - 1))));
    [x, y] = pts[k];
  }
  out.push(`<path class="wc-drop" d="${DROPLET_PATH}" transform="translate(${r1(x)} ${r1(y)})"/>`);
  out.push('</g>');
  return out.join('');
}

/** A sentence describing where the droplet is and where it can go, for the scene's accessible name. */
export function describeScene(path, cond = DEFAULT_CONDITIONS) {
  const at = path.at(-1), options = exits(at, cond);
  const moves = path.length - 1;
  const head = `Water cycle diagram. The droplet is in ${placeName(at)}${moves ? ` after ${moves} move${moves === 1 ? '' : 's'} and about ${formatDuration(journeyYears(path))}` : ''}.`;
  if (!options.length) return `${head} It cannot move: ${stuckReason(at, cond)}`;
  return `${head} Ways out: ${options.map(e => `${PROCESSES[e.process].name.toLowerCase()} to ${placeName(e.to)} (${formatChance(e.chance)})`).join(', ')}.`;
}

// ---------- Where is Earth's water? markup ----------
export const UNIT_NAMES = { pct: 'Percent', km3: 'Cubic kilometers', ml: 'In a 1-liter bottle' };
/** A reservoir's amount in the chosen unit, as text. */
export function amountText(id, kind, unit) {
  const km3 = amount(id, kind);
  if (unit === 'km3') return `${grouped(km3)} km³`;
  if (unit === 'ml') return `${formatMl(mlPerLiter(id, kind))} mL`;
  return `${formatPct(kind === 'fresh' ? pctOfFresh(id) : pctOfAll(id))}%`;
}
/** "everything else" in the chosen unit; its percent is of the first (whole) bar. */
function restText(rest, levels, unit) {
  const share = (rest.km3 / levels[0].total) * 100;
  if (unit === 'km3') return `${grouped(rest.km3)} km³`;
  if (unit === 'ml') return `${formatMl(share * 10)} mL`;
  return `${formatPct(share)}%`;
}
/** A zoom factor in round words: 29, 81, "about 2,700", "about 430,000". */
export function zoomText(zoom) {
  if (zoom < 100) return fmt(zoom, 0);
  const step = 10 ** (Math.floor(Math.log10(zoom)) - 1);
  return `about ${grouped(Math.round(zoom / step) * step)}`;
}
/** The zoom bars as HTML (the server and the browser render the same markup). */
export function whereHtml(kind = 'all', unit = 'pct') {
  const levels = whereLevels(kind);
  const whole = kind === 'fresh' ? 'all of Earth’s fresh water' : 'all of Earth’s water';
  const out = [];
  levels.forEach((level, i) => {
    const title = i === 0
      ? `${kind === 'fresh' ? 'All fresh water' : 'All of Earth’s water'}${unit === 'ml' ? ' in a 1-liter bottle' : ''}`
      : `Zoom in on the last ${formatPct((level.total / levels[0].total) * 100)}%: ${zoomText(level.zoom)} times bigger`;
    out.push(`<div class="wc-level"><h4 class="wc-level-title">${esc(title)}</h4><div class="wc-bar" role="img" aria-label="${esc(`${title}: ${[...level.items.map(it => `${RESERVOIR[it.id].short} ${amountText(it.id, kind, unit)}`), ...(level.rest ? [`everything else ${restText(level.rest, levels, unit)}`] : [])].join(', ')}`)}">`);
    for (const it of level.items) out.push(`<span class="wc-seg wc-seg-${it.id}" style="flex-grow:${it.share.toFixed(6)}" title="${esc(`${RESERVOIR[it.id].name}: ${amountText(it.id, kind, unit)}`)}"></span>`);
    if (level.rest) out.push(`<span class="wc-seg wc-seg-rest" style="flex-grow:${level.rest.share.toFixed(6)}" title="Everything else: ${esc(restText(level.rest, levels, unit))}"></span>`);
    out.push('</div><ul class="wc-key">');
    for (const it of level.items) out.push(`<li><i class="wc-swatch wc-seg-${it.id}"></i><span>${esc(RESERVOIR[it.id].short)}</span> <b>${esc(amountText(it.id, kind, unit))}</b></li>`);
    if (level.rest) out.push(`<li><i class="wc-swatch wc-seg-rest"></i><span>Everything else</span> <b>${esc(restText(level.rest, levels, unit))}</b></li>`);
    out.push('</ul></div>');
    if (level.rest) out.push(`<svg class="wc-zoom" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true"><path d="M${(100 * (1 - level.rest.share)).toFixed(3)} 0L100 0L100 14L0 14Z"/></svg>`);
  });
  out.push(`<p class="wc-where-note">Each bar is ${whole} or a zoomed-in part of it. Pieces smaller than 1% of a bar are grouped as “everything else”, and the next bar zooms in on them.</p>`);
  return out.join('');
}

// ---------- Challenge ----------
// Choice questions and two "steer the droplet" tasks. Every answer is worked out from the model and checked by tests.
const TODAY = DEFAULT_CONDITIONS;
const plantsOut = exits('plants', TODAY)[0];
const longestChoice = ['ocean', 'icesheet', 'deep', 'lake'];
const longestAnswer = longestChoice.reduce((a, b) => (stayYears(a) >= stayYears(b) ? a : b));
const airVsRivers = RESERVOIR.atmosphere.km3 / RESERVOIR.rivers.km3;
const oceanPct = pctOfAll('oceans');
const toGroundwater = shortestPath('ocean', 'groundwater', TODAY);
const soilToOcean = fastestPath('soil', 'ocean', TODAY);
const sunOff = { ...TODAY, sun: false };

export const CHALLENGE = [
  {
    id: 'to-groundwater', kind: 'path',
    prompt: `Steer the droplet from the ocean into the groundwater in ${toGroundwater.length - 1} moves or fewer. Can you do it?`,
    task: { start: 'ocean', target: 'groundwater', maxSteps: toGroundwater.length - 1 },
    explain: `The quickest way down: ${toGroundwater.map(placeName).join(' → ')}. Evaporation lifts it, precipitation drops it on land, and infiltration lets it soak down. Rain on a lake works too, because lake water seeps into the ground.`,
  },
  {
    id: 'plants-to-air', kind: 'choice',
    prompt: 'Which process moves water from plants into the air?',
    choices: ['evaporation', 'transpiration', 'condensation', 'infiltration'].map(id => ({ value: id, label: PROCESSES[id].name })),
    answer: plantsOut.process,
    explain: 'Transpiration: water escapes as vapor through tiny holes in leaves. The sun’s energy powers it, and the pull also draws more water up from the roots.',
  },
  {
    id: 'longest', kind: 'choice',
    prompt: 'On average, which of these holds on to a droplet the longest?',
    choices: longestChoice.map(id => ({ value: id, label: STOP[id].name })),
    answer: longestAnswer,
    explain: `An ice sheet: about ${grouped(stayYears('icesheet'))} years in Antarctica. Deep groundwater holds water about ${grouped(stayYears('deep'))} years and the ocean about ${grouped(stayYears('ocean'))} years, while a lake keeps it only ${STOP.lake.range}.`,
  },
  {
    id: 'soil-to-ocean', kind: 'path',
    prompt: 'The droplet is in the soil. Get it to the ocean in less than 1 year of travel time.',
    task: { start: 'soil', target: 'ocean', maxSteps: 6, maxYears: 1 },
    explain: `The fastest route is ${soilToOcean.map(placeName).join(' → ')}, about ${formatDuration(journeyYears(soilToOcean))}. Soil → river → ocean takes about ${formatDuration(journeyYears(['soil', 'river', 'ocean']))}. Any trip through the groundwater or a lake takes many years.`,
  },
  {
    id: 'sun-off', kind: 'choice',
    prompt: 'Thought experiment: switch off the sun’s energy. A droplet is in the ocean. What happens to it?',
    choices: [
      { value: 'evaporates', label: 'It evaporates into the air as usual' },
      { value: 'stuck', label: 'It stays in the ocean: nothing can lift it into the air' },
      { value: 'groundwater', label: 'It sinks into the groundwater' },
      { value: 'rain', label: 'It falls as rain' },
    ],
    answer: exits('ocean', sunOff).length ? 'evaporates' : 'stuck',
    explain: 'Evaporation needs energy, and almost all of it comes from the sun. Without it, water that reaches the ocean stays there, and the cycle stops.',
  },
  {
    id: 'ocean-share', kind: 'choice',
    prompt: 'About what percent of all of Earth’s water is in the ocean?',
    choices: [50, 71, Number(formatPct(oceanPct)), 99.9].map(v => ({ value: v, label: `${v}%` })),
    answer: Number(formatPct(oceanPct)),
    explain: `About ${formatPct(oceanPct)}%, and it is salty. (71% is a different fact: how much of Earth’s surface the ocean covers.) Only about ${fmt(FRESH_PCT)}% of Earth’s water is fresh.`,
  },
  {
    id: 'air-vs-rivers', kind: 'choice',
    prompt: 'Which holds more water at any moment: the whole atmosphere, or all the rivers on Earth?',
    choices: [{ value: 'atmosphere', label: 'The atmosphere' }, { value: 'rivers', label: 'All the rivers' }, { value: 'same', label: 'About the same' }],
    answer: airVsRivers > 1.5 ? 'atmosphere' : airVsRivers < 1 / 1.5 ? 'rivers' : 'same',
    explain: `The atmosphere holds about ${grouped(RESERVOIR.atmosphere.km3)} km³ of water and all the rivers about ${grouped(RESERVOIR.rivers.km3)} km³, so the air holds about ${fmt(airVsRivers, 0)} times as much.`,
  },
  {
    id: 'gravity', kind: 'choice',
    prompt: 'What pulls rain down from the clouds and makes rivers flow downhill?',
    choices: [{ value: 'sun', label: 'The sun’s energy' }, { value: 'gravity', label: 'Gravity' }, { value: 'condensation', label: 'Condensation' }, { value: 'wind', label: 'Wind' }],
    answer: PROCESSES.precipitation.driver === PROCESSES.runoff.driver ? PROCESSES.runoff.driver : null,
    explain: 'Gravity. The sun’s energy lifts water up as vapor; gravity brings it back down as rain and snow and pulls it downhill in rivers and underground.',
  },
];

/** How a "steer the droplet" task is going for a path: playing, success or fail. */
export function taskResult(task, path) {
  const steps = path.length - 1, years = journeyYears(path);
  if (path.at(-1) === task.target && steps <= task.maxSteps && (task.maxYears === undefined || years < task.maxYears)) return { status: 'success', steps, years };
  if (steps >= task.maxSteps || (task.maxYears !== undefined && years >= task.maxYears)) return { status: 'fail', steps, years };
  return { status: 'playing', steps, years };
}
