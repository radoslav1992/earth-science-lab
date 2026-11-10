// The Rock Layers Lab model, in two linked parts.
// Part 1, relative dating: hand-built cross-sections, each written as its own history (the events in the
// order they happened). The evidence a student can see is worked out from that history, so the answer to
// "put the events in order" is always the section's own history, and every hint names the rule behind it.
// Part 2, radiometric dating: half-life maths in both directions for five parent → daughter pairs.
// Pure and deterministic: the server render, the browser and the tests all call these same functions.
//
// Sources (values are rounded classroom figures):
// - Half-lives: USGS, "Geologic Time: Radiometric Time Scale" (uranium-238 4.5 billion years, uranium-235
//   704 million, rubidium-87 48.8 billion, potassium-40 1.25 billion); carbon-14 5,730 years (the Cambridge
//   half-life). Uranium-238 uses the common 4.47 billion.
// - What each method dates and its rough useful range: the same USGS page and Earle, S. (2019) Physical
//   Geology, 2nd ed., BCcampus, section 8.4 (Table 8.2). Sources disagree on the limits, so they are shown
//   as "roughly".
// - Relative dating rules (superposition, original horizontality, cross-cutting relationships, inclusions,
//   unconformities): Earle ch. 8.2 and any introductory geology text.

// ---------- Part 2: radioactive decay ----------
export const EARTH_AGE_YEARS = 4.54e9;
export const SOLAR_SYSTEM_AGE_YEARS = 4.6e9; // oldest meteorites, rounded
// About one carbon atom in a trillion in a living thing is carbon-14, so a gram of carbon (5 × 10²² atoms)
// holds roughly 60 billion of them. Used to show why carbon-14 runs out.
export const C14_ATOMS_PER_GRAM = 6e10;

export const ISOTOPES = [
  {
    id: 'c14', parent: 'Carbon-14', daughter: 'Nitrogen-14', halfLife: 5730, unit: 'years', unitYears: 1,
    method: 'Radiocarbon dating',
    dates: 'Wood, charcoal, bone, shell and other remains of living things',
    range: [100, 50000],
    note: 'A living thing takes in carbon-14 until it dies; after that the carbon-14 decays and is not replaced. It dates things that were once alive, not rock.',
  },
  {
    id: 'k40', parent: 'Potassium-40', daughter: 'Argon-40', halfLife: 1.25e9, unit: 'million years', unitYears: 1e6,
    method: 'Potassium–argon dating',
    dates: 'Volcanic rock and ash, using minerals that hold potassium, such as feldspar and mica',
    range: [1e5, SOLAR_SYSTEM_AGE_YEARS],
    note: 'Argon is a gas that escapes from molten rock, so the clock starts at zero when lava or ash cools. In real rock only about 1 in 9 potassium-40 atoms decays to argon-40 (the rest become calcium-40); this model counts every decay as a daughter atom.',
  },
  {
    id: 'u238', parent: 'Uranium-238', daughter: 'Lead-206', halfLife: 4.47e9, unit: 'million years', unitYears: 1e6,
    method: 'Uranium–lead dating',
    dates: 'Zircon crystals in granite, volcanic ash and other igneous rocks',
    range: [1e6, SOLAR_SYSTEM_AGE_YEARS],
    note: 'Zircon takes in uranium but almost no lead when it grows, so nearly all of its lead came from decay.',
  },
  {
    id: 'u235', parent: 'Uranium-235', daughter: 'Lead-207', halfLife: 7.04e8, unit: 'million years', unitYears: 1e6,
    method: 'Uranium–lead dating',
    dates: 'Zircon crystals in granite, volcanic ash and other igneous rocks',
    range: [1e6, SOLAR_SYSTEM_AGE_YEARS],
    note: 'The same zircon holds both kinds of uranium, so the two uranium–lead clocks can check each other.',
  },
  {
    id: 'rb87', parent: 'Rubidium-87', daughter: 'Strontium-87', halfLife: 4.88e10, unit: 'million years', unitYears: 1e6,
    method: 'Rubidium–strontium dating',
    dates: 'Very old igneous and metamorphic rocks, Moon rocks and meteorites',
    range: [1e7, SOLAR_SYSTEM_AGE_YEARS],
    note: 'Its half-life is so long that very little has decayed even in the oldest rocks, so it suits old samples best.',
  },
];
export const ISOTOPE_IDS = ISOTOPES.map(i => i.id);
export const isotope = id => ISOTOPES.find(i => i.id === id);
export const DEFAULT_ISOTOPE = 'u235';
/** The decay lab shows up to this many half-lives. */
export const MAX_HALF_LIVES = 10;

const positive = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const nonNegative = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** How many half-lives fit in a time. NaN for a negative time or a half-life that isn't positive. */
export const halfLivesElapsed = (years, halfLife) => (nonNegative(years) && positive(halfLife) ? years / halfLife : NaN);
/** Fraction of the parent isotope left after a time: (1/2)^(t ÷ half-life). */
export const fractionLeft = (years, halfLife) => 0.5 ** halfLivesElapsed(years, halfLife);
/** Age from the fraction of parent left: t = half-life × log2(N0 ÷ N). The fraction must be above 0 and at most 1. */
export const ageFromFraction = (fraction, halfLife) => (positive(fraction) && fraction <= 1 && positive(halfLife) ? halfLife * Math.log2(1 / fraction) || 0 : NaN);
/** Daughter atoms per parent atom when a fraction of the parent is left (all daughters from decay). */
export const daughterPerParent = fraction => (positive(fraction) && fraction <= 1 ? (1 - fraction) / fraction : NaN);
/** Age from the daughter-to-parent ratio: t = half-life × log2(1 + D ÷ P). */
export const ageFromRatio = (ratio, halfLife) => (nonNegative(ratio) && positive(halfLife) ? halfLife * Math.log2(1 + ratio) : NaN);
/** Parent atoms left out of a starting number, rounded to whole atoms. */
export const atomsLeft = (fraction, total) => Math.round(fraction * total);

// ---------- Number formatting ----------
const thousands = n => n.toLocaleString('en-US');
const sig = (n, digits = 3) => Number(n.toPrecision(digits));
/** "5,730 years", "11,460 years", "704 million years", "1.25 billion years": four figures for years, three above a million. */
export function fmtYears(years) {
  if (!nonNegative(years)) return 'unknown';
  if (years < 1e6) return `${thousands(years < 1000 ? Math.round(years) : sig(years, 4))} year${Math.round(years) === 1 ? '' : 's'}`;
  if (years < 1e9) return `${thousands(sig(years / 1e6))} million years`;
  return `${thousands(sig(years / 1e9))} billion years`;
}
/** A number of million years for tables and answers: "1,408", "704", "62.5". */
export const fmtMyr = years => { const m = years / 1e6; return thousands(m >= 100 ? Math.round(m) : Number(m.toFixed(1))); };
/** A percentage: up to two decimals from 1% up, three significant figures below ("100", "93.75", "12.5", "0.0977"). */
export const fmtPercent = p => (p >= 99.995 ? '100' : String(p >= 1 ? Number(p.toFixed(2)) : sig(p)));
/** A count of half-lives: "2", "0.32", "8.73". */
export const fmtHalfLives = n => String(Number(n.toFixed(2)));

/** Whether an isotope pair can date a sample of a given age, and why. */
export function verdict(iso, years) {
  const [min, max] = iso.range;
  const left = fmtPercent(100 * fractionLeft(years, iso.halfLife));
  if (iso.id !== 'c14' && years > SOLAR_SYSTEM_AGE_YEARS) {
    return { status: 'beyond', text: `Nothing in the solar system is this old: the oldest meteorites are about ${fmtYears(SOLAR_SYSTEM_AGE_YEARS)} old, and Earth is about ${fmtYears(EARTH_AGE_YEARS)} old.` };
  }
  if (years > max) {
    return { status: 'old', text: `Too old for this method. Only ${left}% of the ${iso.parent.toLowerCase()} is left, too little to measure reliably. It works up to roughly ${fmtYears(max)}.` };
  }
  if (years < min) {
    return { status: 'young', text: `Too young for this method. So little ${iso.daughter.toLowerCase()} has formed that it is hard to measure. It works from roughly ${fmtYears(min)}.` };
  }
  return { status: 'ok', text: `A good age for this method, which works from roughly ${fmtYears(min)} to ${fmtYears(max)}.` };
}

// ---------- Part 1: rocks and the rules of relative dating ----------
export const ROCKS = {
  sandstone: { name: 'Sandstone', phrase: 'sandstone', igneous: false },
  shale: { name: 'Shale', phrase: 'shale', igneous: false },
  limestone: { name: 'Limestone', phrase: 'limestone', igneous: false },
  conglomerate: { name: 'Conglomerate', phrase: 'conglomerate', igneous: false },
  tuff: { name: 'Volcanic ash bed', phrase: 'ash bed', igneous: true },
  basalt: { name: 'Basalt', phrase: 'basalt', igneous: true },
  granite: { name: 'Granite', phrase: 'granite', igneous: true },
};

export const RULES = {
  superposition: { name: 'Superposition', text: 'In layers that have not been turned over, each layer is younger than the one below it.' },
  horizontality: { name: 'Original horizontality', text: 'Sediment settles in flat, level layers. Layers that are tilted or folded were moved after they formed.' },
  crosscut: { name: 'Cross-cutting relationships', text: 'A fault or an igneous intrusion is younger than the rocks it cuts through.' },
  inclusions: { name: 'Inclusions', text: 'Pieces of one rock inside another rock are older than the rock that holds them.' },
  unconformity: { name: 'Unconformities', text: 'A buried erosion surface marks a gap in time. The rocks below it were worn down before the rocks above it were laid down.' },
};
export const RULE_IDS = Object.keys(RULES);

// Each section lists its events from oldest to youngest. Geometry values are in drawing units
// (see rock-layers-view.mjs): `thick` is a layer's thickness, `level` the height an erosion surface cuts
// to, `x` where a fault or dike meets the top of the rock, `dip` its slope in degrees (positive leans down
// to the right) and `slip` how far the block above a fault slides down it. `sample` is a lab measurement
// of an igneous rock: the isotope pair and the percentage of the parent isotope still left.
// Labels are letters in no particular order, so the letters give nothing away.
export const SECTIONS = [
  {
    id: 'canyon', name: 'Canyon wall', level: 1, rules: ['superposition'], ground: 360,
    events: [
      { id: 'M', kind: 'deposit', rock: 'limestone', thick: 90 },
      { id: 'K', kind: 'deposit', rock: 'tuff', thick: 32, sample: { iso: 'u235', left: 25 } },
      { id: 'T', kind: 'deposit', rock: 'shale', thick: 100 },
      { id: 'R', kind: 'deposit', rock: 'tuff', thick: 32, sample: { iso: 'u235', left: 50 } },
      { id: 'B', kind: 'deposit', rock: 'sandstone', thick: 110 },
    ],
    bracket: { target: 'T', older: 'K', younger: 'R' },
  },
  {
    id: 'fault', name: 'Fault and dike', level: 2, rules: ['superposition', 'crosscut'], ground: 335,
    events: [
      { id: 'H', kind: 'deposit', rock: 'sandstone', thick: 90 },
      { id: 'C', kind: 'deposit', rock: 'shale', thick: 85 },
      { id: 'W', kind: 'deposit', rock: 'tuff', thick: 32, sample: { iso: 'u238', left: 95 } },
      { id: 'N', kind: 'deposit', rock: 'limestone', thick: 90 },
      { id: 'J', kind: 'deposit', rock: 'sandstone', thick: 110 },
      { id: 'F', kind: 'fault', x: 430, dip: 62, slip: 55, labelAt: 0.72 },
      { id: 'D', kind: 'dike', rock: 'basalt', x: 560, dip: -70, width: 26, sample: { iso: 'k40', left: 90 } },
    ],
    bracket: { target: 'F', older: 'W', younger: 'D' },
  },
  {
    id: 'tilted', name: 'Tilted layers', level: 3, rules: ['superposition', 'horizontality', 'unconformity', 'inclusions'], ground: 355,
    events: [
      { id: 'S', kind: 'deposit', rock: 'shale', thick: 120 },
      { id: 'L', kind: 'deposit', rock: 'basalt', thick: 70, sample: { iso: 'k40', left: 80 } },
      { id: 'G', kind: 'deposit', rock: 'limestone', thick: 150 },
      { id: 'tilt', kind: 'tilt', deg: 20 },
      { id: 'U', kind: 'erode', level: 190 },
      { id: 'V', kind: 'deposit', rock: 'conglomerate', thick: 62, inclusions: ['G', 'L'] },
      { id: 'Y', kind: 'deposit', rock: 'tuff', thick: 32, sample: { iso: 'u235', left: 85 } },
      { id: 'Z', kind: 'deposit', rock: 'sandstone', thick: 80 },
    ],
    bracket: { target: 'U', older: 'L', younger: 'Y' },
  },
  {
    id: 'granite', name: 'Granite and pebbles', level: 4, rules: ['superposition', 'crosscut', 'inclusions', 'unconformity'], ground: 330,
    events: [
      { id: 'E', kind: 'deposit', rock: 'shale', thick: 130 },
      { id: 'O', kind: 'deposit', rock: 'sandstone', thick: 120 },
      { id: 'X', kind: 'pluton', rock: 'granite', x: 290, halfWidth: 200, top: 228, inclusions: ['O', 'E'], sample: { iso: 'u238', left: 80 } },
      { id: 'U', kind: 'erode', level: 185 },
      { id: 'I', kind: 'deposit', rock: 'conglomerate', thick: 62, inclusions: ['X'] },
      { id: 'A', kind: 'deposit', rock: 'limestone', thick: 90 },
      { id: 'D', kind: 'dike', rock: 'basalt', x: 606, dip: 84, width: 24, sample: { iso: 'k40', left: 75 } },
    ],
    bracket: { target: 'I', older: 'X', younger: 'D' },
  },
  {
    id: 'story', name: 'The whole story', level: 5, rules: ['superposition', 'horizontality', 'unconformity', 'inclusions', 'crosscut'], ground: 340,
    events: [
      { id: 'R', kind: 'deposit', rock: 'sandstone', thick: 120 },
      { id: 'A', kind: 'deposit', rock: 'tuff', thick: 40, sample: { iso: 'u238', left: 90 } },
      { id: 'C', kind: 'deposit', rock: 'limestone', thick: 180 },
      { id: 'tilt', kind: 'tilt', deg: -18 },
      { id: 'U', kind: 'erode', level: 200 },
      { id: 'H', kind: 'deposit', rock: 'conglomerate', thick: 55, inclusions: ['C'] },
      { id: 'K', kind: 'deposit', rock: 'tuff', thick: 32, sample: { iso: 'u238', left: 95 } },
      { id: 'B', kind: 'deposit', rock: 'sandstone', thick: 106 },
      { id: 'F', kind: 'fault', x: 255, dip: -60, slip: 50, labelAt: 0.62 },
      { id: 'D', kind: 'dike', rock: 'basalt', x: 120, dip: 72, width: 24, sample: { iso: 'k40', left: 92 } },
    ],
    bracket: { target: 'F', older: 'K', younger: 'D' },
  },
];
export const SECTION_IDS = SECTIONS.map(s => s.id);
export const sectionById = id => SECTIONS.find(s => s.id === id);
export const DEFAULT_SECTION = SECTIONS[0].id;

/** The small section used for the worked example on the page; not one of the puzzles. */
export const EXAMPLE_SECTION = {
  id: 'example', name: 'Worked example', level: 0, rules: ['superposition', 'crosscut', 'unconformity', 'inclusions'], ground: 268,
  events: [
    { id: 'J', kind: 'deposit', rock: 'shale', thick: 110 },
    { id: 'P', kind: 'deposit', rock: 'sandstone', thick: 110 },
    { id: 'D', kind: 'dike', rock: 'basalt', x: 400, dip: 80, width: 28 },
    { id: 'U', kind: 'erode', level: 196 },
    { id: 'N', kind: 'deposit', rock: 'conglomerate', thick: 72, inclusions: ['D'] },
  ],
};

// ---------- Names ----------
const cap = text => text[0].toUpperCase() + text.slice(1);
export const eventById = (section, id) => section.events.find(ev => ev.id === id);
/** The letter drawn on the cross-section; tilting has nothing to label, so it gets an angle sign. */
export const eventLabel = ev => (ev.kind === 'tilt' ? '∠' : ev.id);
/** The name on an event card: "Limestone", "Basalt lava flow", "Fault", "Basalt dike", "Erosion surface". */
export function eventName(ev) {
  if (ev.kind === 'deposit') return ev.rock === 'basalt' ? 'Basalt lava flow' : ROCKS[ev.rock].name;
  if (ev.kind === 'fault') return 'Fault';
  if (ev.kind === 'dike') return `${ROCKS[ev.rock].name} dike`;
  if (ev.kind === 'pluton') return `${ROCKS[ev.rock].name} intrusion`;
  if (ev.kind === 'erode') return 'Erosion surface';
  return 'Tilting of the layers';
}
/** How an event is named inside a sentence: "limestone M", "lava flow L", "fault F", "the tilting". */
export function eventPhrase(ev) {
  if (ev.kind === 'deposit') return `${ev.rock === 'basalt' ? 'lava flow' : ROCKS[ev.rock].phrase} ${ev.id}`;
  if (ev.kind === 'fault') return `fault ${ev.id}`;
  if (ev.kind === 'dike') return `dike ${ev.id}`;
  if (ev.kind === 'pluton') return `${ROCKS[ev.rock].phrase} ${ev.id}`;
  if (ev.kind === 'erode') return `erosion surface ${ev.id}`;
  return 'the tilting';
}
/** What happened, as one plain sentence for the finished timeline. */
export function eventStory(ev) {
  const p = cap(eventPhrase(ev));
  if (ev.kind === 'deposit') return ev.rock === 'basalt' ? `${p} poured out and cooled.` : ev.rock === 'tuff' ? `${p} settled from a volcanic eruption.` : `${p} was laid down.`;
  if (ev.kind === 'fault') return `${p} broke the rock and one side slid down.`;
  if (ev.kind === 'dike') return `Magma pushed up through a crack and cooled as ${eventPhrase(ev)}.`;
  if (ev.kind === 'pluton') return `Magma rose into the layers and cooled slowly as ${eventPhrase(ev)}.`;
  if (ev.kind === 'erode') return `The land was worn down to ${eventPhrase(ev)}.`;
  return 'The layers were tilted.';
}

// ---------- Evidence ----------
// What you can see where two events that follow each other meet, and what it tells you.
// Keyed by the kinds of the older and the younger event. A history with a pair that is not listed here
// would leave the order open, so it is rejected when the module loads.
const EVIDENCE = {
  'deposit>deposit': (a, b) => ['superposition', `${cap(eventPhrase(b))} lies directly on top of ${eventPhrase(a)}`, `${eventPhrase(a)} was there first`],
  'deposit>tilt': a => ['horizontality', `${cap(eventPhrase(a))} is tilted`, 'it was laid down flat first and tilted afterwards'],
  'deposit>fault': (a, b) => ['crosscut', `${cap(eventPhrase(b))} cuts through ${eventPhrase(a)} and offsets it`, `the fault moved after ${eventPhrase(a)} formed`],
  'deposit>dike': (a, b) => ['crosscut', `${cap(eventPhrase(b))} cuts through ${eventPhrase(a)}`, `the dike is younger than ${eventPhrase(a)}`],
  'deposit>pluton': (a, b) => ['crosscut', `${cap(eventPhrase(b))} pushes up into ${eventPhrase(a)} and cuts across it`, `${eventPhrase(b)} is younger than ${eventPhrase(a)}`],
  'tilt>erode': (a, b) => ['unconformity', `${cap(eventPhrase(b))} is level, but it cuts across the tilted layers below it`, 'the layers were tilted before they were worn down'],
  'dike>erode': (a, b) => ['unconformity', `${cap(eventPhrase(b))} cuts off the top of ${eventPhrase(a)}`, `${eventPhrase(a)} was there before the erosion`],
  'pluton>erode': (a, b) => ['unconformity', `${cap(eventPhrase(b))} cuts off the top of ${eventPhrase(a)}`, `${eventPhrase(a)} was there before the erosion`],
  'erode>deposit': (a, b) => ['unconformity', `${cap(eventPhrase(b))} lies on top of ${eventPhrase(a)}`, `${eventPhrase(b)} was laid down after the erosion`],
  'fault>dike': (a, b) => ['crosscut', `${cap(eventPhrase(b))} crosses ${eventPhrase(a)} and is not offset by it`, 'the dike came after the fault moved'],
};

/**
 * The evidence in a section, as { older, younger, rule, see, so } entries: one for each pair of events
 * that follow each other, plus one for each rock that holds pieces of an older rock.
 */
export function constraints(section) {
  const list = [];
  section.events.forEach((b, i) => {
    if (i > 0) {
      const a = section.events[i - 1];
      const make = EVIDENCE[`${a.kind}>${b.kind}`];
      if (!make) throw new Error(`${section.id}: nothing shows that ${eventPhrase(a)} came before ${eventPhrase(b)}`);
      const [rule, see, so] = make(a, b);
      list.push({ older: a.id, younger: b.id, rule, see, so });
    }
    for (const id of b.inclusions ?? []) {
      const a = eventById(section, id);
      if (!a || section.events.indexOf(a) >= i) throw new Error(`${section.id}: ${b.id} cannot hold pieces of ${id}`);
      list.push({ older: a.id, younger: b.id, rule: 'inclusions', see: `${cap(eventPhrase(b))} holds pieces of ${eventPhrase(a)}`, so: `${eventPhrase(a)} is older, because the pieces had to exist first` });
    }
  });
  return list;
}
for (const section of [...SECTIONS, EXAMPLE_SECTION]) constraints(section);

/** The section's own history, oldest first: the answer to "put the events in order". */
export const trueOrder = section => section.events.map(ev => ev.id);
/** The events as a student first sees them: a fixed shuffle that never matches the answer. */
export function shuffledEvents(section) {
  const ids = trueOrder(section);
  const n = ids.length;
  // Step through the list by a stride that shares no factor with its length, starting in the middle.
  const stride = [7, 5, 3, 2].find(s => n % s !== 0 && s < n) ?? 1;
  const out = ids.map((_, i) => ids[(Math.floor(n / 2) + i * stride) % n]);
  return out.every((id, i) => id === ids[i]) ? out.reverse() : out;
}

/**
 * Checks an order of event ids (oldest first) against the evidence.
 * Returns { complete, ok, broken, first, right }: `broken` lists every piece of evidence the order goes
 * against, `first` is the earliest of them in the section's history, and `right` counts events in the
 * correct place.
 */
export function checkOrder(section, order) {
  const ids = trueOrder(section);
  const complete = Array.isArray(order) && order.length === ids.length && new Set(order).size === ids.length && order.every(id => ids.includes(id));
  if (!complete) return { complete: false, ok: false, broken: [], first: null, right: 0 };
  const at = Object.fromEntries(order.map((id, i) => [id, i]));
  const broken = constraints(section).filter(c => at[c.older] > at[c.younger]);
  return { complete: true, ok: broken.length === 0, broken, first: broken[0] ?? null, right: order.filter((id, i) => id === ids[i]).length };
}
/** A full sentence for one piece of evidence: "Dike D cuts through sandstone J, so the dike is younger than sandstone J." */
export const evidenceSentence = c => `${c.see}, so ${c.so}.`;

// ---------- Linking the two parts: dated igneous rocks bracket the rest ----------
/** The igneous rocks in a section that have a lab measurement. */
export const datedEvents = section => section.events.filter(ev => ev.sample);
/** Age in years of a dated rock, from its measurement. */
export function sampleAge(section, id) {
  const ev = eventById(section, id);
  return ev?.sample ? ageFromFraction(ev.sample.left / 100, isotope(ev.sample.iso).halfLife) : NaN;
}
/** The measurement as a lab would report it. */
export function sampleText(section, id) {
  const ev = eventById(section, id);
  const iso = isotope(ev.sample.iso);
  const mineral = iso.id === 'k40' ? 'Potassium–argon' : 'Zircon crystals, uranium–lead';
  return `${mineral}: ${fmtPercent(ev.sample.left)}% of the ${iso.parent.toLowerCase()} is left (half-life ${fmtYears(iso.halfLife)}).`;
}
/** True when a typed age (million years) is within 2% (or 1 million years) of the sample's age. */
export function ageMatches(section, id, millionYears) {
  const truth = sampleAge(section, id) / 1e6;
  return typeof millionYears === 'number' && Number.isFinite(millionYears) && Number.isFinite(truth) && Math.abs(millionYears - truth) <= Math.max(1, truth * 0.02);
}

export const BRACKET_CHOICES = ['between', 'older', 'younger', 'unknown'];
/** The order the choices are shown in: it changes from section to section, so the right one is not always first. */
export const bracketOrder = section => BRACKET_CHOICES.map((_, i) => BRACKET_CHOICES[(i + section.level * 3) % BRACKET_CHOICES.length]);
/** The question that ties a section to the decay lab: two dated rocks bracket the age of something else. */
export function bracketQuestion(section) {
  const { target, older, younger } = section.bracket;
  const [t, o, y] = [target, older, younger].map(id => eventById(section, id));
  const oldAge = sampleAge(section, older), youngAge = sampleAge(section, younger);
  const prompt = t.kind === 'fault' ? `When did ${eventPhrase(t)} move?` : t.kind === 'erode' ? `When was ${eventPhrase(t)} worn down?` : `When was ${eventPhrase(t)} laid down?`;
  return {
    target, older, younger, prompt, answer: 'between',
    choices: {
      between: `Between ${fmtMyr(youngAge)} and ${fmtMyr(oldAge)} million years ago`,
      older: `More than ${fmtMyr(oldAge)} million years ago`,
      younger: `Less than ${fmtMyr(youngAge)} million years ago`,
      unknown: 'There is no way to tell from these rocks',
    },
    explain: `In the order of events, ${eventPhrase(t)} comes after ${eventPhrase(o)} (${fmtMyr(oldAge)} million years old) and before ${eventPhrase(y)} (${fmtMyr(youngAge)} million years old). So it happened between ${fmtMyr(youngAge)} and ${fmtMyr(oldAge)} million years ago. The two dated rocks bracket its age.`,
  };
}
