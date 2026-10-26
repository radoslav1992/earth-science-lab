// The Rock Cycle Builder's classroom activity, in the same shape as the entries in ../activities.mjs.
// Students follow one journey (granite → … → magma); every table cell is the builder's own output for that
// step, and each `checks` entry pairs a number printed in an answer with the value the model computes
// (tests/rock-cycle.test.mjs fails if a printed number drifts or an unchecked number appears).
import * as r from '../rock-cycle.mjs';

// NGSS performance expectation referenced below, paraphrased.
export const standards = {
  'MS-ESS2-1': 'Develop a model to describe how Earth’s materials cycle and the flow of energy that drives this cycling.',
};

// The journey on the worksheet: start from granite, then these six steps.
export const JOURNEY = { start: 'granite', steps: ['up', 'we', 'dm', 'cc', 'h3', 'me'] };
const run = r.replay(JOURNEY.start, JOURNEY.steps);
if (run.stoppedAt >= 0) throw new Error(`Worksheet journey stops at step ${run.stoppedAt + 1}: ${run.reason}`);
/** One table row per step, exactly as the builder reports it. */
export function journeyRow(step) {
  const c = r.conditions(step.code, step.to, step.from);
  const m = r.MATERIALS[step.to.id];
  const where = step.code === 'up' ? r.PLACES[step.to.place].name : c.depth[1] > 0 ? `${c.where}, ${r.fmtRange(c.depth)} km down` : c.where;
  return {
    'You get': m.name,
    Family: r.FAMILY_NAMES[m.family],
    'Where it happens': where,
    'About how hot?': c.temp && step.code !== 'cf' && step.code !== 'cg' && step.code !== 'cv' ? `${r.fmtRange(c.temp)} °C` : 'Surface temperature',
  };
}
const rowName = (code, i) => `${i + 1}. ${r.stepName(code).replace(/, /, ': ')}`;

// Numbers used in the answers, all from the model.
const ccStep = JOURNEY.steps.indexOf('cc') + 1;
const schistStep = run.steps[JOURNEY.steps.indexOf('h3')];
const [gLow, gHigh] = r.GRADES[2].temp; // the medium grade that made the schist
const schistTemp = (gLow + gHigh) / 2;
const schistKm = r.depthForTempKm(schistTemp);
const [dLow, dHigh] = r.gradeDepth(3);
const riseMyr = r.upliftMyr(schistKm);
const magma = run.states.at(-1);
const cooled = Object.fromEntries(['cs', 'cf', 'cg', 'cv'].map(code => [code, r.MATERIALS[r.apply(magma, code).state.id].name]));

export const activity = {
  tool: 'rock-cycle',
  toolName: 'Rock Cycle Builder',
  title: 'Rock Cycle Journey Activity',
  grade: 'Grades 6–10',
  minutes: 15,
  standards: ['MS-ESS2-1'],
  goal: 'Follow one rock through the rock cycle in a model: record what each process makes, where in Earth it happens and how hot it gets, and name the energy that drives each change.',
  steps: [
    'Open the Rock Cycle Builder in Explore mode and choose Start from: Granite.',
    'Apply the six processes in the table, in order. A dashed option can’t happen yet: press it to find out why.',
    'After each step, record what you get, its family, where it happens and how hot it is (from the Conditions panel).',
    'Answer the questions. Then try Challenge mode.',
  ],
  rowHeader: 'Process',
  record: ['You get', 'Family', 'Where it happens', 'About how hot?'],
  rows: run.steps.map((step, i) => [rowName(step.code, i), journeyRow(step)]),
  extra: 'Choose one way for your magma to cool. Cooling: ______________________ Rock you get: ______________________',
  extraAnswer: {
    a: `Answers vary. Slowly underground: ${cooled.cs}. Quickly as lava: ${cooled.cf}. Very quickly, into glass: ${cooled.cg}. Full of gas bubbles: ${cooled.cv}.`,
    checks: [],
  },
  keyNote: 'Values come from the builder’s Conditions panel and are rough ranges; accept answers close to them. Sediment and magma are not rocks yet, so they belong to no rock family.',
  questions: [
    {
      q: 'Which step turned loose material into solid rock? What two things happened to make it solid?',
      lines: 2,
      a: `${r.stepName('cc')} (step ${ccStep}) made ${r.MATERIALS[run.states[ccStep].id].name.toLowerCase()}. The weight of the layers above squeezed the mud grains together (compaction), and minerals left by water glued them (cementation).`,
      checks: [[String(ccStep), ccStep]],
    },
    {
      q: 'Which steps happened at the surface, and which deep underground? What energy drives each group?',
      lines: 2,
      a: 'At the surface: weathering and erosion, and deposition. Energy from the Sun drives the weather and moving water, and gravity moves the grains downhill. Underground: compaction and cementation, heat and pressure, and melting, driven by Earth’s internal heat and the weight of the rock above. Uplift links the two: Earth’s heat drives the plate motions that lift mountains, and erosion uncovers the rock.',
    },
    {
      q: `The crust gets about ${r.GRADIENT_C_PER_KM} °C hotter per km down. Your shale became schist at about ${schistTemp} °C. How deep was it?`,
      lines: 2,
      a: `${schistTemp} ÷ ${r.GRADIENT_C_PER_KM} = ${r.fmtNum(schistKm)} km down. That fits the builder’s range for medium grade, ${dLow}–${dHigh} km.`,
      checks: [[String(schistTemp), schistTemp], [String(r.GRADIENT_C_PER_KM), r.GRADIENT_C_PER_KM], [r.fmtNum(schistKm), schistKm], [String(dLow), dLow], [String(dHigh), dHigh]],
      schistFrom: schistStep.from.id,
    },
    {
      q: `At ${r.UPLIFT_MM_PER_YR} mm per year of uplift (1 km per million years), how long would the schist take to reach the surface?`,
      lines: 2,
      a: `${r.fmtNum(schistKm)} km at ${r.UPLIFT_MM_PER_YR} km per million years takes ${r.fmtNum(schistKm)} ÷ ${r.UPLIFT_MM_PER_YR} = ${r.fmtNum(riseMyr)} million years.`,
      checks: [[r.fmtNum(schistKm), schistKm], [String(r.UPLIFT_MM_PER_YR), r.UPLIFT_MM_PER_YR], [r.fmtNum(riseMyr), riseMyr]],
    },
    {
      q: 'Your journey ended as magma. Name two different rocks it could become, and say how each would cool.',
      lines: 2,
      a: `Cooling slowly underground makes ${cooled.cs.toLowerCase()}, with big crystals. Cooling quickly as lava makes ${cooled.cf.toLowerCase()}, with tiny crystals. Cooling very quickly makes ${cooled.cg.toLowerCase()} (glass), and lava full of gas makes ${cooled.cv.toLowerCase()}.`,
    },
    {
      q: 'A classmate says rocks always go igneous → sedimentary → metamorphic. Find a shortcut in the builder and describe it.',
      lines: 2,
      a: 'There is no fixed order. For example, granite can go straight to gneiss with high-grade heat and pressure (igneous to metamorphic), sandstone can be uplifted and weathered into new sediment (sedimentary back to sediment), and basalt can melt again without ever becoming sedimentary.',
    },
  ],
};
