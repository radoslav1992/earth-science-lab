// The River Erosion Sandbox's classroom activity, in the same shape as the entries in ../activities.mjs.
// Every table cell and every number in an answer is computed by river.mjs; each `checks` entry pairs a number
// as printed with the model value it came from, plus how far rounding may move it (tests/river.test.mjs).
import {
  simulate, measure, erosionSpeed, settlingSpeed, zoneAt, grainById, GRAINS,
  fmt, fmtSpeed, fmtVolume, fmtDepth, fmtThreshold, roundVolume,
} from '../river.mjs';

// NGSS performance expectations referenced below, paraphrased.
export const standards = {
  'MS-ESS2-2': 'Construct an explanation, based on evidence, of how geoscience processes have changed Earth’s surface at varying time and spatial scales.',
  'HS-ESS2-5': 'Plan and conduct an investigation of the properties of water and its effects on Earth materials and surface processes.',
};

export const MINUTES = 10;
/** The four setups students compare: fine sand, no sediment fed in. */
export const SETUPS = [
  { name: 'A', slope: 2, flow: 2 },
  { name: 'B', slope: 6, flow: 2 },
  { name: 'C', slope: 2, flow: 6 },
  { name: 'D', slope: 6, flow: 6 },
].map(s => ({ ...s, grain: 'fine-sand', supply: 0 }));
export const results = SETUPS.map(s => measure(simulate(s), MINUTES));
const [A, B, C, D] = results;
const setupLabel = s => `${s.name}: ${fmt(s.slope)}% slope, ${fmt(s.flow)} L/min`;

// Threshold speeds as the page prints them, and how far that rounding can move them.
const tol = v => (v >= 100 ? 5 : v >= 10 ? 0.5 : v >= 1 ? 0.05 : v / 2);
const thr = mm => [fmtThreshold(erosionSpeed(mm)), erosionSpeed(mm), tol(erosionSpeed(mm))];
const settle = mm => [fmtThreshold(settlingSpeed(mm)), settlingSpeed(mm), tol(settlingSpeed(mm))];
const vol = v => [fmtVolume(v), v, Math.abs(roundVolume(v) - v) + 1e-9];
const spd = v => [fmtSpeed(v), v, 0.5];
const exact = v => [String(v), v];

// Question 4 reads the Hjulström diagram at one speed.
export const READ_SPEED = 40;
const at = GRAINS.map(g => ({ g, zone: zoneAt(g.mm, READ_SPEED) }));
const eroded = at.filter(a => a.zone === 'erode'), carried = at.filter(a => a.zone === 'transport'), dropped = at.filter(a => a.zone === 'deposit');
const list = items => items.map(({ g }) => `${g.name.toLowerCase()} (about ${fmtThreshold(erosionSpeed(g.mm))} cm/s)`).join(items.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1');
const clay = grainById('clay'), sand = grainById('fine-sand'), gravel = grainById('gravel');
const G = measure(simulate({ ...SETUPS[3], grain: 'gravel' }), MINUTES);
// The extra task: setup A with lots of sediment fed in.
export const FAN = { ...SETUPS[0], supply: 60 };
const fan = measure(simulate(FAN), MINUTES);

export const riverActivity = {
  tool: 'river-erosion',
  toolName: 'River Erosion Sandbox',
  title: 'Erosion and Deposition Activity',
  grade: 'Grades 6–10',
  minutes: 15,
  standards: ['MS-ESS2-2', 'HS-ESS2-5'],
  goal: 'Use a model stream table to find out how slope, water flow and grain size control erosion and deposition.',
  steps: [
    'Open the River Erosion Sandbox. Choose Fine sand and set Sediment fed in to 0.',
    `Set the slope and water flow for setup A, then drag the time slider to ${MINUTES} minutes (or press Run and watch).`,
    'Record the water speed at the start, the sediment eroded, the deepest cut and the delta length. Repeat for B, C and D.',
    'Answer the questions. Use the Hjulström diagram (on this sheet or in the sandbox) for questions 4 and 5.',
  ],
  rowHeader: 'Setup',
  record: ['Speed at start (cm/s)', 'Eroded (cm³)', 'Deepest cut (cm)', 'Delta length (cm)'],
  rows: SETUPS.map((s, i) => [setupLabel(s), {
    'Speed at start (cm/s)': fmtSpeed(results[i].startSpeed),
    'Eroded (cm³)': fmtVolume(results[i].eroded),
    'Deepest cut (cm)': fmtDepth(results[i].deepestCut),
    'Delta length (cm)': String(results[i].deltaLength),
  }]),
  keyNote: `Values after ${MINUTES} minutes with fine sand and no sediment fed in, as the sandbox shows them (volumes rounded to two figures). Readings a slider step away are fine.`,
  extra: `Extra: set up A again with ${FAN.supply} cm³ of sediment fed in per minute. After ${MINUTES} minutes, the bed near the inlet has built up ______ cm.`,
  extraAnswer: {
    a: `About ${fmtDepth(fan.buildUp)} cm. On a gentle slope the water can’t carry that much sand, so it drops the extra near the inlet and builds a fan, which steepens the slope.`,
    checks: [[fmtDepth(fan.buildUp), fan.buildUp, 0.05]],
  },
  questions: [
    {
      q: 'Which setup eroded the most sand, and which eroded the least? Use the water speeds to explain why.',
      lines: 2,
      a: `Most: D, about ${fmtVolume(D.eroded)} cm³, with the fastest water (${fmtSpeed(D.startSpeed)} cm/s at the start). Least: A, about ${fmtVolume(A.eroded)} cm³ at ${fmtSpeed(A.startSpeed)} cm/s. Faster water picks up more sediment and can carry more of it.`,
      checks: [vol(D.eroded), spd(D.startSpeed), vol(A.eroded), spd(A.startSpeed)],
    },
    {
      q: 'Compare B and C: did more slope or more water make the water faster? Which built the longer delta?',
      lines: 2,
      a: `More water: C started at ${fmtSpeed(C.startSpeed)} cm/s and B at ${fmtSpeed(B.startSpeed)} cm/s. C also built the longer delta, ${C.deltaLength} cm against ${B.deltaLength} cm, because more fast water carried more sand down to the sea.`,
      checks: [spd(C.startSpeed), spd(B.startSpeed), exact(C.deltaLength), exact(B.deltaLength)],
    },
    {
      q: 'Where did the sand cut from the channel end up? Why there?',
      lines: 2,
      a: `Mostly in the delta: in C, about ${fmtVolume(C.seaDeposit)} of the ${fmtVolume(C.eroded)} cm³ eroded was laid down in the sea. The river spreads out and slows down as it enters the still water, so it can’t carry its sand any farther and drops it. Some sand also settles on the inside of bends, where the water is slower.`,
      checks: [vol(C.seaDeposit), vol(C.eroded)],
    },
    {
      q: `At ${READ_SPEED} cm/s on the Hjulström diagram, which sediments are eroded and which are only transported?`,
      lines: 2,
      a: `Eroded: ${list(eroded)}. Only transported: ${list(carried)}; they keep moving if they are already in the water, but the water is too slow to pick them up from the bed.${dropped.length ? ` Deposited: ${list(dropped)}.` : ''}`,
      checks: at.map(({ g }) => thr(g.mm)),
      zones: { erode: eroded.map(a => a.g.id), transport: carried.map(a => a.g.id), deposit: dropped.map(a => a.g.id) },
    },
    {
      q: 'Clay grains are smaller and lighter than sand. Why does clay need faster water to be picked up?',
      lines: 2,
      a: `Clay flakes stick together and settle into a smooth, firm layer that the water slides over, so lifting them takes about ${fmtThreshold(erosionSpeed(clay.mm))} cm/s, while fine sand moves at about ${fmtThreshold(erosionSpeed(sand.mm))} cm/s. Once clay is floating, it sinks so slowly that almost any current keeps it moving.`,
      checks: [thr(clay.mm), thr(sand.mm)],
    },
    {
      q: 'Predict, then test: will gravel build a longer or a shorter delta than fine sand in setup D? Why?',
      lines: 2,
      a: `Shorter: ${G.deltaLength} cm instead of ${D.deltaLength} cm. Gravel needs about ${fmtThreshold(erosionSpeed(gravel.mm))} cm/s to be picked up, so D’s ${fmtSpeed(G.startSpeed)} cm/s water barely moves it, and it sinks fast (about ${fmtThreshold(settlingSpeed(gravel.mm))} cm/s), so it drops right at the river mouth.`,
      checks: [exact(G.deltaLength), exact(D.deltaLength), thr(gravel.mm), spd(G.startSpeed), settle(gravel.mm)],
    },
  ],
};
