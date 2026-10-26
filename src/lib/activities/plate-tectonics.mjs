// The Plate Tectonics Explorer's classroom activity, in the same shape as the entries in ../activities.mjs.
// Every table cell comes from the case facts in plates.mjs, and each `checks` entry pairs a number printed
// in an answer with the value the model computes (tests/plates.test.mjs).
import * as p from '../plates.mjs';

// NGSS performance expectations referenced below, paraphrased.
export const standards = {
  'MS-ESS2-3': 'Analyze and interpret data on the distribution of fossils and rocks, continental shapes, and seafloor structures to provide evidence of the past plate motions.',
  'HS-ESS2-1': 'Develop a model to illustrate how Earth’s internal and surface processes operate at different spatial and temporal scales to form continental and ocean-floor features.',
};

// The six boundaries students compare, in worksheet order.
export const ROWS = ['divergent-oo', 'divergent-cc', 'convergent-oc', 'convergent-oo', 'convergent-cc', 'transform-cc'];
const rowName = key => `${p.TYPE_NAMES[p.CASES[key].type]}: ${p.PLATE_NAMES[p.CASES[key].plates].toLowerCase()}`;
const n = v => p.fmt(v);

// Numbers used in the answers, all computed by the model.
const end = p.TIME_RANGE[1];
const exampleSpeed = 5;
const exampleKm = p.distanceKm(exampleSpeed, end);
const mar = { rate: 2.5, time: 10 };
const marKmPerMyr = p.kmPerMyr(mar.rate), marKm = p.distanceKm(mar.rate, mar.time);
const ridge = { full: 6, km: 300 };
const ridgeHalf = p.halfRate(ridge.full), ridgeKmPerMyr = p.kmPerMyr(ridgeHalf), ridgeAge = p.seafloorAgeMyr(ridge.km, ridgeHalf);

export const activity = {
  tool: 'plate-tectonics',
  toolName: 'Plate Tectonics Explorer',
  title: 'Plate Boundaries Activity',
  grade: 'Grades 6–10',
  minutes: 15,
  standards: ['MS-ESS2-3', 'HS-ESS2-1'],
  goal: 'Compare plate boundaries in a model, using landforms, earthquake depths and volcanoes as evidence of how plates move.',
  steps: [
    'Open the Plate Tectonics Explorer with Show earthquakes and Show volcanoes ticked.',
    `Choose each boundary in the table (type, then plates) and drag the time slider to ${end} million years.`,
    'Watch how the plates move. Record the main landforms, the deepest earthquakes (shallow, intermediate or deep, from the color key) and whether volcanoes form.',
    'Answer the questions. Check your math with the calculator, then try Challenge mode.',
  ],
  rowHeader: 'Boundary',
  record: ['Main landforms', 'Deepest earthquakes', 'Volcanoes?'],
  rows: ROWS.map(key => {
    const c = p.CASES[key];
    return [rowName(key), { 'Main landforms': c.landform, 'Deepest earthquakes': p.DEPTH_NAMES[c.quakeDepth], 'Volcanoes?': c.volcanoes ? 'Yes' : 'No' }];
  }),
  extra: `Pick any speed. Speed: ____ cm per year. In ${end} million years the plates move ____ km.`,
  extraAnswer: {
    a: `Answers vary: distance = speed × ${end} × 10. For example, ${n(exampleSpeed)} cm per year gives ${n(exampleSpeed)} × ${end} × 10 = ${n(exampleKm)} km, as the explorer shows.`,
    checks: [[String(end), end], [n(exampleSpeed), exampleSpeed], [n(exampleKm), exampleKm]],
  },
  keyNote: 'Answers match the explorer’s Evidence panel; accept any landform it lists. Earthquake depths: shallow is less than 70 km, intermediate 70–300 km, deep 300–700 km.',
  questions: [
    {
      q: 'Which two boundaries had the deepest earthquakes? Why can earthquakes there be so deep?',
      lines: 2,
      a: `Ocean–continent and ocean–ocean convergent boundaries (subduction zones). The sinking slab stays cold enough for rock in it to break, so earthquakes follow it down to about ${p.MAX_QUAKE_DEPTH_KM} km.`,
      checks: [[String(p.MAX_QUAKE_DEPTH_KM), p.MAX_QUAKE_DEPTH_KM]],
    },
    {
      q: 'Near a coast, earthquakes get deeper toward the east, under a line of volcanic mountains. What boundary is this, and which way does the slab sink?',
      lines: 2,
      a: 'An ocean–continent convergent boundary (a subduction zone), like the Andes or the Cascades. The ocean plate sinks toward the east, under the continent, and the volcanoes stand above the slab.',
    },
    {
      q: 'Why do volcanoes form at ridges and subduction zones, but not at transform faults like the San Andreas?',
      lines: 2,
      a: 'At a ridge, rising mantle rock partly melts as the pressure drops; at a subduction zone, water from the slab helps the mantle above it melt. At a transform fault the plates only slide past, so nothing rises or sinks and no magma forms.',
    },
    {
      q: `Suppose the Mid-Atlantic Ridge spreads ${n(mar.rate)} cm per year. How far apart do its plates move in ${n(mar.time)} million years? (1 cm per year = 10 km per million years.)`,
      lines: 2,
      a: `${n(mar.rate)} cm per year = ${n(marKmPerMyr)} km per million years, so in ${n(mar.time)} million years the plates move ${n(marKmPerMyr)} × ${n(mar.time)} = ${n(marKm)} km apart.`,
      checks: [[n(mar.rate), mar.rate], [n(marKmPerMyr), marKmPerMyr], [n(mar.time), mar.time], [n(marKm), marKm]],
    },
    {
      q: `A ridge spreads ${n(ridge.full)} cm per year in total (${n(ridgeHalf)} cm per year each way). How old is the seafloor ${n(ridge.km)} km from it?`,
      lines: 2,
      a: `Each plate moves ${n(ridgeHalf)} cm per year = ${n(ridgeKmPerMyr)} km per million years. Age = distance ÷ speed = ${n(ridge.km)} ÷ ${n(ridgeKmPerMyr)} = ${n(ridgeAge)} million years.`,
      checks: [[n(ridgeHalf), ridgeHalf], [n(ridgeKmPerMyr), ridgeKmPerMyr], [n(ridge.km), ridge.km], [n(ridgeAge), ridgeAge]],
    },
    {
      q: 'A classmate says, “The plates float on a sea of liquid magma.” Correct this statement.',
      lines: 2,
      a: 'The mantle is almost all solid rock, hot enough to flow very slowly, a few centimeters a year. Magma forms only where rock partly melts, such as under ridges and above sinking slabs.',
    },
  ],
};
