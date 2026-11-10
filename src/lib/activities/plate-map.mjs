// The Plate Boundaries Map's classroom activity, in the same shape as the entries in ../activities.mjs.
// Every table cell and every number in the answers is read from the map's own data in plate-map.mjs
// (tests/plate-map.test.mjs fails if a printed number drifts or goes unchecked).
import * as m from '../plate-map.mjs';

// The five places on the worksheet: the region to zoom to, and the boundary lines the row is about.
export const ROWS = [
  { label: 'Mid-Atlantic Ridge', region: 'atlantic', boundaries: ['mar-north', 'mar-central', 'mar-south'] },
  { label: 'East African Rift', region: 'africa', boundaries: ['ear-east', 'ear-west', 'ear-malawi'] },
  { label: 'Himalaya', region: 'himalaya', boundaries: ['himalaya'] },
  { label: 'Andes (Peru–Chile Trench)', region: 'andes', boundaries: ['peru-chile'] },
  { label: 'San Andreas Fault', region: 'california', boundaries: ['san-andreas'] },
];
const short = id => m.plateName(id).replace(/ Plate$/, '');
const quakesOn = ids => m.QUAKES_NEAR.filter(q => ids.includes(q.boundary));
const volcanoesOn = ids => m.VOLCANOES_NEAR.filter(v => ids.includes(v.boundary) && !v.hotspot);
/** One table row, read from the map's data. */
export function mapRow(row) {
  const lines = row.boundaries.map(m.boundaryById);
  const plates = [...new Set(lines.flatMap(b => b.plates))];
  const largest = quakesOn(row.boundaries).sort((a, b) => b.magnitude - a.magnitude)[0];
  return {
    'Boundary type': m.TYPE_LABELS[m.boundaryType(lines[0])],
    'Plates that meet': plates.map(short).join(', '),
    'Largest earthquake example': `${largest.name}, ${largest.year} (M${largest.magnitude.toFixed(1)})`,
    'Volcanoes along it?': volcanoesOn(row.boundaries).length ? 'Yes' : 'No',
  };
}

// Numbers used in the answers, all from the map's data.
const e = m.evidence();
const round10 = km => Math.round(km / 10) * 10;
const n = value => value.toLocaleString('en-US');
const noVolcanoes = ROWS.filter(row => volcanoesOn(row.boundaries).length === 0);
const ring = m.regionById('pacific').boundaries.map(m.boundaryById);
const far = name => m.VOLCANOES_NEAR.find(v => v.name === name);
const kilauea = far('Kīlauea'), yellowstone = far('Yellowstone');
const andes = volcanoesOn(['peru-chile']).map(v => v.km);
const andesNear = round10(Math.min(...andes)), andesFar = round10(Math.max(...andes));

export const activity = {
  tool: 'plate-map',
  toolName: 'Plate Boundaries Map',
  title: 'Plate Boundaries Map Activity',
  grade: 'Grades 6–10',
  minutes: 15,
  standards: ['MS-ESS2-3', 'MS-ESS3-2'],
  goal: 'Use a world map of plate boundaries, earthquakes and volcanoes to find the pattern that connects them, and explain it with how the plates move at each type of boundary.',
  steps: [
    'Open the Plate Boundaries Map. Switch on Earthquakes and Volcanoes and look at the whole world.',
    'Zoom to each place in the table. Its boundary is highlighted. Tap the line to find its type and the plates that meet there.',
    'Tap the earthquake dots along the line to find the largest one, and see whether any volcano triangles follow the line.',
    'Answer the questions. Then try Challenge mode.',
  ],
  rowHeader: 'Zoom to',
  record: ['Boundary type', 'Plates that meet', 'Largest earthquake example', 'Volcanoes along it?'],
  rows: ROWS.map(row => [row.label, mapRow(row)]),
  extra: 'Tap Kīlauea (Hawaii). It is about ________ km from the nearest plate boundary on this map.',
  extraAnswer: {
    a: `About ${n(round10(kilauea.km))} km. Kīlauea is a hotspot volcano in the middle of the Pacific Plate.`,
    checks: [[n(round10(kilauea.km)), kilauea.km]],
  },
  keyNote: 'Answers come from the map’s own data. The examples are well-known earthquakes and volcanoes, not a full catalog, and the boundaries are simplified, so distances are rough. For the East African Rift, accept any two of the three plates.',
  questions: [
    {
      q: 'Look at the whole world with earthquakes and volcanoes switched on. Describe the pattern you see.',
      lines: 2,
      a: `They are not scattered evenly: they form narrow belts along the plate boundaries. On this map ${e.quakes.near === e.quakes.total ? `all ${e.quakes.total}` : `${e.quakes.near} of the ${e.quakes.total}`} earthquake examples lie within ${m.QUAKE_NEAR_KM} km of a boundary, and ${e.volcanoes.near} of the ${e.volcanoes.total} volcano examples lie within ${m.VOLCANO_NEAR_KM} km of one. The plates are rigid, so most of the action is at their edges.`,
      checks: [[String(e.quakes.total), e.quakes.total], [String(e.quakes.near), e.quakes.near], [String(m.QUAKE_NEAR_KM), m.QUAKE_NEAR_KM], [String(e.volcanoes.near), e.volcanoes.near], [String(e.volcanoes.total), e.volcanoes.total], [String(m.VOLCANO_NEAR_KM), m.VOLCANO_NEAR_KM]],
    },
    {
      q: 'Which two places in your table have earthquakes but no volcanoes? Explain why for each.',
      lines: 3,
      a: `The ${noVolcanoes.map(row => row.label).join(' and the ')}. At the Himalaya two continents collide: neither sinks far into the mantle, so little rock melts. At the San Andreas Fault the plates only slide past each other, so nothing sinks or rises and no magma forms. Volcanoes need a sinking ocean plate or plates pulling apart.`,
    },
    {
      q: 'Zoom to the Ring of Fire. Name three trenches around the Pacific Ocean. What type of boundary are they all?',
      lines: 2,
      a: `Any three of: ${ring.map(b => b.name.replace(/ \(.*\)$/, '')).filter((name, i, all) => all.indexOf(name) === i).join('; ')}. They are all ${[...new Set(ring.map(b => m.boundaryType(b)))].join(' and ')} boundaries, where an ocean plate sinks into the mantle.`,
    },
    {
      q: 'Zoom to the Andes and tap the volcanoes. About how far are they from the trench? Why are they not at the trench itself?',
      lines: 2,
      a: `About ${andesNear} to ${andesFar} km from the trench line on this map. The sinking plate has to reach about 100 km deep before water from it makes the mantle above melt, and by then it is well inland.`,
      checks: [[String(andesNear), Math.min(...andes)], [String(andesFar), Math.max(...andes)], ['100', 100]],
      tolerance: 5,
    },
    {
      q: 'Yellowstone and Kīlauea are volcanoes far from any plate boundary. What explains them?',
      lines: 2,
      a: `They are hotspot volcanoes. A plume of hot rock rises from deep in the mantle and melts through the plate above it. Yellowstone is about ${n(round10(yellowstone.km))} km from the nearest boundary on this map and Kīlauea about ${n(round10(kilauea.km))} km.`,
      checks: [[n(round10(yellowstone.km)), yellowstone.km], [n(round10(kilauea.km)), kilauea.km]],
      tolerance: 5,
    },
    {
      q: 'The page says the boundaries on this map are simplified. Give one way the real Earth is more complicated.',
      lines: 2,
      a: 'Any one of: there are many more small plates than the map shows; some boundaries are wide zones, not sharp lines; a boundary can change type along its length; thousands of small earthquakes, not just a few large ones, trace every boundary; most volcanoes on mid-ocean ridges are hidden under the sea.',
    },
  ],
};
