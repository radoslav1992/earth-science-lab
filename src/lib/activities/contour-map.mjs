// Classroom activity for the Contour Map Playground, in the same shape as the entries of
// src/lib/activities.mjs. The printed map is the Ridge and valley preset at a 20 m interval; every
// number below is computed from terrain.mjs, and tests/contour.test.mjs checks each `checks` pair
// (printed text, model value[, tolerance]) and that no answer prints an unchecked number.
import { createTerrain, sample, riverPath, profile, profileStats, presetById } from '../terrain.mjs';
import { pointOnContour } from '../contour-challenges.mjs';

// Topographic maps aren't a named NGSS performance expectation, so no code is claimed; this is the link.
export const contourStandardsNote = 'Supports map-reading skills used in MS-ESS2-2 investigations (how geoscience processes shape Earth’s surface).';

export const WORKSHEET_MAP = { preset: 'river', interval: 20, seaLevel: 0 };
const t = createTerrain(WORKSHEET_MAP.preset);
const river = riverPath(t, presetById('river').river);
const nearRiver = x => river.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best));
const [cx, cy] = nearRiver(3000);

/** The labeled points and the cross-section line printed on the worksheet map (meters). */
export const WORKSHEET_POINTS = {
  A: pointOnContour(t, (([x, y]) => ({ x, y }))(nearRiver(1500)), Math.PI / 2, 260),
  B: pointOnContour(t, (([x, y]) => ({ x, y }))(nearRiver(4400)), Math.PI / 2, 430),
  C: { x: cx, y: cy },
};
export const WORKSHEET_LINE = { a: { x: 3600, y: 500 }, b: { x: 3600, y: 3600 }, labels: ['X', 'Y'] };

const elevation = p => sample(t, p.x, p.y);
const [hA, hB, hC] = ['A', 'B', 'C'].map(k => elevation(WORKSHEET_POINTS[k]));
const source = river[0], mouth = river[river.length - 1];
const hMouth = sample(t, mouth[0], mouth[1]);
export const worksheetProfile = profile(t, WORKSHEET_LINE.a, WORKSHEET_LINE.b);
const xy = profileStats(worksheetProfile);
// Average slope on each side of the valley along X–Y: X to the river, and the river to Y.
const hX = worksheetProfile[0].h, hY = worksheetProfile[worksheetProfile.length - 1].h;
const northDrop = hX - xy.low.h, northRun = xy.low.d, southRise = hY - xy.low.h, southRun = xy.length - xy.low.d;
const fmt = (v, d = 0) => v.toFixed(d);
// The contour lines either side of a point, and the halfway estimate a student would make.
const ci = WORKSHEET_MAP.interval;
const between = h => { const below = Math.floor(h / ci) * ci; return { below, above: below + ci, mid: below + ci / 2 }; };
const [lB, lC] = [between(hB), between(hC)];
const mouthLine = Math.ceil(hMouth / ci) * ci;

export const contourMapActivity = {
  tool: 'contour-map',
  toolName: 'Contour Map Playground',
  title: 'Reading a Contour Map Activity',
  grade: 'Grades 6–10',
  minutes: 15,
  standards: [],
  standardsNote: contourStandardsNote,
  goal: 'Read a topographic map: find the contour interval, read elevations, compare slopes, use the V-rule to find which way a river flows, and sketch a cross-section.',
  steps: [
    'Open the playground and choose Ridge and valley. Compare the landscape with its map.',
    'Turn on the V-rule overlay. How do the lines bend where they cross the river?',
    'Find points A, B and C on this map. Record the lines around each one and estimate its elevation.',
    'Answer the questions, then draw a north–south cross-section in the playground to check question 5.',
  ],
  rowHeader: 'Point',
  tableNote: 'Read from the 20 m contour lines. For a point between two lines, any estimate between them is fine.',
  record: ['Lines around it (m)', 'Elevation (m)'],
  rows: [
    ['A', { 'Lines around it (m)': `On the ${fmt(hA)} line`, 'Elevation (m)': fmt(hA) }],
    ['B', { 'Lines around it (m)': `${lB.below} and ${lB.above}`, 'Elevation (m)': `about ${lB.mid}` }],
    ['C (on the river)', { 'Lines around it (m)': `${lC.below} and ${lC.above}`, 'Elevation (m)': `about ${lC.mid}` }],
  ],
  extra: 'Contour interval on this map: ________ m',
  extraAnswer: {
    a: 'Contour interval: 20 m. Index lines are labeled every 100 m, with 4 thin lines between them.',
    checks: [['20', ci], ['100', 5 * ci]],
  },
  questions: [
    {
      q: 'How can you work out the contour interval from the labeled (index) lines?',
      lines: 2,
      a: `Neighbouring index lines are 100 m apart (for example 300 and 400) with 4 thin lines between them, so 100 m is split into 5 equal steps: 100 ÷ 5 = ${ci} m.`,
      checks: [['20', ci]],
    },
    {
      q: 'Point B is between two lines. Explain how you estimated its elevation.',
      lines: 2,
      a: `B lies about halfway between the ${lB.below} m and ${lB.above} m lines, so it is about ${lB.mid} m. Any estimate between the two lines is reasonable; halfway is the best guess.`,
      checks: [[String(lB.below), hB, ci], [String(lB.above), hB, ci], [String(lB.mid), hB, ci / 2]],
    },
    {
      q: 'Which side of the valley is steeper: north of the river or south of it? How can you tell from the map?',
      lines: 2,
      a: `North. The lines are packed close together there. Along X–Y the ground drops about ${fmt(northDrop)} m in ${fmt(northRun / 1000, 1)} km north of the river, but rises only about ${fmt(southRise)} m in ${fmt(southRun / 1000, 1)} km south of it.`,
      checks: [[fmt(northDrop), northDrop], [fmt(northRun / 1000, 1), northRun / 1000], [fmt(southRise), southRise], [fmt(southRun / 1000, 1), southRun / 1000]],
    },
    {
      q: 'Which way does the river flow? Use the shape of the contour lines where they cross it.',
      lines: 2,
      a: `West, toward the left edge. Where the lines cross the river they bend into Vs that point east, upstream; water flows the other way, downhill. The river is about ${lC.mid} m at C but below the ${mouthLine} m line where it leaves the map in the west.`,
      checks: [[String(lC.mid), hC, ci / 2], [String(mouthLine), hMouth, ci]],
      flowsWest: mouth[0] < source[0],
    },
    {
      q: 'Sketch the cross-section from X to Y: mark where X–Y crosses each thick line, then join the points smoothly.',
      lines: 0,
      a: `The ground falls steeply from about ${fmt(hX)} m at X to the river at about ${fmt(xy.low.h)} m, ${fmt(xy.low.d / 1000, 1)} km from X, then climbs gently to about ${fmt(hY)} m at Y.`,
      checks: [[fmt(hX), hX], [fmt(xy.low.h), xy.low.h], [fmt(xy.low.d / 1000, 1), xy.low.d / 1000], [fmt(hY), hY]],
    },
    {
      q: 'Along X–Y, how much higher is the highest point than the lowest point?',
      lines: 1,
      a: `The highest point is near X, about ${fmt(xy.high.h)} m; the lowest is the river, about ${fmt(xy.low.h)} m. The difference is about ${Math.round(xy.high.h) - Math.round(xy.low.h)} m.`,
      checks: [[fmt(xy.high.h), xy.high.h], [fmt(xy.low.h), xy.low.h], [String(Math.round(xy.high.h) - Math.round(xy.low.h)), xy.high.h - xy.low.h, 1]],
    },
  ],
};
