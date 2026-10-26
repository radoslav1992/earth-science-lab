// Match & Read: eight fixed questions on the preset maps. Every answer is worked out here from the model
// (terrain.mjs), and tests/contour.test.mjs checks each one, so a change to a preset can't leave a wrong key.
import { createTerrain, sample, slopeAt, riverPath, pits, summits, presetById } from './terrain.mjs';

/** Walk from `from` in direction `angle` (radians, 0 = east, y south) to where the ground crosses `level`. */
export function pointOnContour(t, from, angle, level, maxDistance = 4000) {
  const ux = Math.cos(angle), uy = Math.sin(angle), above = sample(t, from.x, from.y) >= level;
  let lo = 0, hi = null;
  for (let d = 10; d <= maxDistance; d += 10) {
    if ((sample(t, from.x + ux * d, from.y + uy * d) >= level) !== above) { hi = d; break; }
    lo = d;
  }
  if (hi === null) return null;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if ((sample(t, from.x + ux * mid, from.y + uy * mid) >= level) === above) lo = mid; else hi = mid;
  }
  const d = (lo + hi) / 2;
  return { x: from.x + ux * d, y: from.y + uy * d };
}

const terrains = {};
const terrain = id => (terrains[id] ??= createTerrain(id));

// Question 2: a point on the 360 m line of the single hill, south-east of the summit.
const hillTop = summits(terrain('hill'))[0];
const pointP = pointOnContour(terrain('hill'), hillTop, Math.PI / 4, 360);
// Question 4: two points on the 300 m line of the steep-and-gentle hill, due west and due east of its summit.
const steepTop = summits(terrain('steep'))[0];
const pointW = pointOnContour(terrain('steep'), steepTop, Math.PI, 300);
const pointE = pointOnContour(terrain('steep'), steepTop, 0, 300);
const steeperEast = slopeAt(terrain('steep'), pointE.x, pointE.y).gradient > slopeAt(terrain('steep'), pointW.x, pointW.y).gradient;
// Question 6: the bottom of the volcano's crater.
const crater = pits(terrain('volcano'))[0];
// Question 7: which way the river runs (it starts upstream).
const river = riverPath(terrain('river'), presetById('river').river);
const flowsWest = river[river.length - 1][0] < river[0][0];
// Question 8: a west–east line across the cliff.
const cliffLine = { a: { x: 600, y: 2200 }, b: { x: 5400, y: 1800 } };

export const CHALLENGES = [
  {
    id: 'match-island', kind: 'match',
    prompt: 'Which landscape does this map show?',
    map: { preset: 'island', interval: 20 },
    choices: ['hill', 'island', 'cliff'].map(preset => ({ preset, label: presetById(preset).name })),
    answer: 1,
    explain: 'The thick blue coastline at 0 m closes all the way round, and two sets of closed loops sit inside it: an island with two hills.',
  },
  {
    id: 'elevation', kind: 'choice',
    prompt: 'What is the elevation of point P?',
    map: { preset: 'hill', interval: 20, marks: [{ ...pointP, label: 'P' }] },
    choices: [320, 340, 360, 380].map(m => ({ label: `${m} m`, value: m })),
    answer: [320, 340, 360, 380].indexOf(Math.round(sample(terrain('hill'), pointP.x, pointP.y) / 20) * 20),
    explain: 'P is on the third thin line above the line labeled 300. The lines are 20 m apart, so P is at 300 + 3 × 20 = 360 m.',
  },
  {
    id: 'interval', kind: 'choice',
    prompt: 'The thick lines are labeled. What is the contour interval (the height between neighboring lines)?',
    map: { preset: 'saddle', interval: 20 },
    choices: [5, 10, 20, 50].map(m => ({ label: `${m} m`, value: m })),
    answer: 2,
    explain: 'Labelled lines are 100 m apart, with four thin lines between them. That splits 100 m into five equal steps: 100 ÷ 5 = 20 m.',
  },
  {
    id: 'steeper', kind: 'choice',
    prompt: 'W and E are both on the 300 m line. Which side of the hill is steeper?',
    map: { preset: 'steep', interval: 20, marks: [{ ...pointW, label: 'W', dx: -9 }, { ...pointE, label: 'E' }] },
    choices: [{ label: 'The west side, near W', value: 'west' }, { label: 'The east side, near E', value: 'east' }],
    answer: steeperEast ? 1 : 0,
    explain: 'The lines are packed closely together on the east side, so the ground rises many meters in a short distance there. Widely spaced lines on the west side mean a gentle slope.',
  },
  {
    id: 'match-volcano', kind: 'match',
    prompt: 'Which landscape does this map show?',
    map: { preset: 'volcano', interval: 50 },
    choices: ['volcano', 'saddle', 'steep'].map(preset => ({ preset, label: presetById(preset).name })),
    answer: 0,
    explain: 'Closed loops crowd together toward the top: a steep cone. The innermost loops have hachure ticks pointing inward, which marks a hollow: the crater.',
  },
  {
    id: 'hachures', kind: 'choice',
    prompt: 'Point X is inside the loops with small ticks. What is true about X?',
    map: { preset: 'volcano', interval: 20, marks: [{ ...crater, label: 'X' }] },
    choices: [
      { label: 'X is higher than the loops around it', value: 'higher' },
      { label: 'X is the highest point on the map', value: 'top' },
      { label: 'X is lower than the loops around it: it is in a hollow', value: 'lower' },
    ],
    answer: 2,
    explain: 'Ticks on a closed loop point downhill, into a hollow. Here they mark the crater: each loop inside is lower, down to the crater floor at X.',
  },
  {
    id: 'flow', kind: 'choice',
    prompt: 'Which way does the river flow?',
    map: { preset: 'river', interval: 20 },
    choices: [{ label: 'Toward the west (left)', value: 'west' }, { label: 'Toward the east (right)', value: 'east' }],
    answer: flowsWest ? 0 : 1,
    explain: 'Where the contour lines cross the river they bend into a V. The Vs point upstream, to the east, so the water flows the other way: west, toward the lower lines.',
  },
  {
    id: 'profile', kind: 'profile',
    prompt: 'Which cross-section shows the ground along the line from A to B?',
    map: { preset: 'cliff', interval: 20, line: cliffLine },
    choices: [
      { profile: { preset: 'cliff', a: cliffLine.b, b: cliffLine.a }, label: 'Flat lowland, then a steep climb, then a gentle slope down' },
      { profile: { preset: 'volcano', a: { x: 600, y: 2000 }, b: { x: 5400, y: 2000 } }, label: 'A steep peak with a dip at the very top' },
      { profile: { preset: 'cliff', a: cliffLine.a, b: cliffLine.b }, label: 'A gentle climb, then a steep drop to flat lowland' },
    ],
    answer: 2,
    explain: 'From A the lines are far apart and rise slowly to the cliff top, then pack tightly together where the ground drops to the lowland near B.',
  },
];

export const CHALLENGE_COUNT = CHALLENGES.length;
