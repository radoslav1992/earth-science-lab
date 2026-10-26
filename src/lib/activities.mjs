// Classroom activities: one printable student worksheet per tool, plus a teacher answer key.
// Each `checks` entry pairs a number printed in an answer with the value the model computes;
// tests/activities.test.mjs fails if a printed number drifts from seismology.mjs, or if an answer
// prints a number that is neither checked here nor one of the formula's own constants.
import * as s from './seismology.mjs';
import { activity as plates, standards as plateStandards } from './activities/plate-tectonics.mjs';
import { contourMapActivity } from './activities/contour-map.mjs';
import { riverActivity, standards as riverStandards } from './activities/river-erosion.mjs';
import { waterCycleActivity, standards as waterStandards } from './activities/water-cycle.mjs';

// NGSS performance expectations referenced below, paraphrased.
export const standards = {
  ...plateStandards,
  ...riverStandards,
  ...waterStandards,
  'MS-ESS3-2': 'Analyze and interpret data on natural hazards to forecast future catastrophic events and inform technologies to mitigate their effects.',
};

// Guided mode's quake, read the way a careful student reads it (times to 0.1 s; see s.picked).
const guided = s.readings(s.GUIDED).map(r => ({ ...r, read: s.picked(r) }));
const [, bay, cdr] = guided;
const fmt = (v, d = 1) => s.round(v, d).toFixed(d);
const fit = s.trilaterate(guided.map(r => ({ x: r.station.x, y: r.station.y, r: r.read.km })));
const fitMiss = s.distance(fit, s.GUIDED.quake);
const cdrAmplitude = s.round(cdr.amplitude, 1);
const cdrMagnitude = s.localMagnitude(cdrAmplitude, cdr.read.lag);

export const activities = [
  {
    tool: 'earthquake-epicenter',
    toolName: 'Earthquake Epicenter Finder',
    title: 'Earthquake Epicenter Activity',
    grade: 'Grades 6–10',
    minutes: 15,
    standards: ['MS-ESS3-2'],
    goal: 'Use S–P lag times from three seismograms to find how far away an earthquake was from each station, then locate its epicenter by triangulation.',
    steps: [
      'Open the Earthquake Epicenter Finder and choose Guided mode.',
      'On each seismogram, click where the first small wiggles start (the P wave), then where the big wiggles start (the S wave). Record both times and subtract: S − P = the S–P lag.',
      'Turn each lag into a distance: distance (km) = lag (s) × 8.4. Type it in to draw that station’s circle.',
      'Click where the three circles meet and press Reveal the epicenter. Record how far off your guess was.',
    ],
    record: ['P arrives (s)', 'S arrives (s)', 'S–P lag (s)', 'Distance (km)'],
    rows: guided.map(r => [r.station.name, { 'P arrives (s)': fmt(r.read.p), 'S arrives (s)': fmt(r.read.s), 'S–P lag (s)': fmt(r.read.lag), 'Distance (km)': fmt(r.read.km, 0) }]),
    extra: 'My epicenter guess was ____ km from the true epicenter.',
    extraAnswer: {
      a: `Answers vary. With the distances above, the three circles meet within about ${fmt(fitMiss)} km of the true epicenter, which is ${s.GUIDED.quake.x} km east and ${s.GUIDED.quake.y} km south of the map’s north-west corner.`,
      checks: [[fmt(fitMiss), fitMiss], [String(s.GUIDED.quake.x), s.GUIDED.quake.x], [String(s.GUIDED.quake.y), s.GUIDED.quake.y]],
    },
    questions: [
      {
        q: 'Which station was closest to the earthquake? How can you tell from the seismograms alone, before doing any math?',
        lines: 2,
        a: `Cedar Ridge. Its S–P lag is the shortest (about ${fmt(cdr.read.lag)} s), because the S wave had the least distance in which to fall behind the P wave. Bayview, with the longest lag (about ${fmt(bay.read.lag)} s), was farthest away.`,
        checks: [[fmt(cdr.read.lag), cdr.read.lag], [fmt(bay.read.lag), bay.read.lag]],
      },
      {
        q: 'Show your calculation of the distance from Bayview to the earthquake.',
        lines: 2,
        a: `S–P lag = ${fmt(bay.read.s)} − ${fmt(bay.read.p)} = ${fmt(bay.read.lag)} s, and ${fmt(bay.read.lag)} × 8.4 ≈ ${fmt(bay.read.km, 0)} km. (The exact distance in the model is ${fmt(bay.distance)} km, so the 8.4 rule gets very close.)`,
        checks: [[fmt(bay.read.s), bay.s], [fmt(bay.read.p), bay.p], [fmt(bay.read.lag), bay.read.lag], [fmt(bay.read.km, 0), bay.read.km], [fmt(bay.distance), bay.distance]],
      },
      {
        q: 'P waves travel at about 6.0 km/s and S waves at about 3.5 km/s. Explain why the S–P lag gets longer the farther a station is from the earthquake.',
        lines: 2,
        a: `Both waves leave the focus at the same moment, but the S wave is slower, so it falls further behind with every kilometer: about ${fmt(s.LAG_PER_KM, 3)} s per km (1 ÷ 3.5 − 1 ÷ 6.0). Over ${fmt(s.KM_PER_SECOND_LAG)} km it falls 1 second behind, which is where the “× 8.4” rule comes from.`,
        checks: [[fmt(s.LAG_PER_KM, 3), s.LAG_PER_KM], [fmt(s.KM_PER_SECOND_LAG), s.KM_PER_SECOND_LAG]],
      },
      {
        q: 'With only one station, what do you know about where the earthquake happened? What about two stations? Why do we need three?',
        lines: 3,
        a: 'One station gives only a distance, so the quake could be anywhere on a circle around it. Two circles usually cross at two points, so there are still two possible places. A third circle passes through only one of those points, which pins down the epicenter.',
      },
      {
        q: 'Your three circles may not meet at exactly one point. Give two reasons why.',
        lines: 2,
        a: `Reading the arrival times by eye adds small errors: even reading them to the nearest 0.1 s moves the best meeting point about ${fmt(fitMiss)} km from the true epicenter, and a pick that is 1 s off moves a circle by 8.4 km. Real waves also travel at different speeds through different rock and curve with depth, and a real focus lies kilometers below the surface, while this model uses constant speeds along the surface.`,
        checks: [[fmt(fitMiss), fitMiss]],
      },
      {
        q: `Challenge: Cedar Ridge recorded a largest S-wave amplitude of ${fmt(cdrAmplitude)} mm. Estimate the magnitude with M = log₁₀(A) + 3 × log₁₀(8 × lag) − 2.92.`,
        lines: 3,
        a: `M = log₁₀(${fmt(cdrAmplitude)}) + 3 × log₁₀(8 × ${fmt(cdr.read.lag)}) − 2.92 ≈ ${fmt(Math.log10(cdrAmplitude), 2)} + ${fmt(3 * Math.log10(8 * cdr.read.lag), 2)} − 2.92 ≈ ${fmt(cdrMagnitude)}. The finder's quake is magnitude ${fmt(s.GUIDED.magnitude)}: a light earthquake that people nearby would feel.`,
        checks: [[fmt(cdrAmplitude), cdr.amplitude], [fmt(cdr.read.lag), cdr.read.lag], [fmt(Math.log10(cdrAmplitude), 2), Math.log10(cdrAmplitude)], [fmt(3 * Math.log10(8 * cdr.read.lag), 2), 3 * Math.log10(8 * cdr.read.lag)], [fmt(cdrMagnitude), s.GUIDED.magnitude]],
      },
    ],
  },
  plates,
  contourMapActivity,
  riverActivity,
  waterCycleActivity,
];
